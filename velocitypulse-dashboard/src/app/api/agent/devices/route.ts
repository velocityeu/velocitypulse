import { NextRequest, NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/api/agent-auth'
import { createServiceClient } from '@/lib/db/client'
import type { Device } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agent/devices
 *
 * Returns devices that the agent should monitor.
 * Filters to devices in segments assigned to this agent.
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate agent
    const agentContext = await authenticateAgent()
    if (!agentContext) {
      return NextResponse.json(
        { error: 'Invalid or disabled API key' },
        { status: 401 }
      )
    }

    const supabase = createServiceClient()

    // Get optional segment_id filter from query params
    const segmentId = request.nextUrl.searchParams.get('segment_id')

    // Get segments assigned to this agent
    let segmentQuery = supabase
      .from('network_segments')
      .select('id')
      .eq('agent_id', agentContext.agentId)
      .eq('organization_id', agentContext.organizationId)
      .eq('is_enabled', true)

    if (segmentId) {
      segmentQuery = segmentQuery.eq('id', segmentId)
    }

    const { data: segments, error: segmentsError } = await segmentQuery

    if (segmentsError) {
      console.error('Error fetching segments:', segmentsError)
      return NextResponse.json(
        { error: 'Failed to fetch segments' },
        { status: 500 }
      )
    }

    if (!segments || segments.length === 0) {
      return NextResponse.json({
        success: true,
        devices: [],
      })
    }

    const segmentIds = segments.map(s => s.id)

    // Get devices in these segments that are enabled for monitoring
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select(`
        id,
        name,
        ip_address,
        url,
        port,
        check_type,
        status,
        is_enabled,
        is_monitored,
        network_segment_id,
        mac_address,
        hostname,
        check_interval_seconds,
        ssl_expiry_warn_days,
        dns_expected_ip
      `)
      .eq('organization_id', agentContext.organizationId)
      .in('network_segment_id', segmentIds)
      .eq('is_enabled', true)
      .eq('is_monitored', true)
      .order('name')

    if (devicesError) {
      console.error('Error fetching devices:', devicesError)
      return NextResponse.json(
        { error: 'Failed to fetch devices' },
        { status: 500 }
      )
    }

    // Transform devices for agent consumption
    // Note: is_monitored is included because the agent filters on this field
    const agentDevices = (devices || []).map((device: Partial<Device>) => ({
      id: device.id,
      name: device.name,
      ip_address: device.ip_address,
      url: device.url,
      port: device.port,
      check_type: device.check_type,
      status: device.status,
      network_segment_id: device.network_segment_id,
      mac_address: device.mac_address,
      hostname: device.hostname,
      is_monitored: device.is_monitored ?? true,
      check_interval_seconds: device.check_interval_seconds,
      ssl_expiry_warn_days: device.ssl_expiry_warn_days,
      dns_expected_ip: device.dns_expected_ip,
    }))

    return NextResponse.json({
      success: true,
      devices: agentDevices,
    })
  } catch (error) {
    console.error('Get devices error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

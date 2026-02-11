import { NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/api/agent-auth'
import { createServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { triggerScanCompleteNotification } from '@/lib/notifications'
import { checkAgentRateLimit, checkOrgMonthlyLimit, incrementUsage } from '@/lib/api/rate-limit'
import { rateLimited } from '@/lib/api/errors'
import type { AgentDiscoveryRequest, AgentDiscoveryResponse, DiscoveredDevice, DiscoveryMethod } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * POST /api/agent/devices/discovered
 *
 * Agents upload discovered devices from network scans.
 * Devices are upserted (created or updated) based on MAC address or IP address.
 */
export async function POST(request: Request) {
  try {
    // Authenticate agent
    const agentContext = await authenticateAgent()
    if (!agentContext) {
      return NextResponse.json(
        { error: 'Invalid or disabled API key' },
        { status: 401 }
      )
    }

    // Rate limit checks
    const hourlyCheck = await checkAgentRateLimit(agentContext.agentId, 'discovery')
    if (!hourlyCheck.allowed) {
      return rateLimited(hourlyCheck.retryAfter)
    }

    const supabase = createServiceClient()

    const { data: orgData } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', agentContext.organizationId)
      .single()

    const plan = (orgData?.plan || 'trial') as 'trial' | 'starter' | 'unlimited'
    const monthlyCheck = await checkOrgMonthlyLimit(agentContext.organizationId, plan)
    if (!monthlyCheck.allowed) {
      return rateLimited(3600)
    }

    // Parse request body
    let body: AgentDiscoveryRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!body.segment_id) {
      return NextResponse.json(
        { error: 'segment_id is required' },
        { status: 400 }
      )
    }

    if (!body.devices || !Array.isArray(body.devices)) {
      return NextResponse.json(
        { error: 'devices array is required' },
        { status: 400 }
      )
    }

    // Verify segment belongs to this agent and organization
    const { data: segment, error: segmentError } = await supabase
      .from('network_segments')
      .select('id, name, agent_id, organization_id')
      .eq('id', body.segment_id)
      .eq('agent_id', agentContext.agentId)
      .eq('organization_id', agentContext.organizationId)
      .single()

    if (segmentError || !segment) {
      return NextResponse.json(
        { error: 'Segment not found or not assigned to this agent' },
        { status: 404 }
      )
    }

    let created = 0
    let updated = 0
    let unchanged = 0

    // Process each discovered device
    for (const device of body.devices) {
      try {
        const result = await upsertDevice(
          supabase,
          agentContext.organizationId,
          agentContext.agentId,
          body.segment_id,
          device
        )

        if (result === 'created') created++
        else if (result === 'updated') updated++
        else unchanged++
      } catch (deviceError) {
        logger.error(`Error processing device ${device.ip_address}`, deviceError, { route: 'api/agent/devices/discovered' })
      }
    }

    // Update segment scan stats
    const { error: updateError } = await supabase
      .from('network_segments')
      .update({
        last_scan_at: body.scan_timestamp || new Date().toISOString(),
        last_scan_device_count: body.devices.length,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.segment_id)

    if (updateError) {
      logger.error('Error updating segment scan stats', updateError, { route: 'api/agent/devices/discovered' })
    }

    // Increment usage counters
    await incrementUsage(agentContext.organizationId, agentContext.agentId, 'discovery')

    const response: AgentDiscoveryResponse = {
      success: true,
      created,
      updated,
      unchanged,
    }

    // Fire scan.complete notifications without blocking agent responses
    triggerScanCompleteNotification(
      agentContext.organizationId,
      body.segment_id,
      segment.name || body.segment_id,
      {
        agent_id: agentContext.agentId,
        scan_timestamp: body.scan_timestamp || new Date().toISOString(),
        discovered_count: body.devices.length,
        created_count: created,
        updated_count: updated,
        unchanged_count: unchanged,
        segment_id: body.segment_id,
      }
    ).catch((notifyError) => {
      logger.error('Scan complete notification failed', notifyError, {
        route: 'api/agent/devices/discovered',
        segmentId: body.segment_id,
      })
    })

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Device discovery error', error, { route: 'api/agent/devices/discovered' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Upsert a discovered device
 * Returns 'created', 'updated', or 'unchanged'
 */
async function upsertDevice(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  agentId: string,
  segmentId: string,
  device: DiscoveredDevice
): Promise<'created' | 'updated' | 'unchanged'> {
  const now = new Date().toISOString()

  // Map discovery method to DiscoveryMethod type
  const discoveryMethod: DiscoveryMethod = `agent_${device.discovery_method}` as DiscoveryMethod

  // Try to find existing device by MAC address first (most reliable)
  let existingDevice: {
    id: string
    ip_address?: string
    mac_address?: string
    hostname?: string
    manufacturer?: string
    open_ports?: number[]
    services?: string[]
  } | null = null

  if (device.mac_address) {
    const { data } = await supabase
      .from('devices')
      .select('id, ip_address, mac_address, hostname, manufacturer, open_ports, services')
      .eq('organization_id', organizationId)
      .eq('mac_address', device.mac_address)
      .single()
    existingDevice = data
  }

  // Fall back to IP address lookup
  if (!existingDevice && device.ip_address) {
    const { data } = await supabase
      .from('devices')
      .select('id, ip_address, mac_address, hostname, manufacturer, open_ports, services')
      .eq('organization_id', organizationId)
      .eq('ip_address', device.ip_address)
      .single()
    existingDevice = data
  }

  if (existingDevice) {
    // Check if any fields have changed
    const hasChanges =
      (device.mac_address && device.mac_address !== existingDevice.mac_address) ||
      (device.ip_address && device.ip_address !== existingDevice.ip_address) ||
      (device.hostname && device.hostname !== existingDevice.hostname) ||
      (device.manufacturer && device.manufacturer !== existingDevice.manufacturer) ||
      (device.open_ports && JSON.stringify(device.open_ports) !== JSON.stringify(existingDevice.open_ports)) ||
      (device.services && JSON.stringify(device.services) !== JSON.stringify(existingDevice.services))

    if (!hasChanges) {
      // Just update last_seen_at
      await supabase
        .from('devices')
        .update({ last_seen_at: now })
        .eq('id', existingDevice.id)
      return 'unchanged'
    }

    // Update existing device with new info
    const { error } = await supabase
      .from('devices')
      .update({
        ip_address: device.ip_address || existingDevice.ip_address,
        mac_address: device.mac_address || existingDevice.mac_address,
        hostname: device.hostname || existingDevice.hostname,
        manufacturer: device.manufacturer || existingDevice.manufacturer,
        os_hints: device.os_hints,
        device_type: device.device_type,
        open_ports: device.open_ports,
        services: device.services,
        netbios_name: device.netbios_name,
        snmp_info: device.snmp_info,
        upnp_info: device.upnp_info,
        discovered_by: discoveryMethod,
        last_seen_at: now,
        last_full_scan_at: now,
        updated_at: now,
      })
      .eq('id', existingDevice.id)

    if (error) {
      throw error
    }

    return 'updated'
  }

  // Create new device
  const deviceName = device.hostname ||
    device.snmp_info?.sysName ||
    device.upnp_info?.friendlyName ||
    device.netbios_name ||
    device.ip_address

  const { error } = await supabase
    .from('devices')
    .insert({
      organization_id: organizationId,
      agent_id: agentId,
      network_segment_id: segmentId,
      name: deviceName,
      ip_address: device.ip_address,
      mac_address: device.mac_address,
      hostname: device.hostname,
      manufacturer: device.manufacturer,
      os_hints: device.os_hints,
      device_type: device.device_type || 'unknown',
      open_ports: device.open_ports,
      services: device.services,
      netbios_name: device.netbios_name,
      snmp_info: device.snmp_info,
      upnp_info: device.upnp_info,
      discovered_by: discoveryMethod,
      check_type: 'ping',
      status: 'unknown',
      is_enabled: true,
      is_monitored: true,
      first_seen_at: now,
      last_seen_at: now,
      last_full_scan_at: now,
      sort_order: 0,
    })

  if (error) {
    throw error
  }

  return 'created'
}

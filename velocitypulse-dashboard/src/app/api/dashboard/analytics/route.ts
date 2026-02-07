import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import type { AnalyticsTimeRange, DeviceUptimeStats } from '@/types'

export const dynamic = 'force-dynamic'

const TIME_RANGES: Record<AnalyticsTimeRange, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

/**
 * GET /api/dashboard/analytics?deviceId=&range=24h|7d|30d
 * Returns time-series history and uptime stats
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get user's organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const organizationId = membership.organization_id
    const { searchParams } = new URL(request.url)
    const deviceId = searchParams.get('deviceId')
    const range = (searchParams.get('range') || '24h') as AnalyticsTimeRange

    if (!TIME_RANGES[range]) {
      return NextResponse.json({ error: 'Invalid range. Use 24h, 7d, or 30d' }, { status: 400 })
    }

    const since = new Date(Date.now() - TIME_RANGES[range]).toISOString()

    // Fetch history records
    let historyQuery = supabase
      .from('device_status_history')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('checked_at', since)
      .order('checked_at', { ascending: true })

    if (deviceId) {
      historyQuery = historyQuery.eq('device_id', deviceId)
    }

    // Limit to 5000 records to prevent huge payloads
    historyQuery = historyQuery.limit(5000)

    const { data: history, error: historyError } = await historyQuery

    if (historyError) {
      console.error('Analytics history error:', historyError)
      return NextResponse.json({ error: 'Failed to fetch analytics data' }, { status: 500 })
    }

    // Compute uptime stats per device
    const deviceStats = new Map<string, {
      total: number
      online: number
      responseTimes: number[]
    }>()

    for (const record of (history || [])) {
      const existing = deviceStats.get(record.device_id) || {
        total: 0,
        online: 0,
        responseTimes: [],
      }

      existing.total++
      if (record.status === 'online') {
        existing.online++
      }
      if (record.response_time_ms != null) {
        existing.responseTimes.push(record.response_time_ms)
      }

      deviceStats.set(record.device_id, existing)
    }

    // Get device names for the stats
    const deviceIds = Array.from(deviceStats.keys())
    let deviceNames: Record<string, string> = {}

    if (deviceIds.length > 0) {
      const { data: devices } = await supabase
        .from('devices')
        .select('id, name, ip_address')
        .eq('organization_id', organizationId)
        .in('id', deviceIds)

      if (devices) {
        deviceNames = Object.fromEntries(
          devices.map(d => [d.id, d.name || d.ip_address || d.id])
        )
      }
    }

    const uptime: DeviceUptimeStats[] = Array.from(deviceStats.entries()).map(([id, stats]) => ({
      device_id: id,
      device_name: deviceNames[id] || id,
      uptime_percentage: stats.total > 0 ? (stats.online / stats.total) * 100 : 0,
      avg_response_time_ms: stats.responseTimes.length > 0
        ? Math.round(stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length)
        : null,
      total_checks: stats.total,
    }))

    // Sort by uptime ascending (worst first) for easy visibility
    uptime.sort((a, b) => a.uptime_percentage - b.uptime_percentage)

    return NextResponse.json({
      history: history || [],
      uptime,
      range,
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') || 'json'
    const statusFilter = searchParams.get('status') || 'all'

    let query = supabase
      .from('devices')
      .select('id, name, ip_address, status, check_type, last_check, response_time_ms, mac_address, hostname, manufacturer, device_type, is_enabled, created_at')
      .eq('organization_id', membership.organization_id)
      .order('name')

    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter)
    }

    const { data: devices, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 })
    }

    if (format === 'csv') {
      const headers = ['Name', 'IP Address', 'Status', 'Check Type', 'Last Check', 'Response Time (ms)', 'MAC Address', 'Hostname', 'Manufacturer', 'Device Type', 'Enabled', 'Created']
      const rows = (devices || []).map(d => [
        d.name,
        d.ip_address || '',
        d.status,
        d.check_type,
        d.last_check || '',
        d.response_time_ms?.toString() || '',
        d.mac_address || '',
        d.hostname || '',
        d.manufacturer || '',
        d.device_type || '',
        d.is_enabled ? 'Yes' : 'No',
        d.created_at,
      ])

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="devices-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    return NextResponse.json({ devices: devices || [] })
  } catch (error) {
    console.error('Device report error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

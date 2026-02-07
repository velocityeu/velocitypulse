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

    const orgId = membership.organization_id
    const format = request.nextUrl.searchParams.get('format') || 'json'

    // Fetch devices with category and agent names
    const { data: devices, error } = await supabase
      .from('devices')
      .select(`
        name, ip_address, mac_address, hostname, status,
        response_time_ms, last_check, discovered_by,
        category:categories(name),
        agent:agents(name)
      `)
      .eq('organization_id', orgId)
      .order('name')
      .limit(10000)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 })
    }

    if (format === 'csv') {
      const headers = [
        'Name', 'IP Address', 'MAC Address', 'Hostname', 'Status',
        'Category', 'Agent', 'Last Check', 'Response Time (ms)', 'Discovery Method',
      ]

      const rows = (devices || []).map(d => [
        d.name,
        d.ip_address || '',
        d.mac_address || '',
        d.hostname || '',
        d.status,
        ((d.category as unknown as { name: string } | null))?.name || '',
        ((d.agent as unknown as { name: string } | null))?.name || '',
        d.last_check || '',
        d.response_time_ms?.toString() || '',
        d.discovered_by || '',
      ])

      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="devices-export-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    return NextResponse.json({ devices: devices || [] })
  } catch (error) {
    console.error('Device export error:', error)
    return NextResponse.json({ error: 'Failed to export devices' }, { status: 500 })
  }
}

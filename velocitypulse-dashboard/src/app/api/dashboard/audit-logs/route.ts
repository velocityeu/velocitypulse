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

    // Get membership and permissions
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const permissions = (membership.permissions as string[]) || []
    const canView = membership.role === 'owner' || membership.role === 'admin' || permissions.includes('can_view_audit_logs')
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const orgId = membership.organization_id
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const action = searchParams.get('action')
    const search = searchParams.get('search')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const format = searchParams.get('format')
    const offset = (page - 1) * limit

    // Build query scoped to organization
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('organization_id', orgId)

    if (action && action !== 'all') {
      query = query.eq('action', action)
    }

    if (search) {
      query = query.or(
        `actor_id.ilike.%${search}%,resource_id.ilike.%${search}%,action.ilike.%${search}%`
      )
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      const endDateObj = new Date(endDate)
      endDateObj.setDate(endDateObj.getDate() + 1)
      query = query.lt('created_at', endDateObj.toISOString())
    }

    query = query.order('created_at', { ascending: false })

    // CSV export: up to 10,000 records
    if (format === 'csv') {
      query = query.limit(10000)

      const { data: logs, error: queryError } = await query
      if (queryError) throw queryError

      const headers = ['Date', 'Actor Type', 'Actor ID', 'Action', 'Resource Type', 'Resource ID', 'IP Address']
      const rows = (logs || []).map(log => [
        new Date(log.created_at).toISOString(),
        log.actor_type,
        log.actor_id || '',
        log.action,
        log.resource_type,
        log.resource_id || '',
        log.ip_address || '',
      ])

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      })
    }

    // Paginated JSON response
    query = query.range(offset, offset + limit - 1)

    const { data: logs, count, error: queryError } = await query
    if (queryError) throw queryError

    return NextResponse.json({
      logs: logs || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}

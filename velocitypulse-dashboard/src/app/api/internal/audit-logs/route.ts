import { NextRequest, NextResponse } from 'next/server'
import { verifyInternalAccess } from '@/lib/api/internal-auth'
import { supabase } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const { authorized, error } = await verifyInternalAccess()
  if (!authorized) return error

  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const action = searchParams.get('action')
    const orgId = searchParams.get('org_id')
    const actorType = searchParams.get('actor_type')
    const search = searchParams.get('search')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const format = searchParams.get('format') // 'json' or 'csv'
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })

    if (action && action !== 'all') {
      query = query.eq('action', action)
    }

    if (orgId) {
      query = query.eq('organization_id', orgId)
    }

    if (actorType && actorType !== 'all') {
      query = query.eq('actor_type', actorType)
    }

    if (search) {
      query = query.or(
        `organization_id.ilike.%${search}%,actor_id.ilike.%${search}%,resource_id.ilike.%${search}%,action.ilike.%${search}%`
      )
    }

    // Date range filtering
    if (startDate) {
      query = query.gte('created_at', startDate)
    }
    if (endDate) {
      // Add one day to include the end date
      const endDateObj = new Date(endDate)
      endDateObj.setDate(endDateObj.getDate() + 1)
      query = query.lt('created_at', endDateObj.toISOString())
    }

    query = query
      .order('created_at', { ascending: false })

    // For CSV export, get all matching records (up to 10000)
    if (format === 'csv') {
      query = query.limit(10000)
    } else {
      query = query.range(offset, offset + limit - 1)
    }

    const { data: logs, count, error: queryError } = await query

    if (queryError) throw queryError

    // CSV export
    if (format === 'csv') {
      const headers = ['Date', 'Organization ID', 'Actor Type', 'Actor ID', 'Action', 'Resource Type', 'Resource ID', 'IP Address']
      const rows = (logs || []).map(log => [
        new Date(log.created_at).toISOString(),
        log.organization_id,
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
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

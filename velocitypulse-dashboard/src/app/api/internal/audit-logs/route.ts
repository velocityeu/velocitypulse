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

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

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
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

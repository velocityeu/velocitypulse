import { NextRequest, NextResponse } from 'next/server'
import { verifyInternalAccess } from '@/lib/api/internal-auth'
import { supabase } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const { authorized, error } = await verifyInternalAccess()
  if (!authorized) return error

  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const plan = searchParams.get('plan')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build query
    let query = supabase
      .from('organizations')
      .select('*', { count: 'exact' })

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }

    if (plan && plan !== 'all') {
      query = query.eq('plan', plan)
    }

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,customer_number.ilike.%${search}%,slug.ilike.%${search}%`
      )
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data: organizations, count, error: queryError } = await query

    if (queryError) throw queryError

    // Get member, device, and agent counts for each org
    const orgsWithCounts = await Promise.all(
      (organizations || []).map(async (org) => {
        const [members, devices, agents] = await Promise.all([
          supabase
            .from('organization_members')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id),
          supabase
            .from('devices')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id),
          supabase
            .from('agents')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id),
        ])

        return {
          ...org,
          member_count: members.count || 0,
          device_count: devices.count || 0,
          agent_count: agents.count || 0,
        }
      })
    )

    return NextResponse.json({
      organizations: orgsWithCounts,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Failed to fetch organizations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
}

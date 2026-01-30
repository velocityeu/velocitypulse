import { NextRequest, NextResponse } from 'next/server'
import { verifyInternalAccess } from '@/lib/api/internal-auth'
import { supabase } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const { authorized, error } = await verifyInternalAccess()
  if (!authorized) return error

  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      )
    }

    const searchTerm = query.trim()

    // Search by customer number (exact or partial), name, or slug
    const { data: orgs, error: searchError } = await supabase
      .from('organizations')
      .select('*')
      .or(
        `customer_number.ilike.%${searchTerm}%,name.ilike.%${searchTerm}%,slug.ilike.%${searchTerm}%`
      )
      .limit(20)

    if (searchError) throw searchError

    // Get counts for each org
    const results = await Promise.all(
      (orgs || []).map(async (org) => {
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
      results,
      query: searchTerm,
    })
  } catch (error) {
    console.error('Failed to search organizations:', error)
    return NextResponse.json(
      { error: 'Failed to search organizations' },
      { status: 500 }
    )
  }
}

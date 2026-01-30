import { NextResponse } from 'next/server'
import { verifyInternalAccess } from '@/lib/api/internal-auth'
import { supabase } from '@/lib/db/client'

export async function GET() {
  const { authorized, error } = await verifyInternalAccess()
  if (!authorized) return error

  try {
    // Get all trial and recently expired trial organizations
    const { data: orgs, error: queryError } = await supabase
      .from('organizations')
      .select('*')
      .or('status.eq.trial,plan.eq.trial')
      .order('trial_ends_at', { ascending: true })

    if (queryError) throw queryError

    // Get counts for each org
    const trialsWithCounts = await Promise.all(
      (orgs || []).map(async (org) => {
        const [members, devices] = await Promise.all([
          supabase
            .from('organization_members')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id),
          supabase
            .from('devices')
            .select('*', { count: 'exact', head: true })
            .eq('organization_id', org.id),
        ])

        return {
          ...org,
          member_count: members.count || 0,
          device_count: devices.count || 0,
        }
      })
    )

    return NextResponse.json({
      trials: trialsWithCounts,
    })
  } catch (error) {
    console.error('Failed to fetch trials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trials' },
      { status: 500 }
    )
  }
}

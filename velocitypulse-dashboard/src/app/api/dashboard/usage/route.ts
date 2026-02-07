import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS } from '@/lib/constants'

export async function GET() {
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

    // Get org details for plan info
    const { data: org } = await supabase
      .from('organizations')
      .select('plan, device_limit, agent_limit, user_limit')
      .eq('id', orgId)
      .single()

    // Get counts in parallel
    const [deviceCount, agentCount, memberCount, recentActivity] = await Promise.all([
      supabase.from('devices').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('agents').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('audit_logs')
        .select('action, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const plan = (org?.plan || 'trial') as keyof typeof PLAN_LIMITS
    const limits = PLAN_LIMITS[plan]

    return NextResponse.json({
      usage: {
        devices: { current: deviceCount.count || 0, limit: org?.device_limit || limits.devices },
        agents: { current: agentCount.count || 0, limit: org?.agent_limit || limits.agents },
        members: { current: memberCount.count || 0, limit: org?.user_limit || limits.users },
      },
      plan: org?.plan || 'trial',
      recentActivity: recentActivity.data || [],
    })
  } catch (error) {
    console.error('Usage fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 })
  }
}

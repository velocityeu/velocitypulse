import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS } from '@/lib/constants'

function calcPercentage(current: number, limit: number): number {
  if (limit === -1) return 0
  if (limit === 0) return 100
  return Math.round((current / limit) * 100)
}

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

    const plan = (org?.plan || 'trial') as keyof typeof PLAN_LIMITS
    const limits = PLAN_LIMITS[plan]

    // Current year-month for API usage lookup
    const now = new Date()
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    // Get counts in parallel
    const [deviceCount, agentCount, memberCount, apiUsage, recentActivity] = await Promise.all([
      supabase.from('devices').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('agents').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('organization_members').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
      supabase.from('api_usage_monthly')
        .select('call_count')
        .eq('organization_id', orgId)
        .eq('year_month', yearMonth)
        .single(),
      supabase.from('audit_logs')
        .select('action, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    const deviceCurrent = deviceCount.count || 0
    const deviceLimit = org?.device_limit || limits.devices
    const agentCurrent = agentCount.count || 0
    const agentLimit = org?.agent_limit || limits.agents
    const memberCurrent = memberCount.count || 0
    const memberLimit = org?.user_limit || limits.users
    const apiCallsCurrent = apiUsage.data?.call_count || 0
    const apiCallsLimit = limits.apiCallsPerMonth

    return NextResponse.json({
      usage: {
        devices: {
          current: deviceCurrent,
          limit: deviceLimit,
          percentage: calcPercentage(deviceCurrent, deviceLimit),
        },
        agents: {
          current: agentCurrent,
          limit: agentLimit,
          percentage: calcPercentage(agentCurrent, agentLimit),
        },
        members: {
          current: memberCurrent,
          limit: memberLimit,
          percentage: calcPercentage(memberCurrent, memberLimit),
        },
        apiCalls: {
          current: apiCallsCurrent,
          limit: apiCallsLimit,
          percentage: calcPercentage(apiCallsCurrent, apiCallsLimit),
          period: yearMonth,
        },
      },
      plan: org?.plan || 'trial',
      recentActivity: recentActivity.data || [],
    })
  } catch (error) {
    console.error('Usage fetch error:', error)
    return NextResponse.json({ error: 'Failed to fetch usage data' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { verifyInternalAccess } from '@/lib/api/internal-auth'
import { supabase } from '@/lib/db/client'

export async function GET() {
  const { authorized, error } = await verifyInternalAccess()
  if (!authorized) return error

  try {
    // Get organization counts by status
    const { data: orgStats, error: orgError } = await supabase
      .from('organizations')
      .select('status, plan')

    if (orgError) throw orgError

    // Calculate metrics
    const totalOrgs = orgStats?.length || 0
    const activeOrgs = orgStats?.filter(o => o.status === 'active').length || 0
    const trialOrgs = orgStats?.filter(o => o.status === 'trial').length || 0
    const pastDueOrgs = orgStats?.filter(o => o.status === 'past_due').length || 0
    const suspendedOrgs = orgStats?.filter(o => o.status === 'suspended').length || 0
    const cancelledOrgs = orgStats?.filter(o => o.status === 'cancelled').length || 0

    // Calculate MRR (simplified - in production would use Stripe data)
    const starterOrgs = orgStats?.filter(o => o.plan === 'starter' && o.status === 'active').length || 0
    const unlimitedOrgs = orgStats?.filter(o => o.plan === 'unlimited' && o.status === 'active').length || 0

    // Starter: $50/year = $4.17/month, Unlimited: $950/year = $79.17/month
    const mrr = Math.round((starterOrgs * 4.17 + unlimitedOrgs * 79.17) * 100)
    const arr = mrr * 12

    // Get recent trial conversions (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: conversions, error: convError } = await supabase
      .from('audit_logs')
      .select('id')
      .eq('action', 'subscription.created')
      .gte('created_at', thirtyDaysAgo.toISOString())

    if (convError) throw convError

    const trialConversions = conversions?.length || 0

    // Get total users and devices
    const { count: userCount } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })

    const { count: deviceCount } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true })

    const { count: agentCount } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      organizations: {
        total: totalOrgs,
        active: activeOrgs,
        trial: trialOrgs,
        past_due: pastDueOrgs,
        suspended: suspendedOrgs,
        cancelled: cancelledOrgs,
      },
      revenue: {
        mrr,
        arr,
      },
      conversions: {
        trial_to_paid_30d: trialConversions,
      },
      usage: {
        total_users: userCount || 0,
        total_devices: deviceCount || 0,
        total_agents: agentCount || 0,
      },
    })
  } catch (error) {
    console.error('Failed to fetch metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

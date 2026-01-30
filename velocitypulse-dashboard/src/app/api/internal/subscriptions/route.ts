import { NextRequest, NextResponse } from 'next/server'
import { verifyInternalAccess } from '@/lib/api/internal-auth'
import { supabase } from '@/lib/db/client'

export async function GET(request: NextRequest) {
  const { authorized, error } = await verifyInternalAccess()
  if (!authorized) return error

  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const plan = searchParams.get('plan')
    const limit = parseInt(searchParams.get('limit') || '100', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Build query
    let query = supabase
      .from('subscriptions')
      .select(`
        *,
        organizations (
          id,
          name,
          slug,
          customer_number
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status) {
      query = query.eq('status', status)
    }
    if (plan) {
      query = query.eq('plan', plan)
    }

    const { data: subscriptions, count, error: fetchError } = await query

    if (fetchError) {
      console.error('Failed to fetch subscriptions:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      )
    }

    // Calculate metrics
    const activeSubscriptions = subscriptions?.filter(s => s.status === 'active') || []
    const pastDueCount = subscriptions?.filter(s => s.status === 'past_due').length || 0
    const cancelledCount = subscriptions?.filter(s => s.status === 'cancelled').length || 0

    // MRR is monthly recurring revenue (annual amount / 12)
    const mrr = activeSubscriptions.reduce((sum, s) => sum + (s.amount_cents / 12), 0)
    const arr = mrr * 12

    return NextResponse.json({
      subscriptions: subscriptions?.map(sub => ({
        id: sub.id,
        organization_id: sub.organization_id,
        organization_name: sub.organizations?.name || 'Unknown',
        stripe_subscription_id: sub.stripe_subscription_id,
        plan: sub.plan,
        status: sub.status,
        amount_cents: sub.amount_cents,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        created_at: sub.created_at,
      })) || [],
      total: count || 0,
      metrics: {
        mrr: Math.round(mrr),
        arr: Math.round(arr),
        activeCount: activeSubscriptions.length,
        pastDueCount,
        cancelledCount,
        churnRate: cancelledCount / Math.max(1, activeSubscriptions.length + cancelledCount) * 100,
      },
    })
  } catch (error) {
    console.error('Subscriptions error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    )
  }
}

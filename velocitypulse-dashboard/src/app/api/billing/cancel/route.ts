import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

let stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    stripe = new Stripe(apiKey, {
      apiVersion: '2026-01-28.clover',
      maxNetworkRetries: 3,
      timeout: 30000,
    })
  }
  return stripe
}

export async function POST() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get user's membership and org
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Check billing permissions
    const canManageBilling =
      membership.role === 'owner' ||
      membership.role === 'admin' ||
      membership.permissions?.can_manage_billing === true

    if (!canManageBilling) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get org details
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id, stripe_subscription_id, plan')
      .eq('id', membership.organization_id)
      .single()

    if (!org?.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 404 })
    }

    const stripeClient = getStripe()

    // Schedule cancellation at end of billing period
    const updated = await stripeClient.subscriptions.update(org.stripe_subscription_id, {
      cancel_at_period_end: true,
    })

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      actor_type: 'user',
      actor_id: userId,
      action: 'subscription.cancel_scheduled',
      resource_type: 'subscription',
      resource_id: org.stripe_subscription_id,
    })

    return NextResponse.json({
      success: true,
      cancel_at_period_end: true,
      current_period_end: new Date(
        (updated.items.data[0]?.current_period_end ?? 0) * 1000
      ).toISOString(),
    })
  } catch (error) {
    logger.error('Cancel subscription error', error, { route: 'api/billing/cancel' })
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}

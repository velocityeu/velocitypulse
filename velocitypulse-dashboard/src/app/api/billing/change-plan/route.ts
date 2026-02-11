import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { PLAN_LIMITS } from '@/lib/constants'
import { resolvePaidPlanFromPriceId } from '@/lib/stripe-pricing'

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

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { priceId } = body

    if (!priceId) {
      return NextResponse.json({ error: 'Missing priceId' }, { status: 400 })
    }

    const newPlan = resolvePaidPlanFromPriceId(priceId)
    if (!newPlan) {
      return NextResponse.json(
        { error: 'Invalid priceId. Only starter and unlimited plans are allowed.' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const requestedOrgId = request.headers.get('x-organization-id')?.trim()

    // Get user's membership and org
    let membershipQuery = supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
    if (requestedOrgId) {
      membershipQuery = membershipQuery.eq('organization_id', requestedOrgId)
    }
    const { data: membership } = await membershipQuery
      .order('created_at', { ascending: true })
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

    const oldPlan = org.plan

    // Retrieve subscription to get the item ID
    const sub = await stripeClient.subscriptions.retrieve(org.stripe_subscription_id)
    const itemId = sub.items.data[0].id

    // Update subscription with new price
    await stripeClient.subscriptions.update(org.stripe_subscription_id, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'create_prorations',
    })

    // Update organization with new plan limits
    const limits = PLAN_LIMITS[newPlan]
    await supabase
      .from('organizations')
      .update({
        plan: newPlan,
        device_limit: limits.devices,
        agent_limit: limits.agents,
        user_limit: limits.users,
      })
      .eq('id', membership.organization_id)

    // Update subscription record
    await supabase
      .from('subscriptions')
      .update({ plan: newPlan })
      .eq('stripe_subscription_id', org.stripe_subscription_id)

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      actor_type: 'user',
      actor_id: userId,
      action: 'subscription.plan_changed',
      resource_type: 'subscription',
      resource_id: org.stripe_subscription_id,
      metadata: { old_plan: oldPlan, new_plan: newPlan, price_id: priceId },
    })

    return NextResponse.json({ success: true, plan: newPlan })
  } catch (error) {
    logger.error('Change plan error', error, { route: 'api/billing/change-plan' })
    return NextResponse.json(
      { error: 'Failed to change plan' },
      { status: 500 }
    )
  }
}

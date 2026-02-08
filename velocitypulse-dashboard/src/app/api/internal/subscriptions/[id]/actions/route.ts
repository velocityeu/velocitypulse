import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { verifyInternalAccess, hasAdminRole } from '@/lib/api/internal-auth'
import { createServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/logger'

let stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) throw new Error('STRIPE_SECRET_KEY is not configured')
    stripe = new Stripe(apiKey, {
      apiVersion: '2026-01-28.clover',
      maxNetworkRetries: 3,
      timeout: 30000,
    })
  }
  return stripe
}

/**
 * POST /api/internal/subscriptions/[id]/actions
 * Perform admin actions on a subscription
 *
 * Supported actions: cancel, suspend, resume, change_plan, refund
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await verifyInternalAccess()
  if (!access.authorized) return access.error!

  // Only billing_admin or super_admin can manage subscriptions
  if (!hasAdminRole(access.adminRole, 'billing_admin')) {
    return NextResponse.json({ error: 'Insufficient admin role' }, { status: 403 })
  }

  const { id } = await params

  let body: { action: string; [key: string]: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { action } = body

  try {
    const supabase = createServiceClient()

    // Get subscription
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('*, organizations(id, name, stripe_customer_id)')
      .eq('id', id)
      .single()

    if (subError || !sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    const stripeClient = getStripe()

    switch (action) {
      case 'cancel': {
        if (!sub.stripe_subscription_id) {
          return NextResponse.json({ error: 'No Stripe subscription to cancel' }, { status: 400 })
        }

        await stripeClient.subscriptions.cancel(sub.stripe_subscription_id)

        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', id)

        // Log admin action
        await supabase.from('admin_audit_logs').insert({
          actor_id: access.userId!,
          actor_email: access.email,
          action: 'subscription.cancelled',
          resource_type: 'subscription',
          resource_id: id,
          organization_id: sub.organization_id,
          metadata: { stripe_subscription_id: sub.stripe_subscription_id },
        })

        return NextResponse.json({ success: true, message: 'Subscription cancelled' })
      }

      case 'suspend': {
        if (!sub.stripe_subscription_id) {
          return NextResponse.json({ error: 'No Stripe subscription to suspend' }, { status: 400 })
        }

        await stripeClient.subscriptions.update(sub.stripe_subscription_id, {
          pause_collection: { behavior: 'void' },
        })

        await supabase
          .from('organizations')
          .update({ status: 'suspended', suspended_at: new Date().toISOString() })
          .eq('id', sub.organization_id)

        await supabase.from('admin_audit_logs').insert({
          actor_id: access.userId!,
          actor_email: access.email,
          action: 'subscription.suspended',
          resource_type: 'subscription',
          resource_id: id,
          organization_id: sub.organization_id,
        })

        return NextResponse.json({ success: true, message: 'Subscription suspended' })
      }

      case 'resume': {
        if (!sub.stripe_subscription_id) {
          return NextResponse.json({ error: 'No Stripe subscription to resume' }, { status: 400 })
        }

        await stripeClient.subscriptions.update(sub.stripe_subscription_id, {
          pause_collection: null,
        })

        await supabase
          .from('organizations')
          .update({ status: 'active', suspended_at: null })
          .eq('id', sub.organization_id)

        await supabase.from('admin_audit_logs').insert({
          actor_id: access.userId!,
          actor_email: access.email,
          action: 'subscription.resumed',
          resource_type: 'subscription',
          resource_id: id,
          organization_id: sub.organization_id,
        })

        return NextResponse.json({ success: true, message: 'Subscription resumed' })
      }

      case 'change_plan': {
        const newPlan = body.plan as string
        if (!newPlan || !['starter', 'unlimited'].includes(newPlan)) {
          return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
        }

        if (!sub.stripe_subscription_id) {
          return NextResponse.json({ error: 'No Stripe subscription to update' }, { status: 400 })
        }

        // Get the subscription items to update
        const stripeSub = await stripeClient.subscriptions.retrieve(sub.stripe_subscription_id)
        const itemId = stripeSub.items.data[0]?.id
        if (!itemId) {
          return NextResponse.json({ error: 'No subscription item found' }, { status: 400 })
        }

        // Look up the new price from env
        const priceId = newPlan === 'starter'
          ? process.env.STRIPE_STARTER_PRICE_ID
          : process.env.STRIPE_UNLIMITED_PRICE_ID

        if (!priceId) {
          return NextResponse.json({ error: 'Price configuration missing' }, { status: 500 })
        }

        await stripeClient.subscriptions.update(sub.stripe_subscription_id, {
          items: [{ id: itemId, price: priceId }],
          proration_behavior: 'create_prorations',
        })

        await supabase
          .from('subscriptions')
          .update({ plan: newPlan, updated_at: new Date().toISOString() })
          .eq('id', id)

        await supabase
          .from('organizations')
          .update({ plan: newPlan })
          .eq('id', sub.organization_id)

        await supabase.from('admin_audit_logs').insert({
          actor_id: access.userId!,
          actor_email: access.email,
          action: 'subscription.plan_changed',
          resource_type: 'subscription',
          resource_id: id,
          organization_id: sub.organization_id,
          metadata: { old_plan: sub.plan, new_plan: newPlan },
        })

        return NextResponse.json({ success: true, message: `Plan changed to ${newPlan}` })
      }

      case 'refund': {
        const amountCents = body.amount_cents as number
        const paymentIntentId = body.payment_intent_id as string

        if (!paymentIntentId) {
          return NextResponse.json({ error: 'payment_intent_id required' }, { status: 400 })
        }

        const refundParams: Stripe.RefundCreateParams = {
          payment_intent: paymentIntentId,
        }
        if (amountCents && amountCents > 0) {
          refundParams.amount = amountCents
        }

        const refund = await stripeClient.refunds.create(refundParams)

        await supabase.from('admin_audit_logs').insert({
          actor_id: access.userId!,
          actor_email: access.email,
          action: 'subscription.refunded',
          resource_type: 'subscription',
          resource_id: id,
          organization_id: sub.organization_id,
          metadata: {
            refund_id: refund.id,
            amount: refund.amount,
            currency: refund.currency,
            payment_intent_id: paymentIntentId,
          },
        })

        return NextResponse.json({ success: true, message: 'Refund processed', refund_id: refund.id })
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    logger.error('Subscription action error', error, { route: 'api/internal/subscriptions/[id]/actions' })
    const message = error instanceof Error ? error.message : 'Action failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

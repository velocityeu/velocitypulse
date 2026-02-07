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

    if (!org?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
    }

    const stripeClient = getStripe()

    // Create SetupIntent for collecting new payment method
    const setupIntent = await stripeClient.setupIntents.create({
      customer: org.stripe_customer_id,
    })

    return NextResponse.json({ clientSecret: setupIntent.client_secret })
  } catch (error) {
    logger.error('Create setup intent error', error, { route: 'api/billing/update-payment' })
    return NextResponse.json(
      { error: 'Failed to create setup intent' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { paymentMethodId } = body

    if (!paymentMethodId) {
      return NextResponse.json({ error: 'Missing paymentMethodId' }, { status: 400 })
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

    if (!org?.stripe_customer_id) {
      return NextResponse.json({ error: 'No billing account found' }, { status: 404 })
    }

    const stripeClient = getStripe()

    // Attach payment method to customer
    await stripeClient.paymentMethods.attach(paymentMethodId, {
      customer: org.stripe_customer_id,
    })

    // Set as default payment method
    await stripeClient.customers.update(org.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    // If org has a subscription, also update its default payment method
    if (org.stripe_subscription_id) {
      await stripeClient.subscriptions.update(org.stripe_subscription_id, {
        default_payment_method: paymentMethodId,
      })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      actor_type: 'user',
      actor_id: userId,
      action: 'billing.payment_method_updated',
      resource_type: 'payment_method',
      resource_id: paymentMethodId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Update payment method error', error, { route: 'api/billing/update-payment' })
    return NextResponse.json(
      { error: 'Failed to update payment method' },
      { status: 500 }
    )
  }
}

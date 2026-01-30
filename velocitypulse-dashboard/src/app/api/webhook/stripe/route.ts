import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS } from '@/lib/constants'

// Lazy initialization to avoid build-time errors
let stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!stripe) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured')
    }
    stripe = new Stripe(apiKey, {
      apiVersion: '2026-01-28.clover',
    })
  }
  return stripe
}

function getWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured')
  }
  return secret
}

// Helper type for subscription data we need
interface SubscriptionData {
  id: string
  status: string
  customer: string | { id: string }
  current_period_start: number
  current_period_end: number
  items: {
    data: Array<{
      price: {
        id: string
        unit_amount: number | null
      }
    }>
  }
}

function getCustomerId(customer: string | { id: string } | null | undefined): string | null {
  if (!customer) return null
  return typeof customer === 'string' ? customer : customer.id
}

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  let event: Stripe.Event
  const stripeClient = getStripe()
  const webhookSecret = getWebhookSecret()

  try {
    event = stripeClient.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode === 'subscription' && session.subscription) {
          const subscriptionResponse = await stripeClient.subscriptions.retrieve(session.subscription as string)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const subscription = subscriptionResponse as any as SubscriptionData
          const customerId = session.customer as string
          const priceId = subscription.items.data[0]?.price.id

          // Determine plan from price ID
          const plan = priceId === process.env.STRIPE_UNLIMITED_PRICE_ID ? 'unlimited' : 'starter'
          const limits = plan === 'unlimited' ? PLAN_LIMITS.unlimited : PLAN_LIMITS.starter

          // Get organization ID first
          const { data: orgData } = await supabase
            .from('organizations')
            .select('id')
            .eq('stripe_customer_id', customerId)
            .single()

          const orgId = orgData?.id

          // Update organization
          const { error: updateError } = await supabase
            .from('organizations')
            .update({
              stripe_subscription_id: subscription.id,
              plan,
              status: 'active',
              device_limit: limits.devices,
              agent_limit: limits.agents,
              user_limit: limits.users,
              trial_ends_at: null,
            })
            .eq('stripe_customer_id', customerId)

          if (updateError) {
            console.error('Failed to update organization:', updateError)
          }

          // Create subscription record
          if (orgId) {
            await supabase.from('subscriptions').insert({
              organization_id: orgId,
              stripe_subscription_id: subscription.id,
              plan,
              status: 'active',
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              amount_cents: subscription.items.data[0]?.price.unit_amount || 0,
            })

            // Create audit log
            await supabase.from('audit_logs').insert({
              organization_id: orgId,
              actor_type: 'webhook',
              actor_id: 'stripe',
              action: 'subscription.created',
              resource_type: 'subscription',
              resource_id: subscription.id,
              metadata: { plan, price_id: priceId },
            })
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any as SubscriptionData
        const customerId = getCustomerId(subscription.customer)
        if (!customerId) break

        // Get organization
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (org) {
          // Update subscription status
          const status = subscription.status === 'active' ? 'active' :
                        subscription.status === 'past_due' ? 'past_due' :
                        subscription.status === 'canceled' ? 'cancelled' : 'incomplete'

          await supabase
            .from('subscriptions')
            .update({
              status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            })
            .eq('stripe_subscription_id', subscription.id)

          // Update organization status
          await supabase
            .from('organizations')
            .update({
              status: status === 'cancelled' ? 'cancelled' : status,
            })
            .eq('id', org.id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const subscription = event.data.object as any as SubscriptionData
        const customerId = getCustomerId(subscription.customer)
        if (!customerId) break

        // Get organization
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (org) {
          await supabase
            .from('organizations')
            .update({
              status: 'cancelled',
              cancelled_at: new Date().toISOString(),
            })
            .eq('id', org.id)

          await supabase
            .from('subscriptions')
            .update({ status: 'cancelled' })
            .eq('stripe_subscription_id', subscription.id)

          // Audit log
          await supabase.from('audit_logs').insert({
            organization_id: org.id,
            actor_type: 'webhook',
            actor_id: 'stripe',
            action: 'subscription.cancelled',
            resource_type: 'subscription',
            resource_id: subscription.id,
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const customerId = getCustomerId(invoice.customer as any)
        if (!customerId) break

        // Get organization
        const { data: org } = await supabase
          .from('organizations')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (org) {
          await supabase
            .from('organizations')
            .update({ status: 'past_due' })
            .eq('id', org.id)

          // Audit log
          await supabase.from('audit_logs').insert({
            organization_id: org.id,
            actor_type: 'webhook',
            actor_id: 'stripe',
            action: 'subscription.payment_failed',
            resource_type: 'invoice',
            resource_id: invoice.id ?? '',
            metadata: { amount: invoice.amount_due },
          })

          // TODO: Send payment failed email via Resend
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const customerId = getCustomerId(invoice.customer as any)
        if (!customerId) break

        // Get organization
        const { data: org } = await supabase
          .from('organizations')
          .select('id, status')
          .eq('stripe_customer_id', customerId)
          .single()

        if (org && org.status === 'past_due') {
          await supabase
            .from('organizations')
            .update({ status: 'active' })
            .eq('id', org.id)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

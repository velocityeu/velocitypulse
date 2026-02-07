import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS } from '@/lib/constants'
import { logger } from '@/lib/logger'
import {
  sendSubscriptionActivatedEmail,
  sendSubscriptionCancelledEmail,
  sendPaymentFailedEmail,
} from '@/lib/emails/lifecycle'

// Force Node.js runtime (not Edge) - required for Stripe
export const runtime = 'nodejs'

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
      maxNetworkRetries: 3,
      timeout: 30000,
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

/**
 * Safely extract customer ID from Stripe customer field
 * Handles string, Customer, and DeletedCustomer types
 */
function getCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | null {
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
    logger.error('Webhook signature verification failed', err, { route: 'api/webhook/stripe' })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode === 'subscription' && session.subscription) {
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id
          const subscriptionResponse = await stripeClient.subscriptions.retrieve(subscriptionId)
          const subscription = subscriptionResponse as unknown as Stripe.Subscription
          const customerId = getCustomerId(session.customer)
          if (!customerId) break

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
            logger.error('Failed to update organization', updateError, { route: 'api/webhook/stripe' })
          }

          // Create subscription record
          if (orgId) {
            await supabase.from('subscriptions').insert({
              organization_id: orgId,
              stripe_subscription_id: subscription.id,
              plan,
              status: 'active',
              current_period_start: new Date((subscription.items.data[0]?.current_period_start ?? 0) * 1000).toISOString(),
              current_period_end: new Date((subscription.items.data[0]?.current_period_end ?? 0) * 1000).toISOString(),
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

            // Send subscription activated email
            const recipients = await getOrgRecipients(supabase, orgId)
            const { data: orgForEmail } = await supabase
              .from('organizations')
              .select('name')
              .eq('id', orgId)
              .single()
            if (orgForEmail && recipients.length > 0) {
              sendSubscriptionActivatedEmail(orgForEmail.name, plan, recipients).catch(err =>
                logger.error('[Webhook] Failed to send activation email', err, { route: 'api/webhook/stripe' })
              )
            }
          }
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = getCustomerId(subscription.customer)
        if (!customerId) break

        // Get organization
        const { data: org } = await supabase
          .from('organizations')
          .select('id, plan')
          .eq('stripe_customer_id', customerId)
          .single()

        if (org) {
          // Update subscription status
          const status = subscription.status === 'active' ? 'active' :
                        subscription.status === 'past_due' ? 'past_due' :
                        subscription.status === 'canceled' ? 'cancelled' : 'incomplete'

          // Detect plan change from price ID
          const priceId = subscription.items.data[0]?.price.id
          const newPlan = priceId === process.env.STRIPE_UNLIMITED_PRICE_ID ? 'unlimited' : 'starter'

          await supabase
            .from('subscriptions')
            .update({
              status,
              plan: newPlan,
              current_period_start: new Date((subscription.items.data[0]?.current_period_start ?? 0) * 1000).toISOString(),
              current_period_end: new Date((subscription.items.data[0]?.current_period_end ?? 0) * 1000).toISOString(),
              amount_cents: subscription.items.data[0]?.price.unit_amount || 0,
            })
            .eq('stripe_subscription_id', subscription.id)

          // Update organization status + plan/limits if plan changed
          const orgUpdate: Record<string, unknown> = {
            status: status === 'cancelled' ? 'cancelled' : status,
          }

          if (newPlan !== org.plan && (status === 'active' || status === 'past_due')) {
            const limits = newPlan === 'unlimited' ? PLAN_LIMITS.unlimited : PLAN_LIMITS.starter
            orgUpdate.plan = newPlan
            orgUpdate.device_limit = limits.devices
            orgUpdate.agent_limit = limits.agents
            orgUpdate.user_limit = limits.users
          }

          await supabase
            .from('organizations')
            .update(orgUpdate)
            .eq('id', org.id)

          // Audit log if plan changed
          if (newPlan !== org.plan) {
            await supabase.from('audit_logs').insert({
              organization_id: org.id,
              actor_type: 'webhook',
              actor_id: 'stripe',
              action: 'subscription.plan_changed',
              resource_type: 'subscription',
              resource_id: subscription.id,
              metadata: { old_plan: org.plan, new_plan: newPlan, price_id: priceId },
            })
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
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

          // Send cancellation email
          const cancelRecipients = await getOrgRecipients(supabase, org.id)
          const { data: cancelOrg } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', org.id)
            .single()
          if (cancelOrg && cancelRecipients.length > 0) {
            sendSubscriptionCancelledEmail(cancelOrg.name, cancelRecipients).catch(err =>
              logger.error('[Webhook] Failed to send cancellation email', err, { route: 'api/webhook/stripe' })
            )
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = getCustomerId(invoice.customer)
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

          // Send payment failure notification email
          const failRecipients = await getOrgRecipients(supabase, org.id)
          const { data: failOrg } = await supabase
            .from('organizations')
            .select('name')
            .eq('id', org.id)
            .single()
          if (failOrg && failRecipients.length > 0) {
            const amountFormatted = invoice.amount_due
              ? `${(invoice.amount_due / 100).toFixed(2)}`
              : 'unknown'
            const currency = (invoice.currency ?? 'gbp').toUpperCase()
            sendPaymentFailedEmail(failOrg.name, amountFormatted, currency, failRecipients).catch(err =>
              logger.error('[Webhook] Failed to send payment failed email', err, { route: 'api/webhook/stripe' })
            )
          }
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = getCustomerId(invoice.customer)
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
    logger.error('Webhook error', error, { route: 'api/webhook/stripe' })
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

/**
 * Get email addresses of owners and admins for an organization.
 * Joins organization_members with users table to resolve emails.
 */
async function getOrgRecipients(
  supabase: ReturnType<typeof createServiceClient>,
  orgId: string
): Promise<string[]> {
  const { data: members } = await supabase
    .from('organization_members')
    .select('user_id, role')
    .eq('organization_id', orgId)
    .in('role', ['owner', 'admin'])

  if (!members || members.length === 0) return []

  const userIds = members.map(m => m.user_id)
  const { data: users } = await supabase
    .from('users')
    .select('email')
    .in('id', userIds)

  return users?.map(u => u.email).filter(Boolean) ?? []
}

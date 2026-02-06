import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS } from '@/lib/constants'

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
    console.error('Webhook signature verification failed:', err)
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
            console.error('Failed to update organization:', updateError)
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
              current_period_start: new Date((subscription.items.data[0]?.current_period_start ?? 0) * 1000).toISOString(),
              current_period_end: new Date((subscription.items.data[0]?.current_period_end ?? 0) * 1000).toISOString(),
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
          await sendPaymentFailedEmail(org.id, invoice, supabase)
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
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

/**
 * Send payment failed email to org owners/admins via Resend
 */
async function sendPaymentFailedEmail(
  orgId: string,
  invoice: Stripe.Invoice,
  supabase: SupabaseClient
) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[PaymentFailedEmail] RESEND_API_KEY not configured, skipping email')
    return
  }

  // Get org name and owner/admin emails
  const { data: org } = await supabase
    .from('organizations')
    .select('name')
    .eq('id', orgId)
    .single()

  const { data: members } = await supabase
    .from('organization_members')
    .select('email, role')
    .eq('organization_id', orgId)
    .in('role', ['owner', 'admin'])

  const recipients = members?.map((m) => m.email).filter(Boolean) ?? []
  if (recipients.length === 0) {
    console.warn('[PaymentFailedEmail] No owner/admin emails found for org:', orgId)
    return
  }

  const orgName = org?.name ?? 'your organization'
  const amountFormatted = invoice.amount_due
    ? `${(invoice.amount_due / 100).toFixed(2)}`
    : 'unknown'
  const currency = (invoice.currency ?? 'gbp').toUpperCase()
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.velocitypulse.io'}/settings/billing`

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'VelocityPulse <billing@velocitypulse.io>',
        to: recipients,
        subject: `[Action Required] Payment failed for ${orgName}`,
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="background-color: #dc2626; padding: 20px; color: white;">
      <h1 style="margin: 0; font-size: 20px;">Payment Failed</h1>
    </div>
    <div style="padding: 20px;">
      <p>We were unable to process the payment of <strong>${currency} ${amountFormatted}</strong> for <strong>${orgName}</strong>.</p>
      <p>Please update your payment method to avoid any interruption to your service.</p>
      <p style="margin-top: 24px;">
        <a href="${portalUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">Update Payment Method</a>
      </p>
      <p style="color: #666; font-size: 14px; margin-top: 24px;">If you believe this is an error, please contact us at <a href="mailto:support@velocitypulse.io" style="color: #2563eb;">support@velocitypulse.io</a>.</p>
    </div>
    <div style="padding: 15px 20px; background-color: #f9f9f9; border-top: 1px solid #eee; font-size: 12px; color: #666;">
      Sent by <a href="https://velocitypulse.io" style="color: #2563eb; text-decoration: none;">VelocityPulse</a>
    </div>
  </div>
</body>
</html>`,
      }),
    })
  } catch (error) {
    console.error('[PaymentFailedEmail] Failed to send:', error)
  }
}

import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS } from '@/lib/constants'
import { logger } from '@/lib/logger'
import { resolvePaidPlanFromPriceId } from '@/lib/stripe-pricing'
import {
  sendSubscriptionActivatedEmail,
  sendSubscriptionCancelledEmail,
  sendPaymentFailedEmail,
} from '@/lib/emails/lifecycle'
import {
  acquireStripeWebhookEventProcessing,
  markStripeWebhookEventFailed,
  markStripeWebhookEventProcessed,
} from '@/lib/stripe-webhook-events'
import {
  isStripeEventStale,
  mapStripeSubscriptionStatus,
  type LocalSubscriptionStatus,
} from '@/lib/stripe-webhook-lifecycle'

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

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const code = (error as { code?: string }).code
  if (code === '23505') return true

  const message = (error as { message?: string }).message || ''
  return /duplicate key/i.test(message)
}

interface OrganizationStripeState {
  id: string
  name: string
  plan: string
  status: string
  stripe_last_event_created: number | null
}

interface SubscriptionStripeState {
  id: string
  stripe_last_event_created: number | null
}

async function getOrganizationByCustomerId(
  supabase: ReturnType<typeof createServiceClient>,
  customerId: string
): Promise<OrganizationStripeState | null> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, plan, status, stripe_last_event_created')
    .eq('stripe_customer_id', customerId)
    .maybeSingle<OrganizationStripeState>()

  if (error) {
    throw error
  }

  return data ?? null
}

async function getSubscriptionState(
  supabase: ReturnType<typeof createServiceClient>,
  stripeSubscriptionId: string
): Promise<SubscriptionStripeState | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, stripe_last_event_created')
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .maybeSingle<SubscriptionStripeState>()

  if (error) {
    throw error
  }

  return data ?? null
}

async function updateOrganizationForEvent(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  event: Stripe.Event,
  payload: Record<string, unknown>
): Promise<boolean> {
  const { data, error } = await supabase
    .from('organizations')
    .update({
      ...payload,
      stripe_last_event_created: event.created,
      stripe_last_event_id: event.id,
    })
    .eq('id', organizationId)
    .lte('stripe_last_event_created', event.created)
    .select('id')

  if (error) {
    throw error
  }

  return (data?.length ?? 0) > 0
}

async function upsertSubscriptionForEvent(
  supabase: ReturnType<typeof createServiceClient>,
  stripeSubscriptionId: string,
  event: Stripe.Event,
  payload: Record<string, unknown>
): Promise<boolean> {
  const { data: updatedRows, error: updateError } = await supabase
    .from('subscriptions')
    .update({
      ...payload,
      stripe_last_event_created: event.created,
      stripe_last_event_id: event.id,
    })
    .eq('stripe_subscription_id', stripeSubscriptionId)
    .lte('stripe_last_event_created', event.created)
    .select('id')

  if (updateError) {
    throw updateError
  }

  if ((updatedRows?.length ?? 0) > 0) {
    return true
  }

  const existing = await getSubscriptionState(supabase, stripeSubscriptionId)
  if (existing) {
    return !isStripeEventStale(event.created, existing.stripe_last_event_created)
  }

  const { error: insertError } = await supabase
    .from('subscriptions')
    .insert({
      stripe_subscription_id: stripeSubscriptionId,
      ...payload,
      stripe_last_event_created: event.created,
      stripe_last_event_id: event.id,
    })

  if (!insertError) {
    return true
  }

  if (isUniqueViolation(insertError)) {
    return true
  }

  throw insertError
}

async function safeInsertAuditLog(
  supabase: ReturnType<typeof createServiceClient>,
  payload: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert(payload)
  if (error) {
    logger.error('Failed to insert Stripe webhook audit log', error, {
      route: 'api/webhook/stripe',
      action: payload.action,
      organizationId: payload.organization_id,
    })
  }
}

async function sendWebhookLifecycleEmail(
  supabase: ReturnType<typeof createServiceClient>,
  organizationId: string,
  templateKey: string,
  recipients: string[],
  eventId: string,
  sendFn: () => Promise<boolean>,
  context: Record<string, unknown>
): Promise<void> {
  try {
    const sent = await sendFn()
    const { error: deliveryLogError } = await supabase
      .from('outbound_email_deliveries')
      .insert({
        organization_id: organizationId,
        source: 'stripe_webhook',
        template_key: templateKey,
        event_id: eventId,
        recipients,
        provider: 'resend',
        status: sent ? 'sent' : 'failed',
        error_message: sent ? null : 'Provider returned unsuccessful send result',
        metadata: context,
      })

    if (deliveryLogError) {
      logger.error('Failed to persist webhook lifecycle email delivery record', deliveryLogError, {
        route: 'api/webhook/stripe',
        organizationId,
        templateKey,
        eventId,
      })
    }

    if (!sent) {
      logger.warn('Webhook lifecycle email was not delivered', {
        route: 'api/webhook/stripe',
        ...context,
      })
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown email error'
    const { error: deliveryLogError } = await supabase
      .from('outbound_email_deliveries')
      .insert({
        organization_id: organizationId,
        source: 'stripe_webhook',
        template_key: templateKey,
        event_id: eventId,
        recipients,
        provider: 'resend',
        status: 'failed',
        error_message: errorMessage,
        metadata: context,
      })

    if (deliveryLogError) {
      logger.error('Failed to persist webhook lifecycle email error record', deliveryLogError, {
        route: 'api/webhook/stripe',
        organizationId,
        templateKey,
        eventId,
      })
    }

    logger.error('Webhook lifecycle email send failed', error, {
      route: 'api/webhook/stripe',
      ...context,
    })
  }
}

function getSubscriptionItem(subscription: Stripe.Subscription) {
  return subscription.items.data[0]
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const subscription = (
    invoice as Stripe.Invoice & {
      subscription?: string | Stripe.Subscription | null
    }
  ).subscription
  if (!subscription) return null
  return typeof subscription === 'string' ? subscription : subscription.id
}

async function handleRefundEvent(
  supabase: ReturnType<typeof createServiceClient>,
  event: Stripe.Event,
  stripeClient: Stripe,
  charge: Stripe.Charge
): Promise<void> {
  const customerId = getCustomerId(charge.customer)
  if (!customerId) {
    logger.warn('Refund event without customer id', {
      route: 'api/webhook/stripe',
      eventId: event.id,
      chargeId: charge.id,
    })
    return
  }

  const org = await getOrganizationByCustomerId(supabase, customerId)
  if (!org) {
    logger.warn('Refund event ignored - organization not found', {
      route: 'api/webhook/stripe',
      eventId: event.id,
      customerId,
    })
    return
  }

  if (isStripeEventStale(event.created, org.stripe_last_event_created)) {
    logger.info('Skipping stale refund event', {
      route: 'api/webhook/stripe',
      eventId: event.id,
      organizationId: org.id,
    })
    return
  }

  await updateOrganizationForEvent(supabase, org.id, event, {
    status: org.status,
  })

  await safeInsertAuditLog(supabase, {
    organization_id: org.id,
    actor_type: 'webhook',
    actor_id: 'stripe',
    action: 'subscription.refund_recorded',
    resource_type: 'charge',
    resource_id: charge.id,
    metadata: {
      amount_refunded: charge.amount_refunded,
      charge_amount: charge.amount,
      currency: charge.currency,
      refunded: charge.refunded,
    },
  })

  const chargeInvoice = (
    charge as Stripe.Charge & {
      invoice?: string | Stripe.Invoice | null
    }
  ).invoice

  if (chargeInvoice) {
    const invoiceId = typeof chargeInvoice === 'string' ? chargeInvoice : chargeInvoice.id
    try {
      const invoice = await stripeClient.invoices.retrieve(invoiceId)
      const subscriptionId = getInvoiceSubscriptionId(invoice)
      if (subscriptionId) {
        await upsertSubscriptionForEvent(supabase, subscriptionId, event, {
          organization_id: org.id,
          plan: org.plan,
          status: (charge.refunded ? 'cancelled' : 'active') as LocalSubscriptionStatus,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date().toISOString(),
          amount_cents: invoice.amount_paid || 0,
        })
      }
    } catch (invoiceError) {
      logger.error('Failed to load invoice for refund event', invoiceError, {
        route: 'api/webhook/stripe',
        eventId: event.id,
        chargeId: charge.id,
      })
    }
  }
}

async function handleDisputeEvent(
  supabase: ReturnType<typeof createServiceClient>,
  event: Stripe.Event,
  stripeClient: Stripe,
  dispute: Stripe.Dispute
): Promise<void> {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge.id
  const charge = await stripeClient.charges.retrieve(chargeId)
  const customerId = getCustomerId(charge.customer)
  if (!customerId) {
    logger.warn('Dispute event without customer id', {
      route: 'api/webhook/stripe',
      eventId: event.id,
      disputeId: dispute.id,
    })
    return
  }

  const org = await getOrganizationByCustomerId(supabase, customerId)
  if (!org) {
    logger.warn('Dispute event ignored - organization not found', {
      route: 'api/webhook/stripe',
      eventId: event.id,
      customerId,
    })
    return
  }

  if (isStripeEventStale(event.created, org.stripe_last_event_created)) {
    logger.info('Skipping stale dispute event', {
      route: 'api/webhook/stripe',
      eventId: event.id,
      organizationId: org.id,
    })
    return
  }

  if (event.type === 'charge.dispute.created') {
    await updateOrganizationForEvent(supabase, org.id, event, {
      status: 'suspended',
      suspended_at: new Date().toISOString(),
    })

    await safeInsertAuditLog(supabase, {
      organization_id: org.id,
      actor_type: 'webhook',
      actor_id: 'stripe',
      action: 'subscription.dispute_opened',
      resource_type: 'dispute',
      resource_id: dispute.id,
      metadata: {
        amount: dispute.amount,
        currency: dispute.currency,
        reason: dispute.reason,
        status: dispute.status,
        charge_id: charge.id,
      },
    })

    return
  }

  const disputeWon = dispute.status === 'won' || dispute.status === 'warning_closed'
  const disputeLost = dispute.status === 'lost'

  await updateOrganizationForEvent(supabase, org.id, event, {
    status: disputeWon ? 'active' : org.status,
  })

  await safeInsertAuditLog(supabase, {
    organization_id: org.id,
    actor_type: 'webhook',
    actor_id: 'stripe',
    action: 'subscription.dispute_closed',
    resource_type: 'dispute',
    resource_id: dispute.id,
    metadata: {
      amount: dispute.amount,
      currency: dispute.currency,
      status: dispute.status,
      outcome: disputeWon ? 'won' : disputeLost ? 'lost' : 'closed',
      charge_id: charge.id,
    },
  })
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
  let eventTrackingStarted = false

  try {
    const acquireResult = await acquireStripeWebhookEventProcessing(supabase, event.id, event.type)
    if (acquireResult === 'processed') {
      return NextResponse.json({ received: true, duplicate: true })
    }
    if (acquireResult === 'processing') {
      return NextResponse.json({ received: true, in_progress: true })
    }
    eventTrackingStarted = true

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode !== 'subscription' || !session.subscription) {
          break
        }

        const subscriptionId = typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id

        const subscriptionResponse = await stripeClient.subscriptions.retrieve(subscriptionId)
        const subscription = subscriptionResponse as unknown as Stripe.Subscription

        const customerId = getCustomerId(session.customer)
        if (!customerId) {
          logger.warn('checkout.session.completed missing customer id', {
            route: 'api/webhook/stripe',
            eventId: event.id,
          })
          break
        }

        const org = await getOrganizationByCustomerId(supabase, customerId)
        if (!org) {
          logger.warn('checkout.session.completed organization not found', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            customerId,
          })
          break
        }

        if (isStripeEventStale(event.created, org.stripe_last_event_created)) {
          logger.info('Skipping stale checkout.session.completed event', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            organizationId: org.id,
          })
          break
        }

        const item = getSubscriptionItem(subscription)
        const priceId = item?.price.id
        if (!priceId) {
          logger.error('Missing Stripe price ID in checkout.session.completed', undefined, {
            route: 'api/webhook/stripe',
            eventId: event.id,
            subscriptionId: subscription.id,
          })
          break
        }

        const plan = resolvePaidPlanFromPriceId(priceId)
        if (!plan) {
          logger.error('Unsupported Stripe price ID in checkout.session.completed', undefined, {
            route: 'api/webhook/stripe',
            eventId: event.id,
            subscriptionId: subscription.id,
            priceId,
          })
          break
        }

        const limits = PLAN_LIMITS[plan]

        const orgApplied = await updateOrganizationForEvent(supabase, org.id, event, {
          stripe_subscription_id: subscription.id,
          plan,
          status: 'active',
          device_limit: limits.devices,
          agent_limit: limits.agents,
          user_limit: limits.users,
          trial_ends_at: null,
        })

        if (!orgApplied) {
          logger.info('Skipped checkout.session.completed due to stale organization state', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            organizationId: org.id,
          })
          break
        }

        const subscriptionApplied = await upsertSubscriptionForEvent(supabase, subscription.id, event, {
          organization_id: org.id,
          plan,
          status: 'active',
          current_period_start: new Date((item?.current_period_start ?? 0) * 1000).toISOString(),
          current_period_end: new Date((item?.current_period_end ?? 0) * 1000).toISOString(),
          amount_cents: item?.price.unit_amount || 0,
        })

        if (!subscriptionApplied) {
          logger.info('Skipped checkout.session.completed due to stale subscription state', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            subscriptionId: subscription.id,
          })
          break
        }

        await safeInsertAuditLog(supabase, {
          organization_id: org.id,
          actor_type: 'webhook',
          actor_id: 'stripe',
          action: 'subscription.created',
          resource_type: 'subscription',
          resource_id: subscription.id,
          metadata: { plan, price_id: priceId },
        })

        const recipients = await getOrgRecipients(supabase, org.id)
        if (recipients.length > 0) {
          await sendWebhookLifecycleEmail(
            supabase,
            org.id,
            'subscription_activated',
            recipients,
            event.id,
            () => sendSubscriptionActivatedEmail(org.name, plan, recipients),
            {
              eventId: event.id,
              organizationId: org.id,
              emailType: 'subscription_activated',
            }
          )
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = getCustomerId(subscription.customer)
        if (!customerId) {
          logger.warn('customer.subscription.updated missing customer id', {
            route: 'api/webhook/stripe',
            eventId: event.id,
          })
          break
        }

        const org = await getOrganizationByCustomerId(supabase, customerId)
        if (!org) {
          logger.warn('customer.subscription.updated organization not found', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            customerId,
          })
          break
        }

        if (isStripeEventStale(event.created, org.stripe_last_event_created)) {
          logger.info('Skipping stale customer.subscription.updated event', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            organizationId: org.id,
          })
          break
        }

        const mappedStatus = mapStripeSubscriptionStatus(subscription.status)

        const item = getSubscriptionItem(subscription)
        const priceId = item?.price.id
        const newPlan = priceId ? resolvePaidPlanFromPriceId(priceId) : null
        if (priceId && !newPlan) {
          logger.warn('Unsupported Stripe price ID in customer.subscription.updated', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            subscriptionId: subscription.id,
            priceId,
          })
        }

        const subscriptionPayload: Record<string, unknown> = {
          organization_id: org.id,
          status: mappedStatus.subscriptionStatus,
          current_period_start: new Date((item?.current_period_start ?? 0) * 1000).toISOString(),
          current_period_end: new Date((item?.current_period_end ?? 0) * 1000).toISOString(),
          amount_cents: item?.price.unit_amount || 0,
          plan: newPlan || org.plan,
        }

        const subscriptionApplied = await upsertSubscriptionForEvent(
          supabase,
          subscription.id,
          event,
          subscriptionPayload
        )

        if (!subscriptionApplied) {
          logger.info('Skipped customer.subscription.updated due to stale subscription state', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            subscriptionId: subscription.id,
          })
          break
        }

        const orgUpdate: Record<string, unknown> = {
          status: mappedStatus.organizationStatus,
          stripe_subscription_id: subscription.id,
        }

        if (
          newPlan &&
          newPlan !== org.plan &&
          (mappedStatus.organizationStatus === 'active' || mappedStatus.organizationStatus === 'past_due')
        ) {
          const limits = PLAN_LIMITS[newPlan]
          orgUpdate.plan = newPlan
          orgUpdate.device_limit = limits.devices
          orgUpdate.agent_limit = limits.agents
          orgUpdate.user_limit = limits.users
        }

        const orgApplied = await updateOrganizationForEvent(supabase, org.id, event, orgUpdate)
        if (!orgApplied) {
          logger.info('Skipped customer.subscription.updated due to stale organization state', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            organizationId: org.id,
          })
          break
        }

        if (newPlan && newPlan !== org.plan) {
          await safeInsertAuditLog(supabase, {
            organization_id: org.id,
            actor_type: 'webhook',
            actor_id: 'stripe',
            action: 'subscription.plan_changed',
            resource_type: 'subscription',
            resource_id: subscription.id,
            metadata: { old_plan: org.plan, new_plan: newPlan, price_id: priceId },
          })
        }

        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = getCustomerId(subscription.customer)
        if (!customerId) {
          logger.warn('customer.subscription.deleted missing customer id', {
            route: 'api/webhook/stripe',
            eventId: event.id,
          })
          break
        }

        const org = await getOrganizationByCustomerId(supabase, customerId)
        if (!org) {
          logger.warn('customer.subscription.deleted organization not found', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            customerId,
          })
          break
        }

        if (isStripeEventStale(event.created, org.stripe_last_event_created)) {
          logger.info('Skipping stale customer.subscription.deleted event', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            organizationId: org.id,
          })
          break
        }

        const orgApplied = await updateOrganizationForEvent(supabase, org.id, event, {
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })

        if (!orgApplied) {
          logger.info('Skipped customer.subscription.deleted due to stale organization state', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            organizationId: org.id,
          })
          break
        }

        await upsertSubscriptionForEvent(supabase, subscription.id, event, {
          organization_id: org.id,
          plan: org.plan,
          status: 'cancelled',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date().toISOString(),
          amount_cents: 0,
        })

        await safeInsertAuditLog(supabase, {
          organization_id: org.id,
          actor_type: 'webhook',
          actor_id: 'stripe',
          action: 'subscription.cancelled',
          resource_type: 'subscription',
          resource_id: subscription.id,
        })

        const recipients = await getOrgRecipients(supabase, org.id)
        if (recipients.length > 0) {
          await sendWebhookLifecycleEmail(
            supabase,
            org.id,
            'subscription_cancelled',
            recipients,
            event.id,
            () => sendSubscriptionCancelledEmail(org.name, recipients),
            {
              eventId: event.id,
              organizationId: org.id,
              emailType: 'subscription_cancelled',
            }
          )
        }

        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = getCustomerId(invoice.customer)
        if (!customerId) {
          logger.warn('invoice.payment_failed missing customer id', {
            route: 'api/webhook/stripe',
            eventId: event.id,
          })
          break
        }

        const org = await getOrganizationByCustomerId(supabase, customerId)
        if (!org) {
          logger.warn('invoice.payment_failed organization not found', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            customerId,
          })
          break
        }

        if (isStripeEventStale(event.created, org.stripe_last_event_created)) {
          logger.info('Skipping stale invoice.payment_failed event', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            organizationId: org.id,
          })
          break
        }

        await updateOrganizationForEvent(supabase, org.id, event, { status: 'past_due' })

        const stripeSubscriptionId = getInvoiceSubscriptionId(invoice)
        if (stripeSubscriptionId) {
          await upsertSubscriptionForEvent(supabase, stripeSubscriptionId, event, {
            organization_id: org.id,
            plan: org.plan,
            status: 'past_due',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date().toISOString(),
            amount_cents: invoice.amount_due || 0,
          })
        }

        await safeInsertAuditLog(supabase, {
          organization_id: org.id,
          actor_type: 'webhook',
          actor_id: 'stripe',
          action: 'subscription.payment_failed',
          resource_type: 'invoice',
          resource_id: invoice.id ?? '',
          metadata: { amount: invoice.amount_due, currency: invoice.currency },
        })

        const failRecipients = await getOrgRecipients(supabase, org.id)
        if (failRecipients.length > 0) {
          const amountFormatted = invoice.amount_due
            ? `${(invoice.amount_due / 100).toFixed(2)}`
            : 'unknown'
          const currency = (invoice.currency ?? 'gbp').toUpperCase()

          await sendWebhookLifecycleEmail(
            supabase,
            org.id,
            'payment_failed',
            failRecipients,
            event.id,
            () => sendPaymentFailedEmail(org.name, amountFormatted, currency, failRecipients),
            {
              eventId: event.id,
              organizationId: org.id,
              emailType: 'payment_failed',
            }
          )
        }

        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = getCustomerId(invoice.customer)
        if (!customerId) {
          logger.warn('invoice.payment_succeeded missing customer id', {
            route: 'api/webhook/stripe',
            eventId: event.id,
          })
          break
        }

        const org = await getOrganizationByCustomerId(supabase, customerId)
        if (!org) {
          logger.warn('invoice.payment_succeeded organization not found', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            customerId,
          })
          break
        }

        if (isStripeEventStale(event.created, org.stripe_last_event_created)) {
          logger.info('Skipping stale invoice.payment_succeeded event', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            organizationId: org.id,
          })
          break
        }

        await updateOrganizationForEvent(supabase, org.id, event, {
          status: 'active',
          suspended_at: null,
        })

        const stripeSubscriptionId = getInvoiceSubscriptionId(invoice)
        if (stripeSubscriptionId) {
          await upsertSubscriptionForEvent(supabase, stripeSubscriptionId, event, {
            organization_id: org.id,
            plan: org.plan,
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date().toISOString(),
            amount_cents: invoice.amount_paid || 0,
          })
        }

        await safeInsertAuditLog(supabase, {
          organization_id: org.id,
          actor_type: 'webhook',
          actor_id: 'stripe',
          action: 'subscription.payment_recovered',
          resource_type: 'invoice',
          resource_id: invoice.id ?? '',
          metadata: {
            amount_paid: invoice.amount_paid,
            currency: invoice.currency,
          },
        })

        break
      }

      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        await handleRefundEvent(supabase, event, stripeClient, charge)
        break
      }

      case 'charge.dispute.created':
      case 'charge.dispute.closed': {
        const dispute = event.data.object as Stripe.Dispute
        await handleDisputeEvent(supabase, event, stripeClient, dispute)
        break
      }

      default:
        logger.info('Unhandled Stripe event type received', {
          route: 'api/webhook/stripe',
          eventId: event.id,
          eventType: event.type,
        })
    }

    await markStripeWebhookEventProcessed(supabase, event.id)
    return NextResponse.json({ received: true })
  } catch (error) {
    if (eventTrackingStarted) {
      const errorMessage = error instanceof Error ? error.message : 'Webhook handler failed'
      await markStripeWebhookEventFailed(supabase, event.id, errorMessage)
    }
    logger.error('Webhook error', error, { route: 'api/webhook/stripe', eventId: event.id })
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

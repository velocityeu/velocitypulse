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
  sendRefundProcessedEmail,
  sendDisputeOpenedEmail,
  sendDisputeClosedEmail,
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

interface OrganizationStripeState {
  id: string
  name: string
  plan: string
  status: string
  stripe_last_event_created: number | null
}

interface StripeLifecycleApplyResult {
  applied?: boolean
  reason?: string
  error?: string
  subscription_applied?: boolean
  subscription_inserted?: boolean
}

const FINANCIAL_POLICY_VERSION = '2026-02-11.2'

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

async function applyStripeLifecycleState(
  supabase: ReturnType<typeof createServiceClient>,
  event: Stripe.Event,
  organizationId: string,
  stripeSubscriptionId: string | null,
  orgPatch: Record<string, unknown>,
  subscriptionPatch?: Record<string, unknown>
): Promise<StripeLifecycleApplyResult> {
  const { data, error } = await supabase.rpc('apply_stripe_lifecycle_state', {
    p_organization_id: organizationId,
    p_stripe_subscription_id: stripeSubscriptionId,
    p_event_created: event.created,
    p_event_id: event.id,
    p_org_patch: orgPatch,
    p_sub_patch: subscriptionPatch ?? null,
  })

  if (error) {
    throw error
  }

  const result = (data as StripeLifecycleApplyResult | null) ?? { applied: false, reason: 'empty_result' }
  if (!result.applied && (result.reason === 'exception' || result.error)) {
    throw new Error(result.error ?? 'apply_stripe_lifecycle_state failed')
  }

  return result
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

function mapOrganizationStatusToSubscriptionStatus(status: string): LocalSubscriptionStatus {
  switch (status) {
    case 'active':
      return 'active'
    case 'past_due':
    case 'suspended':
      return 'past_due'
    case 'cancelled':
      return 'cancelled'
    default:
      return 'incomplete'
  }
}

function formatCurrencyAmount(amountCents: number, currency: string | null | undefined): string {
  const normalized = (currency ?? 'gbp').toUpperCase()
  return `${normalized} ${(amountCents / 100).toFixed(2)}`
}

function isFullRefund(charge: Stripe.Charge): boolean {
  if (!charge.refunded) return false
  if (!charge.amount || charge.amount <= 0) return false
  return charge.amount_refunded >= charge.amount
}

function stripeTimestampToIso(value: number | null | undefined): string {
  if (!value || value <= 0) {
    return new Date().toISOString()
  }
  return new Date(value * 1000).toISOString()
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

  const fullRefund = isFullRefund(charge)
  const policyOrgStatus = fullRefund ? 'cancelled' : org.status
  const policySubStatus = fullRefund
    ? 'cancelled'
    : mapOrganizationStatusToSubscriptionStatus(org.status)
  const policyAction = fullRefund ? 'subscription.refund_full' : 'subscription.refund_partial'
  const policyTemplate = fullRefund ? 'refund_processed_full' : 'refund_processed_partial'

  let subscriptionIdFromInvoice: string | null = null
  let subscriptionAmountCents = charge.amount_refunded || charge.amount || 0
  const chargeInvoice = (
    charge as Stripe.Charge & {
      invoice?: string | Stripe.Invoice | null
    }
  ).invoice

  if (chargeInvoice) {
    const invoiceId = typeof chargeInvoice === 'string' ? chargeInvoice : chargeInvoice.id
    try {
      const invoice = await stripeClient.invoices.retrieve(invoiceId)
      subscriptionIdFromInvoice = getInvoiceSubscriptionId(invoice)
      subscriptionAmountCents = invoice.amount_paid || invoice.amount_due || subscriptionAmountCents
    } catch (invoiceError) {
      logger.error('Failed to load invoice for refund event', invoiceError, {
        route: 'api/webhook/stripe',
        eventId: event.id,
        chargeId: charge.id,
      })
    }
  }

  const applyResult = await applyStripeLifecycleState(
    supabase,
    event,
    org.id,
    subscriptionIdFromInvoice,
    {
      status: policyOrgStatus,
      cancelled_at: fullRefund ? new Date().toISOString() : null,
    },
    subscriptionIdFromInvoice
      ? {
          organization_id: org.id,
          plan: org.plan,
          status: policySubStatus,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date().toISOString(),
          amount_cents: subscriptionAmountCents,
        }
      : undefined
  )

  if (!applyResult.applied) {
    logger.info('Skipped refund event state apply', {
      route: 'api/webhook/stripe',
      eventId: event.id,
      organizationId: org.id,
      reason: applyResult.reason,
    })
    return
  }

  await safeInsertAuditLog(supabase, {
    organization_id: org.id,
    actor_type: 'webhook',
    actor_id: 'stripe',
    action: policyAction,
    resource_type: 'charge',
    resource_id: charge.id,
    metadata: {
      policy_version: FINANCIAL_POLICY_VERSION,
      amount_refunded: charge.amount_refunded,
      charge_amount: charge.amount,
      currency: charge.currency,
      refunded: charge.refunded,
      full_refund: fullRefund,
      support_followup_required: fullRefund,
    },
  })

  const recipients = await getOrgRecipients(supabase, org.id)
  if (recipients.length > 0) {
    await sendWebhookLifecycleEmail(
      supabase,
      org.id,
      policyTemplate,
      recipients,
      event.id,
      () => sendRefundProcessedEmail(org.name, formatCurrencyAmount(charge.amount_refunded, charge.currency), fullRefund, recipients),
      {
        eventId: event.id,
        organizationId: org.id,
        emailType: policyTemplate,
        policyVersion: FINANCIAL_POLICY_VERSION,
      }
    )
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

  let orgStatusTarget: string = org.status
  let subscriptionStatusTarget: LocalSubscriptionStatus = mapOrganizationStatusToSubscriptionStatus(org.status)
  let action: string
  let templateKey: string
  let metadataOutcome: string

  if (event.type === 'charge.dispute.created') {
    orgStatusTarget = 'suspended'
    subscriptionStatusTarget = 'past_due'
    action = 'subscription.dispute_opened'
    templateKey = 'dispute_opened'
    metadataOutcome = 'opened'
  } else {
    const disputeWon = dispute.status === 'won' || dispute.status === 'warning_closed'
    const disputeLost = dispute.status === 'lost'

    orgStatusTarget = disputeWon ? 'active' : disputeLost ? 'cancelled' : org.status
    subscriptionStatusTarget = disputeWon
      ? 'active'
      : disputeLost
      ? 'cancelled'
      : mapOrganizationStatusToSubscriptionStatus(org.status)
    action = 'subscription.dispute_closed'
    templateKey = disputeWon ? 'dispute_closed_won' : disputeLost ? 'dispute_closed_lost' : 'dispute_closed'
    metadataOutcome = disputeWon ? 'won' : disputeLost ? 'lost' : 'closed'
  }

  let subscriptionIdFromInvoice: string | null = null
  const chargeInvoice = (
    charge as Stripe.Charge & {
      invoice?: string | Stripe.Invoice | null
    }
  ).invoice

  if (chargeInvoice) {
    const invoiceId = typeof chargeInvoice === 'string' ? chargeInvoice : chargeInvoice.id
    try {
      const invoice = await stripeClient.invoices.retrieve(invoiceId)
      subscriptionIdFromInvoice = getInvoiceSubscriptionId(invoice)
    } catch (invoiceError) {
      logger.error('Failed to load invoice for dispute event', invoiceError, {
        route: 'api/webhook/stripe',
        eventId: event.id,
        disputeId: dispute.id,
      })
    }
  }

  const applyResult = await applyStripeLifecycleState(
    supabase,
    event,
    org.id,
    subscriptionIdFromInvoice,
    {
      status: orgStatusTarget,
      suspended_at: orgStatusTarget === 'suspended' ? new Date().toISOString() : null,
      cancelled_at: orgStatusTarget === 'cancelled' ? new Date().toISOString() : null,
    },
    subscriptionIdFromInvoice
      ? {
          organization_id: org.id,
          plan: org.plan,
          status: subscriptionStatusTarget,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date().toISOString(),
          amount_cents: dispute.amount,
        }
      : undefined
  )

  if (!applyResult.applied) {
    logger.info('Skipped dispute event state apply', {
      route: 'api/webhook/stripe',
      eventId: event.id,
      organizationId: org.id,
      reason: applyResult.reason,
    })
    return
  }

  await safeInsertAuditLog(supabase, {
    organization_id: org.id,
    actor_type: 'webhook',
    actor_id: 'stripe',
    action,
    resource_type: 'dispute',
    resource_id: dispute.id,
    metadata: {
      policy_version: FINANCIAL_POLICY_VERSION,
      amount: dispute.amount,
      currency: dispute.currency,
      reason: dispute.reason,
      status: dispute.status,
      outcome: metadataOutcome,
      charge_id: charge.id,
      support_followup_required: metadataOutcome !== 'won',
    },
  })

  const recipients = await getOrgRecipients(supabase, org.id)
  if (recipients.length > 0) {
    if (event.type === 'charge.dispute.created') {
      await sendWebhookLifecycleEmail(
        supabase,
        org.id,
        templateKey,
        recipients,
        event.id,
        () => sendDisputeOpenedEmail(org.name, formatCurrencyAmount(dispute.amount, dispute.currency), dispute.reason || 'unknown', recipients),
        {
          eventId: event.id,
          organizationId: org.id,
          emailType: templateKey,
          policyVersion: FINANCIAL_POLICY_VERSION,
        }
      )
    } else {
      await sendWebhookLifecycleEmail(
        supabase,
        org.id,
        templateKey,
        recipients,
        event.id,
        () => sendDisputeClosedEmail(org.name, metadataOutcome, recipients),
        {
          eventId: event.id,
          organizationId: org.id,
          emailType: templateKey,
          policyVersion: FINANCIAL_POLICY_VERSION,
        }
      )
    }
  }
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

        const applyResult = await applyStripeLifecycleState(
          supabase,
          event,
          org.id,
          subscription.id,
          {
            stripe_subscription_id: subscription.id,
            plan,
            status: 'active',
            device_limit: limits.devices,
            agent_limit: limits.agents,
            user_limit: limits.users,
            trial_ends_at: null,
            suspended_at: null,
            cancelled_at: null,
          },
          {
            organization_id: org.id,
            plan,
            status: 'active',
            current_period_start: stripeTimestampToIso(item?.current_period_start),
            current_period_end: stripeTimestampToIso(item?.current_period_end),
            amount_cents: item?.price.unit_amount || 0,
          }
        )

        if (!applyResult.applied) {
          logger.info('Skipped checkout.session.completed state apply', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            organizationId: org.id,
            subscriptionId: subscription.id,
            reason: applyResult.reason,
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

        const applyResult = await applyStripeLifecycleState(
          supabase,
          event,
          org.id,
          subscription.id,
          orgUpdate,
          {
            organization_id: org.id,
            status: mappedStatus.subscriptionStatus,
            current_period_start: stripeTimestampToIso(item?.current_period_start),
            current_period_end: stripeTimestampToIso(item?.current_period_end),
            amount_cents: item?.price.unit_amount || 0,
            plan: newPlan || org.plan,
          }
        )

        if (!applyResult.applied) {
          logger.info('Skipped customer.subscription.updated state apply', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            organizationId: org.id,
            subscriptionId: subscription.id,
            reason: applyResult.reason,
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
        const item = getSubscriptionItem(subscription)
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

        const applyResult = await applyStripeLifecycleState(
          supabase,
          event,
          org.id,
          subscription.id,
          {
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
          },
          {
            organization_id: org.id,
            plan: org.plan,
            status: 'cancelled',
            current_period_start: stripeTimestampToIso(item?.current_period_start),
            current_period_end: stripeTimestampToIso(item?.current_period_end),
            amount_cents: 0,
          }
        )

        if (!applyResult.applied) {
          logger.info('Skipped customer.subscription.deleted state apply', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            organizationId: org.id,
            subscriptionId: subscription.id,
            reason: applyResult.reason,
          })
          break
        }

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

        const stripeSubscriptionId = getInvoiceSubscriptionId(invoice)
        const applyResult = await applyStripeLifecycleState(
          supabase,
          event,
          org.id,
          stripeSubscriptionId,
          { status: 'past_due' },
          stripeSubscriptionId
            ? {
                organization_id: org.id,
                plan: org.plan,
                status: 'past_due',
                current_period_start: stripeTimestampToIso(invoice.period_start ?? null),
                current_period_end: stripeTimestampToIso(invoice.period_end ?? null),
                amount_cents: invoice.amount_due || 0,
              }
            : undefined
        )

        if (!applyResult.applied) {
          logger.info('Skipped invoice.payment_failed state apply', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            organizationId: org.id,
            subscriptionId: stripeSubscriptionId,
            reason: applyResult.reason,
          })
          break
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

        const stripeSubscriptionId = getInvoiceSubscriptionId(invoice)
        const applyResult = await applyStripeLifecycleState(
          supabase,
          event,
          org.id,
          stripeSubscriptionId,
          {
            status: 'active',
            suspended_at: null,
          },
          stripeSubscriptionId
            ? {
                organization_id: org.id,
                plan: org.plan,
                status: 'active',
                current_period_start: stripeTimestampToIso(invoice.period_start ?? null),
                current_period_end: stripeTimestampToIso(invoice.period_end ?? null),
                amount_cents: invoice.amount_paid || 0,
              }
            : undefined
        )

        if (!applyResult.applied) {
          logger.info('Skipped invoice.payment_succeeded state apply', {
            route: 'api/webhook/stripe',
            eventId: event.id,
            organizationId: org.id,
            subscriptionId: stripeSubscriptionId,
            reason: applyResult.reason,
          })
          break
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

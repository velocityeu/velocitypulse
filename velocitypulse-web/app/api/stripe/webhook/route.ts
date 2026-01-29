import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeServer } from '@/lib/stripe'
import { getServerEnv, isDevelopment } from '@/lib/env'

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      )
    }

    const stripe = getStripeServer()
    let webhookSecret: string

    try {
      const env = getServerEnv()
      webhookSecret = env.STRIPE_WEBHOOK_SECRET
    } catch {
      if (isDevelopment()) {
        return NextResponse.json(
          { error: 'Webhook secret not configured' },
          { status: 503 }
        )
      }
      throw new Error('Webhook configuration error')
    }

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signature verification failed'
      return NextResponse.json(
        { error: 'Invalid signature', details: isDevelopment() ? message : undefined },
        { status: 400 }
      )
    }

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription
        // TODO: Provision access in VelocityPulse
        // - Create organization in database
        // - Send welcome email
        // - Store subscription ID for future reference
        await handleSubscriptionCreated(subscription)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        // TODO: Update access level
        // - Handle plan upgrades/downgrades
        // - Update device limits based on new plan
        await handleSubscriptionUpdated(subscription)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        // TODO: Revoke access
        // - Mark organization as cancelled
        // - Start data retention countdown (30 days)
        await handleSubscriptionDeleted(subscription)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        // TODO: Handle payment failure
        // - Send payment failed notification
        // - Start grace period
        await handlePaymentFailed(invoice)
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        // TODO: Handle successful payment
        // - Extend subscription
        // - Send receipt
        await handlePaymentSucceeded(invoice)
        break
      }

      default:
        // Unhandled event type - log in development only
        if (isDevelopment()) {
          // eslint-disable-next-line no-console
          console.log(`Unhandled event type: ${event.type}`)
        }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (isDevelopment()) {
      return NextResponse.json(
        { error: 'Webhook processing failed', details: message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

// Placeholder handlers - implement when database is ready
async function handleSubscriptionCreated(subscription: Stripe.Subscription): Promise<void> {
  // TODO: Implement when database is configured
  // 1. Get customer email from Stripe
  // 2. Create organization record
  // 3. Create admin user account
  // 4. Send welcome email with setup instructions
  void subscription
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
  // TODO: Implement when database is configured
  // 1. Check if plan changed
  // 2. Update organization device limits
  // 3. Send confirmation email
  void subscription
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
  // TODO: Implement when database is configured
  // 1. Mark organization as cancelled
  // 2. Set data deletion date (30 days)
  // 3. Send cancellation confirmation
  void subscription
}

async function handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
  // TODO: Implement when database is configured
  // 1. Mark subscription as past due
  // 2. Send payment failed notification
  // 3. Start 7-day grace period
  void invoice
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  // TODO: Implement when database is configured
  // 1. Update subscription status
  // 2. Send payment receipt
  void invoice
}

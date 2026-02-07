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
    if (!apiKey) throw new Error('STRIPE_SECRET_KEY is not configured')
    stripe = new Stripe(apiKey, {
      apiVersion: '2026-01-28.clover',
      maxNetworkRetries: 3,
      timeout: 30000,
    })
  }
  return stripe
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const canManageBilling =
      membership.role === 'owner' ||
      membership.role === 'admin' ||
      membership.permissions?.can_manage_billing === true

    if (!canManageBilling) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id, stripe_subscription_id, plan, status')
      .eq('id', membership.organization_id)
      .single()

    if (!org?.stripe_customer_id) {
      return NextResponse.json({
        subscription: null,
        paymentMethod: null,
        invoices: [],
        plan: org?.plan || 'trial',
        status: org?.status || 'trial',
      })
    }

    const stripeClient = getStripe()
    let subscriptionData = null
    let paymentMethod = null
    let invoices: Array<{ id: string; date: string | null; amount: number; status: string | null; pdf: string | null }> = []

    // Fetch subscription details
    if (org.stripe_subscription_id) {
      try {
        const sub = await stripeClient.subscriptions.retrieve(org.stripe_subscription_id, {
          expand: ['default_payment_method'],
        })
        subscriptionData = {
          id: sub.id,
          status: sub.status,
          cancel_at_period_end: sub.cancel_at_period_end,
          current_period_end: new Date((sub.items.data[0]?.current_period_end ?? 0) * 1000).toISOString(),
          current_period_start: new Date((sub.items.data[0]?.current_period_start ?? 0) * 1000).toISOString(),
          amount: sub.items.data[0]?.price.unit_amount || 0,
          priceId: sub.items.data[0]?.price.id,
          plan: org.plan,
        }

        const pm = sub.default_payment_method
        if (pm && typeof pm !== 'string' && pm.card) {
          paymentMethod = {
            brand: pm.card.brand,
            last4: pm.card.last4,
            exp_month: pm.card.exp_month,
            exp_year: pm.card.exp_year,
          }
        }
      } catch (err) {
        logger.warn('Failed to fetch subscription from Stripe', { error: err })
      }
    }

    // If no payment method from subscription, check customer default
    if (!paymentMethod) {
      try {
        const customer = await stripeClient.customers.retrieve(org.stripe_customer_id) as Stripe.Customer
        if (customer.invoice_settings?.default_payment_method) {
          const pmId = typeof customer.invoice_settings.default_payment_method === 'string'
            ? customer.invoice_settings.default_payment_method
            : customer.invoice_settings.default_payment_method.id
          const pm = await stripeClient.paymentMethods.retrieve(pmId)
          if (pm.card) {
            paymentMethod = {
              brand: pm.card.brand,
              last4: pm.card.last4,
              exp_month: pm.card.exp_month,
              exp_year: pm.card.exp_year,
            }
          }
        }
      } catch {
        // No default payment method
      }
    }

    // Fetch recent invoices
    try {
      const invoiceList = await stripeClient.invoices.list({
        customer: org.stripe_customer_id,
        limit: 10,
      })
      invoices = invoiceList.data.map(inv => ({
        id: inv.id,
        date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
        amount: inv.amount_paid || inv.amount_due || 0,
        status: inv.status,
        pdf: inv.invoice_pdf ?? null,
      }))
    } catch {
      // No invoices
    }

    return NextResponse.json({
      subscription: subscriptionData,
      paymentMethod,
      invoices,
      plan: org.plan,
      status: org.status,
    })
  } catch (error) {
    logger.error('Billing details error', error, { route: 'api/billing/details' })
    return NextResponse.json({ error: 'Failed to fetch billing details' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { verifyInternalAccess } from '@/lib/api/internal-auth'
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
 * GET /api/internal/subscriptions/[id]
 * Fetch full subscription details from Supabase + Stripe
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await verifyInternalAccess()
  if (!access.authorized) return access.error!

  const { id } = await params

  try {
    const supabase = createServiceClient()

    // Get subscription from our DB
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        organizations (id, name, slug, customer_number, stripe_customer_id, plan, status)
      `)
      .eq('id', id)
      .single()

    if (subError || !sub) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 })
    }

    // Fetch additional details from Stripe
    let stripeDetails = null
    if (sub.stripe_subscription_id) {
      try {
        const stripeClient = getStripe()
        const stripeSub = await stripeClient.subscriptions.retrieve(sub.stripe_subscription_id, {
          expand: ['default_payment_method', 'latest_invoice'],
        })

        const item = stripeSub.items.data[0]
        stripeDetails = {
          status: stripeSub.status,
          cancel_at_period_end: stripeSub.cancel_at_period_end,
          canceled_at: stripeSub.canceled_at,
          current_period_start: item?.current_period_start ?? 0,
          current_period_end: item?.current_period_end ?? 0,
          default_payment_method: stripeSub.default_payment_method
            ? {
                type: (stripeSub.default_payment_method as Stripe.PaymentMethod).type,
                card: (stripeSub.default_payment_method as Stripe.PaymentMethod).card
                  ? {
                      brand: (stripeSub.default_payment_method as Stripe.PaymentMethod).card!.brand,
                      last4: (stripeSub.default_payment_method as Stripe.PaymentMethod).card!.last4,
                      exp_month: (stripeSub.default_payment_method as Stripe.PaymentMethod).card!.exp_month,
                      exp_year: (stripeSub.default_payment_method as Stripe.PaymentMethod).card!.exp_year,
                    }
                  : null,
              }
            : null,
          latest_invoice: stripeSub.latest_invoice
            ? {
                id: (stripeSub.latest_invoice as Stripe.Invoice).id,
                status: (stripeSub.latest_invoice as Stripe.Invoice).status,
                amount_due: (stripeSub.latest_invoice as Stripe.Invoice).amount_due,
                hosted_invoice_url: (stripeSub.latest_invoice as Stripe.Invoice).hosted_invoice_url,
              }
            : null,
        }
      } catch (stripeError) {
        logger.error('Stripe subscription fetch error', stripeError, { route: 'api/internal/subscriptions/[id]' })
        // Continue without Stripe details
      }
    }

    return NextResponse.json({
      subscription: {
        id: sub.id,
        organization_id: sub.organization_id,
        organization: sub.organizations,
        stripe_subscription_id: sub.stripe_subscription_id,
        plan: sub.plan,
        status: sub.status,
        amount_cents: sub.amount_cents,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        created_at: sub.created_at,
        updated_at: sub.updated_at,
      },
      stripe: stripeDetails,
    })
  } catch (error) {
    logger.error('Subscription detail error', error, { route: 'api/internal/subscriptions/[id]' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
 * GET /api/internal/organizations/[id]/billing
 * Fetch billing history for an organization from Stripe
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await verifyInternalAccess()
  if (!access.authorized) return access.error!

  const { id: orgId } = await params

  try {
    const supabase = createServiceClient()

    // Get org's Stripe customer ID
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_customer_id, name')
      .eq('id', orgId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    if (!org.stripe_customer_id) {
      return NextResponse.json({
        invoices: [],
        payments: [],
        message: 'No Stripe customer linked to this organization',
      })
    }

    const stripeClient = getStripe()

    // Fetch invoices and payment intents in parallel
    const [invoicesResult, paymentsResult] = await Promise.all([
      stripeClient.invoices.list({
        customer: org.stripe_customer_id,
        limit: 50,
      }),
      stripeClient.paymentIntents.list({
        customer: org.stripe_customer_id,
        limit: 50,
      }),
    ])

    const invoices = invoicesResult.data.map(inv => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount_due: inv.amount_due,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      created: inv.created,
      period_start: inv.period_start,
      period_end: inv.period_end,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
    }))

    const payments = paymentsResult.data.map(pi => ({
      id: pi.id,
      amount: pi.amount,
      currency: pi.currency,
      status: pi.status,
      created: pi.created,
      payment_method_type: pi.payment_method_types?.[0],
      description: pi.description,
    }))

    return NextResponse.json({ invoices, payments })
  } catch (error) {
    logger.error('Billing history error', error, { route: 'api/internal/organizations/[id]/billing' })
    return NextResponse.json({ error: 'Failed to fetch billing history' }, { status: 500 })
  }
}

import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/db/client'
import { ensureUserInDb } from '@/lib/api/ensure-user'
import { logger } from '@/lib/logger'

// Force Node.js runtime (not Edge) - required for Stripe
export const runtime = 'nodejs'

// Lazy initialization
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

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await ensureUserInDb(userId)
    const email = dbUser?.email

    const body = await request.json()
    const { priceId, organizationId } = body

    if (!priceId || !organizationId) {
      return NextResponse.json(
        { error: 'Missing priceId or organizationId' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const stripeClient = getStripe()

    // Get or create organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, stripe_customer_id, name')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      logger.error('Organization lookup failed', orgError, { route: 'api/checkout' })
      return NextResponse.json({ error: `Organization not found: ${orgError?.message || 'no org'}` }, { status: 404 })
    }

    // Verify user is a member of this organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role, permissions')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .single()

    if (!membership) {
      logger.error('Membership lookup failed', undefined, { route: 'api/checkout', userId, organizationId })
      return NextResponse.json({ error: `Not a member of this organization (user: ${userId})` }, { status: 403 })
    }

    // Check if user can manage billing
    const canManageBilling =
      membership.role === 'owner' ||
      membership.role === 'admin' ||
      membership.permissions?.can_manage_billing === true

    if (!canManageBilling) {
      return NextResponse.json({ error: 'You do not have billing permissions' }, { status: 403 })
    }

    // Get or create Stripe customer
    let customerId = org.stripe_customer_id

    if (!customerId) {
      const customer = await stripeClient.customers.create({
        email: email || undefined,
        name: org.name,
        metadata: {
          organization_id: organizationId,
          clerk_user_id: userId,
        },
      })
      customerId = customer.id

      // Update organization with Stripe customer ID
      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', organizationId)
    }

    // Create checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || (() => {
      const host = request.headers.get('host') || 'localhost:3000'
      const protocol = host.includes('localhost') ? 'http' : 'https'
      return `${protocol}://${host}`
    })()

    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${appUrl}/dashboard?checkout=success`,
      cancel_url: `${appUrl}/billing?checkout=cancelled`,
      metadata: {
        organization_id: organizationId,
      },
    })

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: organizationId,
      actor_type: 'user',
      actor_id: userId,
      action: 'checkout.started',
      resource_type: 'checkout_session',
      resource_id: session.id,
      metadata: { price_id: priceId },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    logger.error('Checkout error', error, { route: 'api/checkout' })
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    )
  }
}

import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
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

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    const email = user?.emailAddresses[0]?.emailAddress

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

    // Get organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, stripe_customer_id, name')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify user is a member
    const { data: membership } = await supabase
      .from('organization_members')
      .select('role, permissions')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })
    }

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

      await supabase
        .from('organizations')
        .update({ stripe_customer_id: customerId })
        .eq('id', organizationId)
    }

    // Create embedded checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await stripeClient.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      ui_mode: 'embedded',
      return_url: `${appUrl}/dashboard?checkout=success`,
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
      metadata: { price_id: priceId, ui_mode: 'embedded' },
    })

    return NextResponse.json({ clientSecret: session.client_secret })
  } catch (error) {
    logger.error('Embedded checkout error', error, { route: 'api/checkout/embedded' })
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to create checkout session: ${errorMessage}` },
      { status: 500 }
    )
  }
}

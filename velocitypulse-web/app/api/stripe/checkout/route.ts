import { NextResponse } from 'next/server'
import { getStripeServer, getStripePrices } from '@/lib/stripe'
import { checkoutSchema, formatZodErrors } from '@/lib/validation'
import { isDevelopment } from '@/lib/env'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate input
    const result = checkoutSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(result.error) },
        { status: 400 }
      )
    }

    const { plan, email, successUrl, cancelUrl } = result.data

    // Get price ID for the selected plan
    const prices = getStripePrices()
    const priceId = plan === 'starter' ? prices.starter : prices.unlimited

    if (!priceId || priceId.startsWith('price_placeholder')) {
      if (isDevelopment()) {
        return NextResponse.json(
          { error: 'Stripe prices not configured. Set STRIPE_PRICE_STARTER and STRIPE_PRICE_UNLIMITED in .env.local' },
          { status: 503 }
        )
      }
      return NextResponse.json(
        { error: 'Payment system temporarily unavailable' },
        { status: 503 }
      )
    }

    const stripe = getStripeServer()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://velocitypulse.io'

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      ...(email && { customer_email: email }),
      success_url: successUrl || `${appUrl}/pricing?success=true`,
      cancel_url: cancelUrl || `${appUrl}/pricing?canceled=true`,
      billing_address_collection: 'required',
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 30,
        metadata: {
          plan,
        },
      },
    })

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    })
  } catch (error) {
    // Type-safe error handling
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (isDevelopment()) {
      return NextResponse.json(
        { error: 'Failed to create checkout session', details: message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create checkout session. Please try again.' },
      { status: 500 }
    )
  }
}

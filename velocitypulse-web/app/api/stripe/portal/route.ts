import { NextResponse } from 'next/server'
import { getStripeServer } from '@/lib/stripe'
import { portalSchema, formatZodErrors } from '@/lib/validation'
import { isDevelopment } from '@/lib/env'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Validate input
    const result = portalSchema.safeParse(body)
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: formatZodErrors(result.error) },
        { status: 400 }
      )
    }

    const { customerId, returnUrl } = result.data
    const stripe = getStripeServer()
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://velocitypulse.io'

    // Create billing portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl || `${appUrl}/account`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    if (isDevelopment()) {
      return NextResponse.json(
        { error: 'Failed to create portal session', details: message },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to create portal session. Please try again.' },
      { status: 500 }
    )
  }
}

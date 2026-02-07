import { NextResponse } from 'next/server'

/**
 * Stripe webhook endpoint - NOT USED
 *
 * All Stripe billing webhooks are handled by the dashboard app
 * (velocitypulse-dashboard/src/app/api/webhook/stripe/route.ts).
 *
 * The Stripe webhook endpoint in the Stripe Dashboard should point to
 * the dashboard URL, not the marketing site. This route exists only as
 * a safety net to return a clear error if misconfigured.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Stripe webhooks should be directed to the dashboard app',
      hint: 'Update your Stripe webhook endpoint URL to point to the dashboard API',
    },
    { status: 410 }
  )
}

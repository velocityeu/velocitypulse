import Stripe from 'stripe'
import { loadStripe, Stripe as StripeJS } from '@stripe/stripe-js'

// Server-side Stripe instance
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-02-24.acacia',
})

// Client-side Stripe promise
let stripePromise: Promise<StripeJS | null>

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '')
  }
  return stripePromise
}

// Price IDs for plans
export const STRIPE_PRICES = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  unlimited: process.env.STRIPE_PRICE_UNLIMITED || '',
}

// Helper to create checkout session
export async function createCheckoutSession({
  plan,
  email,
  successUrl,
  cancelUrl,
}: {
  plan: 'starter' | 'unlimited'
  email?: string
  successUrl?: string
  cancelUrl?: string
}) {
  const response = await fetch('/api/stripe/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan,
      email,
      successUrl,
      cancelUrl,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to create checkout session')
  }

  return response.json()
}

// Helper to redirect to customer portal
export async function redirectToPortal(customerId: string, returnUrl?: string) {
  const response = await fetch('/api/stripe/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId,
      returnUrl,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to create portal session')
  }

  const { url } = await response.json()
  window.location.href = url
}

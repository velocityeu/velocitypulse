import Stripe from 'stripe'
import { loadStripe, Stripe as StripeJS } from '@stripe/stripe-js'
import { getServerEnv, getClientEnv, isDevelopment } from './env'

// Lazy-initialized server-side Stripe instance
let stripeInstance: Stripe | null = null

export const getStripeServer = (): Stripe => {
  if (stripeInstance) return stripeInstance

  // In development, allow missing env vars with a warning
  if (isDevelopment() && !process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY not set - Stripe features will not work')
    stripeInstance = new Stripe('sk_test_placeholder', {
      apiVersion: '2026-01-28.clover',
      maxNetworkRetries: 3,
      timeout: 30000,
    })
    return stripeInstance
  }

  const env = getServerEnv()
  stripeInstance = new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2026-01-28.clover',
    maxNetworkRetries: 3,
    timeout: 30000,
  })
  return stripeInstance
}

// Legacy export for backward compatibility
export const stripe = {
  get customers() { return getStripeServer().customers },
  get subscriptions() { return getStripeServer().subscriptions },
  get checkout() { return getStripeServer().checkout },
  get billingPortal() { return getStripeServer().billingPortal },
  get webhooks() { return getStripeServer().webhooks },
}

// Client-side Stripe promise
let stripePromise: Promise<StripeJS | null>

export const getStripe = () => {
  if (!stripePromise) {
    try {
      const env = getClientEnv()
      stripePromise = loadStripe(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    } catch {
      // In development, return null if env vars are missing
      if (isDevelopment()) {
        console.warn('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not set - Stripe checkout will not work')
        stripePromise = Promise.resolve(null)
      } else {
        throw new Error('Stripe publishable key is required')
      }
    }
  }
  return stripePromise
}

// Price IDs for plans
export const getStripePrices = () => {
  if (isDevelopment() && (!process.env.STRIPE_PRICE_STARTER || !process.env.STRIPE_PRICE_UNLIMITED)) {
    return {
      starter: 'price_placeholder_starter',
      unlimited: 'price_placeholder_unlimited',
    }
  }
  const env = getServerEnv()
  return {
    starter: env.STRIPE_PRICE_STARTER,
    unlimited: env.STRIPE_PRICE_UNLIMITED,
  }
}

// Legacy export for backward compatibility
export const STRIPE_PRICES = {
  get starter() { return getStripePrices().starter },
  get unlimited() { return getStripePrices().unlimited },
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

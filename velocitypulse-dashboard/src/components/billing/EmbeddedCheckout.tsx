'use client'

import { useCallback, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout as StripeEmbeddedCheckout } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface EmbeddedCheckoutProps {
  priceId: string
  organizationId: string
}

export function EmbeddedCheckout({ priceId, organizationId }: EmbeddedCheckoutProps) {
  const [error, setError] = useState<string | null>(null)

  const fetchClientSecret = useCallback(async () => {
    const response = await authFetch('/api/checkout/embedded', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId, organizationId }),
    })

    const data = await response.json()
    if (!response.ok) {
      setError(data.error || 'Failed to create checkout session')
      throw new Error(data.error)
    }
    return data.clientSecret
  }, [priceId, organizationId])

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
        {error}
      </div>
    )
  }

  return (
    <div id="checkout" className="w-full">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ fetchClientSecret }}
      >
        <StripeEmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  )
}

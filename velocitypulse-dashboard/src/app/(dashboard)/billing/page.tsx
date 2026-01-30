'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STARTER_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || 'price_1Sv1fgClbxBbMUCj2cyRStNN'
const UNLIMITED_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID || 'price_1Sv1hNClbxBbMUCj68XSyZ5D'

// For demo purposes - in production, get this from the user's organization
const DEMO_ORG_ID = 'demo-org-id'

const plans = [
  {
    name: 'Trial',
    price: 'Free',
    period: '14 days',
    description: 'Try VelocityPulse with full features',
    features: [
      'Up to 100 devices',
      'Up to 10 agents',
      'Up to 5 users',
      '10,000 API calls/month',
      'Email support',
    ],
    priceId: null,
    current: true,
  },
  {
    name: 'Starter',
    price: '£50',
    period: '/year',
    description: 'For small teams and organizations',
    features: [
      'Up to 100 devices',
      'Up to 10 agents',
      'Up to 10 users',
      '50,000 API calls/month',
      'Priority email support',
      'Audit logs',
    ],
    priceId: STARTER_PRICE_ID,
    popular: true,
  },
  {
    name: 'Unlimited',
    price: '£950',
    period: '/year',
    description: 'For large organizations',
    features: [
      'Up to 5,000 devices',
      'Up to 100 agents',
      'Up to 50 users',
      'Unlimited API calls',
      'Priority phone & email support',
      'Advanced audit logs',
      'Custom integrations',
      'SLA guarantee',
    ],
    priceId: UNLIMITED_PRICE_ID,
  },
]

export default function BillingPage() {
  const { user, isLoaded } = useUser()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Get organization ID from URL or user metadata
  // For now, we'll need to create an organization first
  const organizationId = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('org') || DEMO_ORG_ID
    : DEMO_ORG_ID

  const handleSubscribe = async (priceId: string) => {
    if (!priceId) return

    setLoading(priceId)
    setError(null)

    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, organizationId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(null)
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Start with a free trial, then upgrade when you&apos;re ready. All plans include core monitoring features.
        </p>
      </div>

      {error && (
        <div className="max-w-md mx-auto mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative ${plan.popular ? 'border-blue-500 border-2' : ''}`}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500">
                Most Popular
              </Badge>
            )}

            <CardHeader>
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-gray-500 dark:text-gray-400">{plan.period}</span>
              </div>
            </CardHeader>

            <CardContent>
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              {plan.current ? (
                <Button className="w-full" variant="outline" disabled>
                  Current Plan
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => plan.priceId && handleSubscribe(plan.priceId)}
                  disabled={loading !== null}
                >
                  {loading === plan.priceId ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                      Processing...
                    </span>
                  ) : (
                    `Subscribe to ${plan.name}`
                  )}
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="text-center mt-12 text-sm text-gray-500 dark:text-gray-400">
        <p>All prices exclude VAT. Cancel anytime.</p>
        <p className="mt-2">
          Questions? Contact us at{' '}
          <a href="mailto:support@velocitypulse.io" className="text-blue-500 hover:underline">
            support@velocitypulse.io
          </a>
        </p>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STARTER_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || 'price_1Sv1fgClbxBbMUCj2cyRStNN'
const UNLIMITED_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID || 'price_1Sv1hNClbxBbMUCj68XSyZ5D'

const plans = [
  {
    name: 'Starter',
    price: '\u00a350',
    period: '/year',
    description: 'For small teams and organizations',
    features: [
      'Up to 100 devices',
      'Up to 10 agents',
      'Up to 10 users',
      '50,000 API calls/month',
      'Priority email support',
    ],
    priceId: STARTER_PRICE_ID,
    popular: true,
  },
  {
    name: 'Unlimited',
    price: '\u00a3950',
    period: '/year',
    description: 'For large organizations',
    features: [
      'Up to 5,000 devices',
      'Up to 100 agents',
      'Up to 50 users',
      'Unlimited API calls',
      'White-label branding',
      'SSO / SAML authentication',
    ],
    priceId: UNLIMITED_PRICE_ID,
  },
]

export default function TrialExpiredPage() {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string>('')
  const [fetchingOrg, setFetchingOrg] = useState(true)

  useEffect(() => {
    async function fetchOrg() {
      try {
        const response = await fetch('/api/onboarding')
        if (!response.ok) {
          setFetchingOrg(false)
          return
        }
        const data = await response.json()
        if (data.organization) {
          // If org is active, redirect to dashboard
          if (data.organization.status === 'active') {
            router.push('/dashboard')
            return
          }
          setOrganizationId(data.organization.id)
        }
      } catch {
        // Continue showing page
      } finally {
        setFetchingOrg(false)
      }
    }

    fetchOrg()
  }, [router])

  const handleSubscribe = async (priceId: string) => {
    if (!priceId || !organizationId) return

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

  if (fetchingOrg) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="text-center mb-8">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
          <Clock className="h-8 w-8 text-orange-500" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Your 14-day trial has ended</h1>
        <p className="text-muted-foreground max-w-md">
          Subscribe to a plan to restore access and continue monitoring your network.
        </p>
      </div>

      {error && (
        <div className="max-w-md w-full mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl w-full">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative ${plan.popular ? 'border-primary border-2' : ''}`}
          >
            {plan.popular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                Most Popular
              </Badge>
            )}

            <CardHeader>
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
            </CardHeader>

            <CardContent>
              <ul className="space-y-2">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>

            <CardFooter>
              <Button
                className="w-full"
                variant={plan.popular ? 'default' : 'outline'}
                onClick={() => handleSubscribe(plan.priceId)}
                disabled={loading !== null}
              >
                {loading === plan.priceId ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  `Subscribe to ${plan.name}`
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <p className="text-center mt-8 text-sm text-muted-foreground">
        All prices exclude VAT. Questions?{' '}
        <a href="mailto:support@velocitypulse.io" className="text-primary hover:underline">
          Contact support
        </a>
      </p>
    </div>
  )
}

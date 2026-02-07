'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Check, Loader2, CreditCard, AlertTriangle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STARTER_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || 'price_1Sv1fgClbxBbMUCj2cyRStNN'
const UNLIMITED_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID || 'price_1Sv1hNClbxBbMUCj68XSyZ5D'

interface Organization {
  id: string
  name: string
  plan: string
  status: string
  trial_ends_at: string | null
}

interface SubscriptionInfo {
  plan: string
  status: string
  current_period_end: string
  amount_cents: number
}

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
  },
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
      'Audit logs',
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
      'Priority phone & email support',
      'Advanced audit logs',
      'Custom integrations',
      'SLA guarantee',
      'White-label branding',
      'SSO / SAML authentication',
    ],
    priceId: UNLIMITED_PRICE_ID,
  },
]

export default function BillingPage() {
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [fetchingOrg, setFetchingOrg] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)

  // Fetch user's organization and subscription
  useEffect(() => {
    async function fetchData() {
      try {
        const [orgResponse, subResponse] = await Promise.all([
          fetch('/api/onboarding'),
          fetch('/api/billing/subscription'),
        ])

        const orgData = await orgResponse.json()

        if (!orgData.hasOrganization) {
          router.push('/onboarding')
          return
        }

        setOrganization(orgData.organization)

        if (subResponse.ok) {
          const subData = await subResponse.json()
          if (subData.subscription) {
            setSubscription(subData.subscription)
          }
        }
      } catch (err) {
        console.error('Failed to fetch billing data:', err)
        setError('Failed to load billing information')
      } finally {
        setFetchingOrg(false)
      }
    }

    if (isLoaded && user) {
      fetchData()
    }
  }, [isLoaded, user, router])

  const organizationId = organization?.id || ''
  const currentPlan = organization?.plan || 'trial'

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

  const handleManageSubscription = async () => {
    setPortalLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal')
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPortalLoading(false)
    }
  }

  if (!isLoaded || fetchingOrg) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Update plans to show current plan
  const plansWithCurrent = plans.map(plan => ({
    ...plan,
    current: (plan.name.toLowerCase() === currentPlan) ||
             (plan.name === 'Trial' && currentPlan === 'trial'),
  }))

  const formatRenewalDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  const formatAmount = (cents: number) => {
    return `\u00a3${(cents / 100).toFixed(2)}`
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-4">Choose Your Plan</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Start with a free trial, then upgrade when you&apos;re ready. All plans include core monitoring features.
        </p>
      </div>

      {error && (
        <div className="max-w-md mx-auto mb-8 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
          {error}
        </div>
      )}

      {/* Current Subscription Card */}
      {subscription && (
        <div className="max-w-2xl mx-auto mb-10">
          {organization?.status === 'past_due' && (
            <div className="mb-4 p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="font-medium text-orange-500">Payment failed</p>
                <p className="text-sm text-muted-foreground">Please update your payment method to avoid service interruption.</p>
              </div>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Subscription
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-semibold">
                      {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)} Plan
                    </span>
                    <Badge variant={subscription.status === 'active' ? 'default' : 'destructive'}>
                      {subscription.status === 'active' ? 'Active' : 'Past Due'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Next renewal: {formatRenewalDate(subscription.current_period_end)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold">{formatAmount(subscription.amount_cents)}</div>
                  <p className="text-sm text-muted-foreground">/year</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex gap-2">
              <Button onClick={handleManageSubscription} disabled={portalLoading}>
                {portalLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ExternalLink className="h-4 w-4 mr-2" />
                )}
                Manage Subscription
              </Button>
              <Button variant="outline" asChild>
                <a href="#plans">Change Plan</a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* Plan Cards */}
      <div id="plans" className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
        {plansWithCurrent.map((plan) => (
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
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-status-online shrink-0 mt-0.5" />
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

      <div className="text-center mt-12 text-sm text-muted-foreground">
        <p>All prices exclude VAT. Cancel anytime.</p>
        <p className="mt-2">
          Questions? Contact us at{' '}
          <a href="mailto:support@velocitypulse.io" className="text-primary hover:underline">
            support@velocitypulse.io
          </a>
        </p>
      </div>
    </div>
  )
}

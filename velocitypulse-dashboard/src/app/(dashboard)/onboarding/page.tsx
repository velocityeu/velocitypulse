'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { useRouter } from 'next/navigation'
import { useCurrentUser } from '@/lib/contexts/UserContext'
import { Building2, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PlanCards } from '@/components/billing/PlanCards'
import { EmbeddedCheckout } from '@/components/billing/EmbeddedCheckout'

export default function OnboardingPage() {
  const router = useRouter()
  const { user, isLoading: userLoading } = useCurrentUser()
  const isLoaded = !userLoading
  const [step, setStep] = useState<1 | 2>(1)
  const [orgName, setOrgName] = useState('')
  const [organizationId, setOrganizationId] = useState<string>('')
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check if user already has an organization
  useEffect(() => {
    async function checkOrganization() {
      try {
        const response = await authFetch('/api/onboarding')
        const data = await response.json()

        if (data.hasOrganization) {
          router.push('/dashboard')
          return
        }
      } catch (err) {
        console.error('Failed to check organization:', err)
      } finally {
        setChecking(false)
      }
    }

    if (isLoaded && user) {
      checkOrganization()
    }
  }, [isLoaded, user, router])

  // Pre-fill with user's email domain
  useEffect(() => {
    if (user && !orgName) {
      const email = user.email
      if (email) {
        const domain = email.split('@')[1]
        if (domain && !['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com'].includes(domain)) {
          const domainName = domain.split('.')[0]
          setOrgName(domainName.charAt(0).toUpperCase() + domainName.slice(1))
        }
      }
    }
  }, [user, orgName])

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!orgName.trim() || orgName.trim().length < 2) {
      setError('Organization name must be at least 2 characters')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await authFetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationName: orgName.trim() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create organization')
      }

      // Store org ID and advance to step 2
      setOrganizationId(data.organization.id)
      setStep(2)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectPlan = (planId: string, priceId: string | null) => {
    if (!priceId) {
      // Free trial — go straight to dashboard
      router.push('/dashboard')
      return
    }
    // Paid plan — show embedded checkout
    setSelectedPriceId(priceId)
  }

  if (!isLoaded || checking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background px-4 py-8">
      {step === 1 && (
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Welcome to VelocityPulse</CardTitle>
            <CardDescription>
              Let&apos;s set up your organization to get started with network monitoring.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleCreateOrg} className="space-y-6">
              <div>
                <label
                  htmlFor="orgName"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Organization Name
                </label>
                <Input
                  type="text"
                  id="orgName"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g., Acme Corp"
                  disabled={loading}
                  autoFocus
                />
                <p className="mt-2 text-sm text-muted-foreground">
                  This is how your organization will appear in VelocityPulse.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading || !orgName.trim()}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === 2 && !selectedPriceId && (
        <div className="w-full max-w-6xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-2">Choose Your Plan</h1>
            <p className="text-muted-foreground">
              Start with a free trial or pick a plan to get going right away.
            </p>
          </div>

          <PlanCards
            onSelectPlan={handleSelectPlan}
            showTrialCard={true}
          />

          <p className="text-center mt-8 text-sm text-muted-foreground">
            All prices exclude VAT. Cancel anytime.
          </p>
        </div>
      )}

      {step === 2 && selectedPriceId && (
        <div className="w-full max-w-2xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">Complete Your Subscription</h1>
            <p className="text-muted-foreground">
              Enter your payment details to activate your plan.
            </p>
          </div>

          <EmbeddedCheckout
            priceId={selectedPriceId}
            organizationId={organizationId}
          />

          <div className="text-center mt-4">
            <Button
              variant="ghost"
              onClick={() => setSelectedPriceId(null)}
              className="text-sm text-muted-foreground"
            >
              Back to plan selection
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

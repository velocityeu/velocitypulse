'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PlanCards } from '@/components/billing/PlanCards'
import { EmbeddedCheckout } from '@/components/billing/EmbeddedCheckout'

export default function TrialExpiredPage() {
  const router = useRouter()
  const [organizationId, setOrganizationId] = useState<string>('')
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null)
  const [fetchingOrg, setFetchingOrg] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  const handleSelectPlan = (_planId: string, priceId: string | null) => {
    if (!priceId || !organizationId) return
    setSelectedPriceId(priceId)
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

      {!selectedPriceId && (
        <div className="w-full max-w-3xl">
          <PlanCards
            onSelectPlan={handleSelectPlan}
            showTrialCard={false}
          />
        </div>
      )}

      {selectedPriceId && organizationId && (
        <div className="w-full max-w-2xl">
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

      <p className="text-center mt-8 text-sm text-muted-foreground">
        All prices exclude VAT. Questions?{' '}
        <a href="mailto:support@velocitypulse.io" className="text-primary hover:underline">
          Contact support
        </a>
      </p>
    </div>
  )
}

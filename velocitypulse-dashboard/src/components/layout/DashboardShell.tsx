'use client'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { formatTrialStatus, getTrialDaysRemaining } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface DashboardShellProps {
  children: React.ReactNode
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { organization, isLoading, error } = useOrganization()

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-6 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading dashboard...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        <main className="flex-1 container px-4 py-6 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-lg font-medium text-destructive">Failed to load organization</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // Normal render with organization context
  const planInfo = organization
    ? formatTrialStatus(organization)
    : undefined

  const trialDaysRemaining = organization?.plan === 'trial'
    ? getTrialDaysRemaining(organization.trial_ends_at)
    : null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        organizationName={organization?.name}
        planName={planInfo}
        trialDaysRemaining={trialDaysRemaining}
      />
      <main className="flex-1 container px-4 py-6">
        {children}
      </main>
      <Footer />
    </div>
  )
}

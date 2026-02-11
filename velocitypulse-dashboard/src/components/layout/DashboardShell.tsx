'use client'

import { useState } from 'react'
import { Bell, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Sidebar, MobileSidebar, MobileMenuButton } from '@/components/layout/Sidebar'
import { DashboardInfoBar } from '@/components/layout/DashboardInfoBar'
import { AgentStatusIndicator } from '@/components/dashboard/AgentStatusIndicator'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { useCurrentUser } from '@/lib/contexts/UserContext'
import { useBranding } from '@/lib/hooks/useBranding'
import { formatTrialStatus, getTrialDaysRemaining } from '@/lib/utils'
import { UserMenu } from '@/components/layout/UserMenu'
import Link from 'next/link'
import Image from 'next/image'

interface DashboardShellProps {
  children: React.ReactNode
}

// Determine badge variant based on plan/trial status
function getBadgeVariant(planName: string, trialDaysRemaining?: number | null): 'trial' | 'trial-warning' | 'trial-expired' | 'premium' | 'starter' {
  if (planName.includes('Expired') || planName.includes('Payment Due') || planName.includes('Suspended')) {
    return 'trial-expired'
  }
  if (planName.includes('Trial') && trialDaysRemaining != null && trialDaysRemaining <= 7) {
    return 'trial-warning'
  }
  if (planName.includes('Trial')) {
    return 'trial'
  }
  if (planName === 'Unlimited') {
    return 'premium'
  }
  return 'starter'
}

function useIsStaff(): boolean {
  const { user } = useCurrentUser()
  return user?.is_staff === true
}

export function DashboardShell({ children }: DashboardShellProps) {
  const { organization, isLoading, error } = useOrganization()
  const branding = useBranding()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const isStaff = useIsStaff()

  // Get plan info
  const planInfo = organization ? formatTrialStatus(organization) : undefined
  const trialDaysRemaining = organization?.plan === 'trial'
    ? getTrialDaysRemaining(organization.trial_ends_at)
    : null

  // Render header (used in all states)
  const renderHeader = () => (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 gap-4">
        {/* Mobile menu button */}
        <MobileMenuButton onClick={() => setMobileMenuOpen(true)} />

        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image
            src={branding.logoUrl}
            alt={branding.displayName}
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="hidden font-semibold sm:inline-block">
            {branding.displayName}
          </span>
          {organization && (
            <>
              <span className="hidden text-muted-foreground sm:inline-block">/</span>
              <span className="hidden text-muted-foreground sm:inline-block">{organization.name}</span>
            </>
          )}
          {planInfo && (
            <Link href="/billing" className="ml-2">
              <Badge
                variant={getBadgeVariant(planInfo, trialDaysRemaining)}
                className="transition-opacity hover:opacity-80 cursor-pointer"
              >
                {planInfo}
              </Badge>
            </Link>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Agent Status */}
        {organization && (
          <AgentStatusIndicator organizationId={organization.id} />
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Bell className="h-4 w-4" />
            <span className="sr-only">Notifications</span>
          </Button>

          <UserMenu />
        </div>
      </div>
    </header>
  )

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {renderHeader()}
        <div className="flex flex-1">
          <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} isStaff={isStaff} />
          <main className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading dashboard...</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {renderHeader()}
        <div className="flex flex-1">
          <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} isStaff={isStaff} />
          <main className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-lg font-medium text-destructive">Failed to load organization</p>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // No organization loaded (not loading, no error — e.g. after redirect failure)
  if (!organization) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {renderHeader()}
        <div className="flex flex-1">
          <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} isStaff={isStaff} />
          <main className="flex-1 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-lg font-medium">No organization found</p>
              <p className="text-sm text-muted-foreground">Please complete onboarding to continue.</p>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Normal render with organization context
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {renderHeader()}
      <DashboardInfoBar />
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} isStaff={isStaff} />
      <div className="flex flex-1">
        <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} isStaff={isStaff} />
        <main className="flex-1 overflow-auto">
          <div className="container px-4 py-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

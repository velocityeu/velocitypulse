'use client'

import { useState } from 'react'
import { RefreshCw, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Sidebar, MobileSidebar, MobileMenuButton } from '@/components/layout/Sidebar'
import { useOrganization } from '@/lib/contexts/OrganizationContext'
import { formatTrialStatus, getTrialDaysRemaining } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

// Dynamically import UserButton to prevent SSR issues
const UserButton = dynamic(
  () => import('@clerk/nextjs').then((mod) => mod.UserButton),
  {
    ssr: false,
    loading: () => (
      <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
    ),
  }
)

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

export function DashboardShell({ children }: DashboardShellProps) {
  const { organization, isLoading, error } = useOrganization()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">V</span>
          </div>
          <span className="hidden font-semibold sm:inline-block">
            VelocityPulse
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

        {/* Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />

          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Bell className="h-4 w-4" />
            <span className="sr-only">Notifications</span>
          </Button>

          <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                avatarBox: 'h-8 w-8',
              },
            }}
          />
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
          <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} />
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
          <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} />
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

  // Normal render with organization context
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {renderHeader()}
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
      <div className="flex flex-1">
        <Sidebar collapsed={sidebarCollapsed} onCollapse={setSidebarCollapsed} />
        <main className="flex-1 overflow-auto">
          <div className="container px-4 py-6 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

'use client'

import { RefreshCw, Bell, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
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

// Dynamically import useClerk to handle cases where Clerk is not available
const ClerkUserSection = dynamic(
  () =>
    Promise.resolve(function ClerkUserSectionComponent() {
      // This component is only rendered when Clerk is available
      return (
        <UserButton
          afterSignOutUrl="/"
          appearance={{
            elements: {
              avatarBox: 'h-8 w-8',
            },
          }}
        />
      )
    }),
  {
    ssr: false,
    loading: () => (
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <User className="h-4 w-4" />
        <span className="sr-only">User</span>
      </Button>
    ),
  }
)

interface HeaderProps {
  onRefresh?: () => void
  isRefreshing?: boolean
  organizationName?: string
  planName?: string
  trialDaysRemaining?: number | null
}

export function Header({
  onRefresh,
  isRefreshing,
  organizationName,
  planName,
  trialDaysRemaining,
}: HeaderProps) {
  // Determine badge color based on plan/trial status
  const getBadgeClasses = () => {
    if (!planName) return ''

    // Warning colors for low trial days or payment issues
    if (planName.includes('Expired') || planName.includes('Payment Due') || planName.includes('Suspended')) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
    }

    // Warning colors for trial with <= 7 days
    if (planName.includes('Trial') && trialDaysRemaining != null && trialDaysRemaining <= 7) {
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
    }

    // Trial colors
    if (planName.includes('Trial')) {
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    }

    // Unlimited plan
    if (planName === 'Unlimited') {
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
    }

    // Starter plan
    return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg font-bold text-primary-foreground">V</span>
          </div>
          <span className="hidden font-semibold sm:inline-block">
            VelocityPulse
          </span>
          {organizationName && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">{organizationName}</span>
            </>
          )}
          {planName && (
            <Link href="/billing" className="ml-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium transition-opacity hover:opacity-80',
                  getBadgeClasses()
                )}
              >
                {planName}
              </span>
            </Link>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-9 w-9"
            >
              <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
              <span className="sr-only">Refresh</span>
            </Button>
          )}

          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Bell className="h-4 w-4" />
            <span className="sr-only">Notifications</span>
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9" asChild>
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              <span className="sr-only">Settings</span>
            </Link>
          </Button>

          <ClerkUserSection />
        </div>
      </div>
    </header>
  )
}

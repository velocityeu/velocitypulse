'use client'

import { RefreshCw, Bell, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { AgentStatusIndicator } from '@/components/dashboard/AgentStatusIndicator'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import Image from 'next/image'

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
  organizationId?: string
  organizationName?: string
  planName?: string
  trialDaysRemaining?: number | null
}

// Determine badge variant based on plan/trial status
function getBadgeVariant(planName: string, trialDaysRemaining?: number | null): 'trial' | 'trial-warning' | 'trial-expired' | 'premium' | 'starter' {
  // Expired or payment issues
  if (planName.includes('Expired') || planName.includes('Payment Due') || planName.includes('Suspended')) {
    return 'trial-expired'
  }

  // Trial with <= 7 days warning
  if (planName.includes('Trial') && trialDaysRemaining != null && trialDaysRemaining <= 7) {
    return 'trial-warning'
  }

  // Active trial
  if (planName.includes('Trial')) {
    return 'trial'
  }

  // Unlimited/Premium plan
  if (planName === 'Unlimited') {
    return 'premium'
  }

  // Starter plan
  return 'starter'
}

export function Header({
  onRefresh,
  isRefreshing,
  organizationId,
  organizationName,
  planName,
  trialDaysRemaining,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        {/* Logo */}
        <div className="flex items-center gap-2 mr-4">
          <Image
            src="/velocity-symbol.png"
            alt="VelocityPulse"
            width={32}
            height={32}
            className="rounded-lg"
          />
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
              <Badge
                variant={getBadgeVariant(planName, trialDaysRemaining)}
                className="transition-opacity hover:opacity-80 cursor-pointer"
              >
                {planName}
              </Badge>
            </Link>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Agent Status */}
        {organizationId && (
          <AgentStatusIndicator organizationId={organizationId} />
        )}

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
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="sr-only">Refresh</span>
            </Button>
          )}

          <ThemeToggle />

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

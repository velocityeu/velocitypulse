'use client'

import { RefreshCw, Bell, Settings, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

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
}

export function Header({ onRefresh, isRefreshing, organizationName }: HeaderProps) {
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

          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Settings className="h-4 w-4" />
            <span className="sr-only">Settings</span>
          </Button>

          <ClerkUserSection />
        </div>
      </div>
    </header>
  )
}

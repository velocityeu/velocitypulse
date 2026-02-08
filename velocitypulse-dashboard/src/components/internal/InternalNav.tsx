'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Clock,
  ShieldAlert,
  HeadphonesIcon,
  CreditCard,
  ChevronLeft,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const navItems = [
  {
    label: 'Dashboard',
    href: '/internal/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Organizations',
    href: '/internal/organizations',
    icon: Building2,
  },
  {
    label: 'Trials',
    href: '/internal/trials',
    icon: Clock,
  },
  {
    label: 'Subscriptions',
    href: '/internal/subscriptions',
    icon: CreditCard,
  },
  {
    label: 'Admins',
    href: '/internal/admins',
    icon: Users,
  },
  {
    label: 'Security',
    href: '/internal/security',
    icon: ShieldAlert,
  },
  {
    label: 'Support',
    href: '/internal/support',
    icon: HeadphonesIcon,
    badgeKey: 'support',
  },
]

interface InternalNavProps {
  collapsed?: boolean
  onCollapse?: (collapsed: boolean) => void
}

export function InternalNav({ collapsed = false, onCollapse }: InternalNavProps) {
  const pathname = usePathname()
  const [openTicketCount, setOpenTicketCount] = useState(0)

  useEffect(() => {
    fetchTicketCount()
    // Refresh every 60 seconds
    const interval = setInterval(fetchTicketCount, 60000)
    return () => clearInterval(interval)
  }, [])

  async function fetchTicketCount() {
    try {
      const res = await fetch('/api/internal/support')
      if (res.ok) {
        const data = await res.json()
        if (data.stats) {
          setOpenTicketCount(data.stats.open + data.stats.in_progress)
        }
      }
    } catch {
      // Silently fail — badge is cosmetic
    }
  }

  return (
    <nav className={cn(
      'hidden md:flex flex-col border-r bg-muted/30 min-h-[calc(100vh-3.5rem)] transition-all duration-300',
      collapsed ? 'w-16' : 'w-56'
    )}>
      {/* Collapse toggle */}
      <div className={cn(
        'flex items-center border-b h-12',
        collapsed ? 'justify-center' : 'justify-end px-3'
      )}>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCollapse?.(!collapsed)}
          className="h-8 w-8"
        >
          <ChevronLeft className={cn(
            'h-4 w-4 transition-transform',
            collapsed && 'rotate-180'
          )} />
        </Button>
      </div>

      {/* Navigation */}
      <div className="p-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const badgeCount = item.badgeKey === 'support' ? openTicketCount : 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                collapsed && 'justify-center px-2'
              )}
              title={collapsed ? item.label : undefined}
            >
              <div className="relative">
                <item.icon className="h-4 w-4 shrink-0" />
                {collapsed && badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full bg-red-500" />
                )}
              </div>
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {badgeCount > 0 && (
                    <Badge
                      className={cn(
                        'h-5 min-w-[20px] px-1.5 text-xs',
                        isActive
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-red-500/10 text-red-500'
                      )}
                    >
                      {badgeCount}
                    </Badge>
                  )}
                </>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

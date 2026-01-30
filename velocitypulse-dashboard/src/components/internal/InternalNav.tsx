'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Building2,
  Clock,
  ShieldAlert,
  HeadphonesIcon,
} from 'lucide-react'
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
    label: 'Security',
    href: '/internal/security',
    icon: ShieldAlert,
  },
  {
    label: 'Support',
    href: '/internal/support',
    icon: HeadphonesIcon,
  },
]

export function InternalNav() {
  const pathname = usePathname()

  return (
    <nav className="w-64 border-r bg-muted/30 min-h-[calc(100vh-3.5rem)]">
      <div className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Monitor,
  Activity,
  BarChart3,
  FolderOpen,
  Server,
  Users,
  Bell,
  Settings,
  ChevronLeft,
  Menu,
  ExternalLink,
  Shield,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useBranding } from '@/lib/hooks/useBranding'
import Image from 'next/image'

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: Activity },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'Devices', href: '/devices', icon: Monitor },
  { label: 'Categories', href: '/categories', icon: FolderOpen },
  { label: 'Agents', href: '/agents', icon: Server },
  { label: 'Users', href: '/users', icon: Users },
  { label: 'Notifications', href: '/notifications', icon: Bell },
  { label: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarProps {
  collapsed?: boolean
  onCollapse?: (collapsed: boolean) => void
  isStaff?: boolean
}

export function Sidebar({ collapsed = false, onCollapse, isStaff }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-56'
      )}
    >
      {/* Collapse toggle */}
      <div className={cn(
        'flex items-center border-b h-14',
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
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href))

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    collapsed && 'justify-center px-2'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>

        {/* Admin link for staff users */}
        {isStaff && (
          <>
            <div className="mx-2 my-2 border-t" />
            <ul className="px-2">
              <li>
                <Link
                  href="/internal/dashboard"
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    pathname.startsWith('/internal')
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                    collapsed && 'justify-center px-2'
                  )}
                  title={collapsed ? 'Admin' : undefined}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>Admin</span>}
                </Link>
              </li>
            </ul>
          </>
        )}
      </nav>

      {/* Footer - Link to marketing site */}
      <div className="border-t p-2">
        <a
          href="https://velocitypulse.io"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors',
            collapsed && 'justify-center px-2'
          )}
          title={collapsed ? 'VelocityPulse.io' : undefined}
        >
          <ExternalLink className="h-4 w-4 shrink-0" />
          {!collapsed && <span>VelocityPulse.io</span>}
        </a>
      </div>
    </aside>
  )
}

// Mobile sidebar with sheet/drawer behavior
export function MobileSidebar({ open, onOpenChange, isStaff }: { open: boolean; onOpenChange: (open: boolean) => void; isStaff?: boolean }) {
  const pathname = usePathname()
  const branding = useBranding()

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
        onClick={() => onOpenChange(false)}
      />

      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-card border-r shadow-lg md:hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between h-14 px-4 border-b">
          <div className="flex items-center gap-2">
            <Image
              src={branding.logoUrl}
              alt={branding.displayName}
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="font-semibold">{branding.displayName}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4">
          <ul className="space-y-1 px-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Admin link for staff users */}
          {isStaff && (
            <>
              <div className="mx-2 my-2 border-t" />
              <ul className="px-2">
                <li>
                  <Link
                    href="/internal/dashboard"
                    onClick={() => onOpenChange(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      pathname.startsWith('/internal')
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Shield className="h-4 w-4 shrink-0" />
                    <span>Admin</span>
                  </Link>
                </li>
              </ul>
            </>
          )}
        </nav>

        {/* Footer - Link to marketing site */}
        <div className="border-t p-2">
          <a
            href="https://velocitypulse.io"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span>VelocityPulse.io</span>
          </a>
        </div>
      </aside>
    </>
  )
}

// Mobile menu button
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="h-9 w-9 md:hidden"
    >
      <Menu className="h-5 w-5" />
      <span className="sr-only">Toggle menu</span>
    </Button>
  )
}

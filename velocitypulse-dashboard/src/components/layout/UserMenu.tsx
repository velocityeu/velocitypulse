'use client'

import { useState, useRef, useEffect } from 'react'
import { useClerk } from '@clerk/nextjs'
import { useCurrentUser } from '@/lib/contexts/UserContext'
import { clearUserCache } from '@/lib/contexts/UserContext'
import { clearOrgCache } from '@/lib/contexts/OrganizationContext'
import { LogOut, Settings, User } from 'lucide-react'
import Link from 'next/link'

export function UserMenu() {
  const { user } = useCurrentUser()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (open) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
    : ''

  const initials = user
    ? (user.first_name?.[0] || '') + (user.last_name?.[0] || '') || user.email[0]?.toUpperCase()
    : '?'

  const handleSignOut = async () => {
    clearUserCache()
    clearOrgCache()
    await signOut({ redirectUrl: '/' })
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center justify-center h-8 w-8 rounded-full overflow-hidden border border-border hover:ring-2 hover:ring-primary/20 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label="User menu"
      >
        {user?.image_url ? (
          <img
            src={user.image_url}
            alt={fullName}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground text-xs font-medium">
            {initials}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border bg-popover shadow-lg z-50 py-1">
          {/* User info */}
          <div className="px-3 py-2 border-b">
            <p className="text-sm font-medium truncate">{fullName}</p>
            {user?.email && fullName !== user.email && (
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            )}
          </div>

          {/* Menu items */}
          <div className="py-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>

          {/* Sign out */}
          <div className="border-t py-1">
            <button
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors text-destructive"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { Shield } from 'lucide-react'
import Link from 'next/link'

export function InternalHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-6">
        <Link href="/internal/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold">VelocityPulse Admin</span>
        </Link>
        <div className="ml-4 rounded bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-500">
          Internal
        </div>
        <div className="flex-1" />
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Exit to Dashboard
        </Link>
      </div>
    </header>
  )
}

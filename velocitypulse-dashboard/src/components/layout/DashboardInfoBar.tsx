'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { useUser } from '@clerk/nextjs'
import { APP_VERSION, LATEST_AGENT_VERSION } from '@/lib/constants'

export function DashboardInfoBar() {
  const { user } = useUser()
  const [time, setTime] = useState('')
  const [clientIp, setClientIp] = useState<string | null>(null)

  // Live clock (1s interval)
  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [])

  // Fetch client IP on mount
  useEffect(() => {
    authFetch('/api/client-info')
      .then(res => res.json())
      .then(data => setClientIp(data.ip))
      .catch(() => setClientIp(null))
  }, [])

  const email = user?.primaryEmailAddress?.emailAddress

  return (
    <div className="hidden md:flex items-center justify-between px-4 h-7 border-b bg-muted/30 text-[11px] font-mono text-muted-foreground select-none">
      <div className="flex items-center gap-4">
        <span>Dashboard v{APP_VERSION}</span>
        <span className="text-muted-foreground/50">|</span>
        <span>Agent v{LATEST_AGENT_VERSION}</span>
      </div>
      <div className="flex items-center gap-4">
        <span>{time}</span>
        {clientIp && (
          <>
            <span className="text-muted-foreground/50">|</span>
            <span>{clientIp}</span>
          </>
        )}
        {email && (
          <>
            <span className="text-muted-foreground/50">|</span>
            <span>{email}</span>
          </>
        )}
      </div>
    </div>
  )
}

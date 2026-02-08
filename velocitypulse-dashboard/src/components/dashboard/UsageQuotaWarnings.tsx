'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

interface UsageEntry {
  current: number
  limit: number
  percentage: number
  period?: string
}

interface UsageData {
  usage: {
    devices: UsageEntry
    agents: UsageEntry
    members: UsageEntry
    apiCalls: UsageEntry
  }
}

const RESOURCE_LABELS: Record<string, string> = {
  devices: 'Devices',
  agents: 'Agents',
  members: 'Members',
  apiCalls: 'API Calls',
}

export function UsageQuotaWarnings() {
  const [warnings, setWarnings] = useState<{ key: string; label: string; percentage: number; current: number; limit: number }[]>([])
  const [maxLevel, setMaxLevel] = useState<'none' | 'warning' | 'critical'>('none')

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await authFetch('/api/dashboard/usage')
        if (!res.ok) return

        const data: UsageData = await res.json()
        const entries: typeof warnings = []
        let level: 'none' | 'warning' | 'critical' = 'none'

        for (const [key, entry] of Object.entries(data.usage)) {
          // Skip unlimited resources (limit = -1)
          if (entry.limit === -1) continue

          if (entry.percentage >= 95) {
            entries.push({ key, label: RESOURCE_LABELS[key] || key, ...entry })
            level = 'critical'
          } else if (entry.percentage >= 80) {
            entries.push({ key, label: RESOURCE_LABELS[key] || key, ...entry })
            if (level !== 'critical') level = 'warning'
          }
        }

        setWarnings(entries)
        setMaxLevel(level)
      } catch {
        // Silently ignore fetch errors
      }
    }

    fetchUsage()
  }, [])

  if (warnings.length === 0) return null

  const isCritical = maxLevel === 'critical'
  const bgClass = isCritical
    ? 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900'
    : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900'
  const textClass = isCritical
    ? 'text-red-800 dark:text-red-200'
    : 'text-yellow-800 dark:text-yellow-200'
  const iconClass = isCritical
    ? 'text-red-500'
    : 'text-yellow-500'

  return (
    <div className={`rounded-lg border p-4 ${bgClass}`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`h-5 w-5 mt-0.5 shrink-0 ${iconClass}`} />
        <div className="flex-1">
          <p className={`font-medium ${textClass}`}>
            {isCritical ? 'Usage limit almost reached' : 'Approaching usage limits'}
          </p>
          <ul className={`mt-1 text-sm ${textClass} space-y-0.5`}>
            {warnings.map(w => (
              <li key={w.key}>
                {w.label}: {w.current.toLocaleString()} / {w.limit.toLocaleString()} ({w.percentage}%)
              </li>
            ))}
          </ul>
          <Link
            href="/billing"
            className={`inline-block mt-2 text-sm font-medium underline ${textClass}`}
          >
            Upgrade your plan
          </Link>
        </div>
      </div>
    </div>
  )
}

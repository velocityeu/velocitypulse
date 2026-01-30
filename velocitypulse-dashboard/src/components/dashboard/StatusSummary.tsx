'use client'

import { Activity, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import type { StatusSummary as StatusSummaryType } from '@/types'

interface StatusSummaryProps {
  summary: StatusSummaryType
  lastCheck?: string
}

export function StatusSummary({ summary }: StatusSummaryProps) {
  const items = [
    {
      label: 'Total',
      value: summary.total,
      icon: Activity,
      color: 'text-foreground',
      bgColor: 'bg-muted',
    },
    {
      label: 'Online',
      value: summary.online,
      icon: CheckCircle2,
      color: 'text-status-online',
      bgColor: 'bg-status-online/10',
    },
    {
      label: 'Offline',
      value: summary.offline,
      icon: XCircle,
      color: 'text-status-offline',
      bgColor: 'bg-status-offline/10',
    },
    {
      label: 'Degraded',
      value: summary.degraded,
      icon: AlertTriangle,
      color: 'text-status-degraded',
      bgColor: 'bg-status-degraded/10',
    },
  ]

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
      {items.map(item => (
        <div
          key={item.label}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 ${item.bgColor}`}
        >
          <item.icon className={`h-4 w-4 ${item.color}`} />
          <span className="text-sm font-medium">{item.value}</span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  )
}

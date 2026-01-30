'use client'

import { cn } from '@/lib/utils'
import type { DeviceStatus } from '@/types'

interface StatusIndicatorProps {
  status: DeviceStatus
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const statusConfig: Record<DeviceStatus, { color: string; label: string; bgColor: string }> = {
  online: { color: 'bg-status-online', label: 'Online', bgColor: 'bg-status-online/20' },
  offline: { color: 'bg-status-offline', label: 'Offline', bgColor: 'bg-status-offline/20' },
  degraded: { color: 'bg-status-degraded', label: 'Degraded', bgColor: 'bg-status-degraded/20' },
  unknown: { color: 'bg-status-unknown', label: 'Unknown', bgColor: 'bg-status-unknown/20' },
}

const sizeConfig = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-4 w-4',
}

export function StatusIndicator({ status, size = 'md', showLabel = false }: StatusIndicatorProps) {
  const config = statusConfig[status]

  return (
    <div className="flex items-center gap-2">
      <div className={cn('relative', sizeConfig[size])}>
        <div className={cn('absolute inset-0 rounded-full', config.color)} />
        {status === 'online' && (
          <div className={cn('absolute inset-0 rounded-full animate-ping opacity-75', config.color)} />
        )}
      </div>
      {showLabel && (
        <span className={cn(
          'text-sm font-medium',
          status === 'online' && 'text-status-online',
          status === 'offline' && 'text-status-offline',
          status === 'degraded' && 'text-status-degraded',
          status === 'unknown' && 'text-muted-foreground'
        )}>
          {config.label}
        </span>
      )}
    </div>
  )
}

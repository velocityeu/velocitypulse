'use client'

import { Server, Monitor, Router, Printer, Wifi, HelpCircle, Box, Network, Database, Cloud, Globe, Cpu, HardDrive, Shield, type LucideIcon } from 'lucide-react'
import { StatusIndicator } from './StatusIndicator'
import { cn, formatResponseTime } from '@/lib/utils'
import type { Device, Category, DeviceType } from '@/types'

interface DeviceCardCompactProps {
  device: Device
  category?: Category
  onClick?: () => void
}

// Device type icons
const deviceTypeIcons: Record<DeviceType, LucideIcon> = {
  server: Server,
  workstation: Monitor,
  network: Router,
  printer: Printer,
  iot: Wifi,
  unknown: HelpCircle,
}

// Icon lookup map
const iconMap: Record<string, LucideIcon> = {
  server: Server,
  monitor: Monitor,
  router: Router,
  printer: Printer,
  wifi: Wifi,
  'help-circle': HelpCircle,
  box: Box,
  network: Network,
  database: Database,
  cloud: Cloud,
  globe: Globe,
  cpu: Cpu,
  'hard-drive': HardDrive,
  shield: Shield,
}

export function DeviceCardCompact({ device, category, onClick }: DeviceCardCompactProps) {
  const iconName = category?.icon || device.icon || 'box'
  const iconColor = category?.color || '#6B7280'
  const Icon = iconMap[iconName.toLowerCase()] || Box

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border bg-card cursor-pointer',
        'hover:bg-accent/50 transition-colors',
        device.status === 'offline' && 'opacity-70'
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: category?.color ? `${category.color}15` : '#6B728015' }}
      >
        <Icon className="h-4 w-4" style={{ color: iconColor }} />
      </div>

      {/* Name & IP */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{device.name}</p>
        {device.ip_address && (
          <p className="text-xs text-muted-foreground font-mono">{device.ip_address}</p>
        )}
      </div>

      {/* Response Time */}
      {device.status === 'online' && device.response_time_ms !== null && device.response_time_ms !== undefined && (
        <span
          className={cn(
            'text-xs font-mono',
            device.response_time_ms < 100 && 'text-status-online',
            device.response_time_ms >= 100 && device.response_time_ms < 500 && 'text-status-degraded',
            device.response_time_ms >= 500 && 'text-status-offline'
          )}
        >
          {formatResponseTime(device.response_time_ms)}
        </span>
      )}

      {/* Status */}
      <StatusIndicator status={device.status} size="sm" />
    </div>
  )
}

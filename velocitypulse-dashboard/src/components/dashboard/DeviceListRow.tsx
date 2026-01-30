'use client'

import { ExternalLink, Server, Monitor, Router, Printer, Wifi, HelpCircle, Box, Network, Database, Cloud, Globe, Cpu, HardDrive, Shield, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from './StatusIndicator'
import { cn, formatResponseTime, formatLastCheck } from '@/lib/utils'
import type { Device, Category, DeviceType } from '@/types'

interface DeviceListRowProps {
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

export function DeviceListRow({ device, category, onClick }: DeviceListRowProps) {
  const iconName = category?.icon || device.icon || 'box'
  const iconColor = category?.color || '#6B7280'
  const Icon = iconMap[iconName.toLowerCase()] || Box
  const hasInterface = device.url && device.url.length > 0

  const handleOpenInterface = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasInterface) {
      window.open(device.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-4 rounded-lg border bg-card cursor-pointer',
        'hover:bg-accent/50 transition-colors',
        device.status === 'offline' && 'opacity-70'
      )}
      onClick={onClick}
    >
      {/* Icon */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: category?.color ? `${category.color}15` : '#6B728015' }}
      >
        <Icon className="h-5 w-5" style={{ color: iconColor }} />
      </div>

      {/* Name & Description */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{device.name}</p>
        <p className="text-sm text-muted-foreground truncate">
          {device.hostname || device.description || device.manufacturer || '-'}
        </p>
      </div>

      {/* IP Address */}
      <div className="hidden sm:block w-32">
        {device.ip_address && (
          <span className="text-sm font-mono text-foreground">{device.ip_address}</span>
        )}
      </div>

      {/* Category */}
      <div className="hidden md:block w-24">
        {category && (
          <Badge
            variant="secondary"
            className="text-xs"
            style={{
              backgroundColor: `${category.color}15`,
              color: category.color,
            }}
          >
            {category.name}
          </Badge>
        )}
      </div>

      {/* Response Time */}
      <div className="hidden lg:block w-20 text-right">
        {device.status === 'online' && device.response_time_ms !== null && device.response_time_ms !== undefined ? (
          <span
            className={cn(
              'text-sm font-mono',
              device.response_time_ms < 100 && 'text-status-online',
              device.response_time_ms >= 100 && device.response_time_ms < 500 && 'text-status-degraded',
              device.response_time_ms >= 500 && 'text-status-offline'
            )}
          >
            {formatResponseTime(device.response_time_ms)}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        )}
      </div>

      {/* Last Check */}
      <div className="hidden xl:block w-24 text-right">
        <span className="text-sm text-muted-foreground">{formatLastCheck(device.last_check)}</span>
      </div>

      {/* Status */}
      <div className="w-20 flex items-center justify-end gap-2">
        {hasInterface && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenInterface}
            className="h-8 w-8 opacity-0 group-hover:opacity-100"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="sr-only">Open interface</span>
          </Button>
        )}
        <StatusIndicator status={device.status} size="md" />
      </div>
    </div>
  )
}

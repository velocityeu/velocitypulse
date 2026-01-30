'use client'

import { ExternalLink, Server, Monitor, Router, Printer, Wifi, HelpCircle, Box, Network, Database, Cloud, Globe, Cpu, HardDrive, Shield, type LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusIndicator } from './StatusIndicator'
import { cn, formatResponseTime, formatLastCheck } from '@/lib/utils'
import type { Device, Category, DeviceType } from '@/types'

interface DeviceCardProps {
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

// Typed icon lookup map for category/device icons
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

// Separate component to render the icon with props - avoids ESLint static-components error
function CategoryIcon({ iconName, color }: { iconName: string; color: string }) {
  const Icon = iconMap[iconName.toLowerCase()] || Box
  return <Icon className="h-5 w-5" style={{ color }} />
}

export function DeviceCard({ device, category, onClick }: DeviceCardProps) {
  const iconName = category?.icon || device.icon || 'box'
  const iconColor = category?.color || '#6B7280'
  const hasInterface = device.url && device.url.length > 0
  const DeviceTypeIcon = device.device_type ? deviceTypeIcons[device.device_type] : null

  const handleOpenInterface = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (hasInterface) {
      window.open(device.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <Card
      className={cn(
        'group relative overflow-hidden transition-all duration-200 cursor-pointer',
        'hover:shadow-lg hover:-translate-y-0.5',
        device.status === 'offline' && 'opacity-80'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header: Icon, Name, Status */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg relative"
              style={{ backgroundColor: category?.color ? `${category.color}20` : '#6B728020' }}
            >
              <CategoryIcon iconName={iconName} color={iconColor} />
              {DeviceTypeIcon && (
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                  <DeviceTypeIcon className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-medium text-foreground truncate">{device.name}</h3>
              {(device.hostname || device.description) && (
                <p className="text-sm text-muted-foreground truncate">
                  {device.hostname || device.description}
                </p>
              )}
            </div>
          </div>
          <StatusIndicator status={device.status} size="md" />
        </div>

        {/* Details: IP, Manufacturer, Response Time, Last Check */}
        <div className="mt-4 space-y-2">
          {device.ip_address && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">IP Address</span>
              <span className="font-mono text-foreground">{device.ip_address}</span>
            </div>
          )}

          {device.manufacturer && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Manufacturer</span>
              <span className="text-foreground truncate max-w-[150px]">{device.manufacturer}</span>
            </div>
          )}

          {device.status === 'online' && device.response_time_ms !== null && device.response_time_ms !== undefined && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Response</span>
              <span
                className={cn(
                  'font-mono',
                  device.response_time_ms < 100 && 'text-status-online',
                  device.response_time_ms >= 100 && device.response_time_ms < 500 && 'text-status-degraded',
                  device.response_time_ms >= 500 && 'text-status-offline'
                )}
              >
                {formatResponseTime(device.response_time_ms)}
              </span>
            </div>
          )}

          {/* Services badges */}
          {device.services && device.services.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {device.services.slice(0, 4).map((service) => (
                <span
                  key={service}
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/10 text-primary"
                >
                  {service}
                </span>
              ))}
              {device.services.length > 4 && (
                <span className="text-[10px] text-muted-foreground">
                  +{device.services.length - 4}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last Check</span>
            <span className="text-foreground">{formatLastCheck(device.last_check)}</span>
          </div>
        </div>

        {/* Footer: Category Badge & Open Button */}
        <div className="mt-4 flex items-center justify-between gap-2">
          {category && (
            <Badge
              variant="secondary"
              className="text-xs"
              style={{
                backgroundColor: `${category.color}15`,
                color: category.color,
                borderColor: `${category.color}30`,
              }}
            >
              {category.name}
            </Badge>
          )}
          {!category && <div />}

          {hasInterface && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenInterface}
              className="gap-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              Open
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

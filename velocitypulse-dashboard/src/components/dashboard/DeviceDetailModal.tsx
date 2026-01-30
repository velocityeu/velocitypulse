'use client'

import { X, ExternalLink, Server, Monitor, Router, Printer, Wifi, HelpCircle, Box, Network, Database, Cloud, Globe, Cpu, HardDrive, Shield, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from './StatusIndicator'
import { cn, formatResponseTime, formatLastCheck } from '@/lib/utils'
import type { Device, Category, DeviceType } from '@/types'

interface DeviceDetailModalProps {
  device: Device
  category?: Category
  isOpen: boolean
  onClose: () => void
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

// Typed icon lookup map
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

function getResponseTimeColor(ms: number): string {
  if (ms < 100) return 'text-status-online'
  if (ms < 500) return 'text-status-degraded'
  return 'text-status-offline'
}

export function DeviceDetailModal({ device, category, isOpen, onClose }: DeviceDetailModalProps) {
  if (!isOpen) return null

  const iconName = category?.icon || device.icon || 'box'
  const iconColor = category?.color || '#6B7280'
  const Icon = iconMap[iconName.toLowerCase()] || Box
  const DeviceTypeIcon = device.device_type ? deviceTypeIcons[device.device_type] : null
  const hasInterface = device.url && device.url.length > 0

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleOpenInterface = () => {
    if (hasInterface) {
      window.open(device.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-lg mx-4 bg-card border rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b p-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg relative"
              style={{ backgroundColor: category?.color ? `${category.color}20` : '#6B728020' }}
            >
              <Icon className="h-6 w-6" style={{ color: iconColor }} />
              {DeviceTypeIcon && (
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 border">
                  <DeviceTypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{device.name}</h2>
              {device.hostname && (
                <p className="text-sm text-muted-foreground">{device.hostname}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusIndicator status={device.status} size="lg" showLabel />
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Description */}
          {device.description && (
            <div>
              <p className="text-sm text-muted-foreground">{device.description}</p>
            </div>
          )}

          {/* Network Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Network Information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {device.ip_address && (
                <div>
                  <span className="text-muted-foreground block">IP Address</span>
                  <span className="font-mono text-foreground">{device.ip_address}</span>
                </div>
              )}
              {device.mac_address && (
                <div>
                  <span className="text-muted-foreground block">MAC Address</span>
                  <span className="font-mono text-foreground uppercase">{device.mac_address}</span>
                </div>
              )}
              {device.hostname && (
                <div>
                  <span className="text-muted-foreground block">Hostname</span>
                  <span className="font-mono text-foreground">{device.hostname}</span>
                </div>
              )}
              {device.manufacturer && (
                <div>
                  <span className="text-muted-foreground block">Manufacturer</span>
                  <span className="text-foreground">{device.manufacturer}</span>
                </div>
              )}
            </div>
          </div>

          {/* Performance */}
          {device.status === 'online' && device.response_time_ms !== null && device.response_time_ms !== undefined && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Performance</h3>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Response Time</span>
                <span className={cn('font-mono font-medium', getResponseTimeColor(device.response_time_ms))}>
                  {formatResponseTime(device.response_time_ms)}
                </span>
              </div>
            </div>
          )}

          {/* Services & Ports */}
          {device.services && device.services.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Services</h3>
              <div className="flex flex-wrap gap-2">
                {device.services.map((service) => (
                  <Badge key={service} variant="secondary" className="text-xs">
                    {service}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {device.open_ports && device.open_ports.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Open Ports</h3>
              <div className="flex flex-wrap gap-2">
                {device.open_ports.map((port) => (
                  <Badge key={port} variant="outline" className="font-mono text-xs">
                    {port}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Category */}
          {category && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">Category</h3>
              <Badge
                variant="secondary"
                style={{
                  backgroundColor: `${category.color}15`,
                  color: category.color,
                  borderColor: `${category.color}30`,
                }}
              >
                {category.name}
              </Badge>
            </div>
          )}

          {/* SNMP Info */}
          {device.snmp_info && (device.snmp_info.sysName || device.snmp_info.sysDescr || device.snmp_info.sysContact || device.snmp_info.sysLocation) && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">SNMP Information</h3>
              <div className="grid grid-cols-1 gap-2 text-sm bg-muted/30 p-3 rounded-lg">
                {device.snmp_info.sysName && (
                  <div>
                    <span className="text-muted-foreground">System Name: </span>
                    <span className="text-foreground">{device.snmp_info.sysName}</span>
                  </div>
                )}
                {device.snmp_info.sysDescr && (
                  <div>
                    <span className="text-muted-foreground">Description: </span>
                    <span className="text-foreground">{device.snmp_info.sysDescr}</span>
                  </div>
                )}
                {device.snmp_info.sysContact && (
                  <div>
                    <span className="text-muted-foreground">Contact: </span>
                    <span className="text-foreground">{device.snmp_info.sysContact}</span>
                  </div>
                )}
                {device.snmp_info.sysLocation && (
                  <div>
                    <span className="text-muted-foreground">Location: </span>
                    <span className="text-foreground">{device.snmp_info.sysLocation}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* UPnP Info */}
          {device.upnp_info && (device.upnp_info.friendlyName || device.upnp_info.deviceType || device.upnp_info.manufacturer) && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">UPnP Information</h3>
              <div className="grid grid-cols-1 gap-2 text-sm bg-muted/30 p-3 rounded-lg">
                {device.upnp_info.friendlyName && (
                  <div>
                    <span className="text-muted-foreground">Friendly Name: </span>
                    <span className="text-foreground">{device.upnp_info.friendlyName}</span>
                  </div>
                )}
                {device.upnp_info.deviceType && (
                  <div>
                    <span className="text-muted-foreground">Device Type: </span>
                    <span className="text-foreground">{device.upnp_info.deviceType}</span>
                  </div>
                )}
                {device.upnp_info.manufacturer && (
                  <div>
                    <span className="text-muted-foreground">Manufacturer: </span>
                    <span className="text-foreground">{device.upnp_info.manufacturer}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Discovery & Timestamps */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-foreground">Discovery & Activity</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground block">Discovery Method</span>
                <span className="text-foreground capitalize">{device.discovered_by?.replace(/_/g, ' ') || 'Unknown'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block">Last Check</span>
                <span className="text-foreground">{formatLastCheck(device.last_check)}</span>
              </div>
              {device.first_seen_at && (
                <div>
                  <span className="text-muted-foreground block">First Seen</span>
                  <span className="text-foreground">{formatLastCheck(device.first_seen_at)}</span>
                </div>
              )}
              {device.last_full_scan_at && (
                <div>
                  <span className="text-muted-foreground block">Last Full Scan</span>
                  <span className="text-foreground">{formatLastCheck(device.last_full_scan_at)}</span>
                </div>
              )}
            </div>
          </div>

          {/* OS Hints */}
          {device.os_hints && device.os_hints.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-foreground">OS Detection</h3>
              <div className="flex flex-wrap gap-2">
                {device.os_hints.map((hint, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    {hint}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {hasInterface && (
          <div className="sticky bottom-0 bg-card border-t p-4">
            <Button onClick={handleOpenInterface} className="w-full gap-2">
              <ExternalLink className="h-4 w-4" />
              Open Interface
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

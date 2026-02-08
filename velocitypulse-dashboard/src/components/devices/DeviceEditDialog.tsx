'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Device, Category, NetworkSegment, CheckType } from '@/types'

interface DeviceEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  device?: Device | null
  categories: Category[]
  segments: NetworkSegment[]
  onSave: (device: Partial<Device>) => Promise<void>
}

const CHECK_INTERVAL_OPTIONS = [
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
  { value: 43200, label: '12 hours' },
  { value: 86400, label: '24 hours' },
]

export function DeviceEditDialog({
  open,
  onOpenChange,
  device,
  categories,
  segments,
  onSave,
}: DeviceEditDialogProps) {
  const isEditing = !!device

  const [name, setName] = useState('')
  const [ipAddress, setIpAddress] = useState('')
  const [macAddress, setMacAddress] = useState('')
  const [hostname, setHostname] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [segmentId, setSegmentId] = useState('')
  const [description, setDescription] = useState('')
  const [checkType, setCheckType] = useState<CheckType>('ping')
  const [url, setUrl] = useState('')
  const [port, setPort] = useState('')
  const [monitoringMode, setMonitoringMode] = useState<'auto' | 'manual'>('manual')
  const [checkInterval, setCheckInterval] = useState(60)
  const [sslExpiryWarnDays, setSslExpiryWarnDays] = useState(30)
  const [dnsExpectedIp, setDnsExpectedIp] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog opens/closes or device changes
  useEffect(() => {
    if (open) {
      if (device) {
        setName(device.name || '')
        setIpAddress(device.ip_address || '')
        setMacAddress(device.mac_address || '')
        setHostname(device.hostname || '')
        setCategoryId(device.category_id || '')
        setSegmentId(device.network_segment_id || '')
        setDescription(device.description || '')
        setCheckType(device.check_type || 'ping')
        setUrl(device.url || '')
        setPort(device.port?.toString() || '')
        setMonitoringMode(device.monitoring_mode || 'auto')
        setCheckInterval(device.check_interval_seconds || 60)
        setSslExpiryWarnDays(device.ssl_expiry_warn_days || 30)
        setDnsExpectedIp(device.dns_expected_ip || '')
      } else {
        setName('')
        setIpAddress('')
        setMacAddress('')
        setHostname('')
        setCategoryId('')
        setSegmentId('')
        setDescription('')
        setCheckType('ping')
        setUrl('')
        setPort('')
        setMonitoringMode('manual')
        setCheckInterval(60)
        setSslExpiryWarnDays(30)
        setDnsExpectedIp('')
      }
      setError(null)
    }
  }, [open, device])

  // When check type changes to ssl, default interval to 12 hours
  useEffect(() => {
    if (checkType === 'ssl' && !isEditing) {
      setCheckInterval(43200)
    }
  }, [checkType, isEditing])

  const isRemoteCheckType = checkType === 'ssl' || checkType === 'dns' || checkType === 'http'

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Device name is required')
      return
    }

    if ((checkType === 'ssl' || checkType === 'dns') && !hostname.trim() && !ipAddress.trim()) {
      setError('Hostname or IP address is required for SSL/DNS checks')
      return
    }

    setSaving(true)
    setError(null)
    try {
      await onSave({
        name: name.trim(),
        ip_address: ipAddress.trim() || undefined,
        mac_address: macAddress.trim() || undefined,
        hostname: hostname.trim() || undefined,
        category_id: categoryId || undefined,
        network_segment_id: segmentId || undefined,
        description: description.trim() || undefined,
        check_type: checkType,
        url: url.trim() || undefined,
        port: port ? parseInt(port, 10) : undefined,
        monitoring_mode: monitoringMode,
        check_interval_seconds: checkInterval,
        ssl_expiry_warn_days: checkType === 'ssl' ? sslExpiryWarnDays : undefined,
        dns_expected_ip: checkType === 'dns' ? (dnsExpectedIp.trim() || undefined) : undefined,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save device')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Device' : 'Add Device'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the device information below'
              : 'Add a new device to monitor on your network or remotely'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Monitoring mode toggle - only for new devices */}
          {!isEditing && (
            <div>
              <label className="text-sm font-medium">Monitoring Type</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMonitoringMode('manual')
                    if (checkType === 'ssl' || checkType === 'dns') {
                      // Keep current check type
                    } else {
                      setCheckType('ping')
                    }
                  }}
                  className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                    monitoringMode === 'manual' && !isRemoteCheckType
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-input hover:bg-muted/50'
                  }`}
                >
                  Local Network
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    LAN device (ping, TCP, HTTP)
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMonitoringMode('manual')
                    if (!['http', 'ssl', 'dns'].includes(checkType)) {
                      setCheckType('http')
                    }
                  }}
                  className={`px-3 py-2 rounded-md border text-sm transition-colors ${
                    isRemoteCheckType
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-input hover:bg-muted/50'
                  }`}
                >
                  Remote / Internet
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    URL, SSL cert, DNS
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder={isRemoteCheckType ? 'e.g., Company Website' : 'e.g., Main Server'}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                {isRemoteCheckType ? 'Hostname / Domain' : 'IP Address'}
              </label>
              {isRemoteCheckType ? (
                <Input
                  value={hostname}
                  onChange={e => setHostname(e.target.value)}
                  placeholder="e.g., example.com"
                  className="mt-1"
                />
              ) : (
                <Input
                  value={ipAddress}
                  onChange={e => setIpAddress(e.target.value)}
                  placeholder="e.g., 192.168.1.100"
                  className="mt-1"
                />
              )}
            </div>

            {!isRemoteCheckType && (
              <div>
                <label className="text-sm font-medium">MAC Address</label>
                <Input
                  value={macAddress}
                  onChange={e => setMacAddress(e.target.value)}
                  placeholder="e.g., AA:BB:CC:DD:EE:FF"
                  className="mt-1"
                />
              </div>
            )}

            {!isRemoteCheckType && (
              <div>
                <label className="text-sm font-medium">Hostname</label>
                <Input
                  value={hostname}
                  onChange={e => setHostname(e.target.value)}
                  placeholder="e.g., server.local"
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Check Type</label>
              <select
                value={checkType}
                onChange={e => setCheckType(e.target.value as CheckType)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ping">Ping (ICMP)</option>
                <option value="http">HTTP/HTTPS</option>
                <option value="tcp">TCP Port</option>
                <option value="ssl">SSL Certificate</option>
                <option value="dns">DNS Resolution</option>
              </select>
            </div>

            {checkType === 'http' && (
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">URL</label>
                <Input
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="e.g., https://example.com/health"
                  className="mt-1"
                />
              </div>
            )}

            {checkType === 'tcp' && (
              <div>
                <label className="text-sm font-medium">Port</label>
                <Input
                  type="number"
                  value={port}
                  onChange={e => setPort(e.target.value)}
                  placeholder="e.g., 443"
                  className="mt-1"
                />
              </div>
            )}

            {checkType === 'ssl' && (
              <>
                <div>
                  <label className="text-sm font-medium">Port</label>
                  <Input
                    type="number"
                    value={port || '443'}
                    onChange={e => setPort(e.target.value)}
                    placeholder="443"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Expiry Warning (days)</label>
                  <Input
                    type="number"
                    value={sslExpiryWarnDays}
                    onChange={e => setSslExpiryWarnDays(parseInt(e.target.value, 10) || 30)}
                    placeholder="30"
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Warn when certificate expires within this many days
                  </p>
                </div>
              </>
            )}

            {checkType === 'dns' && (
              <div className="sm:col-span-2">
                <label className="text-sm font-medium">Expected IP (optional)</label>
                <Input
                  value={dnsExpectedIp}
                  onChange={e => setDnsExpectedIp(e.target.value)}
                  placeholder="e.g., 93.184.216.34"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Alert if DNS resolves to a different IP address
                </p>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Check Interval</label>
              <select
                value={checkInterval}
                onChange={e => setCheckInterval(parseInt(e.target.value, 10))}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {CHECK_INTERVAL_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Category</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">No category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium">Network Segment</label>
              <select
                value={segmentId}
                onChange={e => setSegmentId(e.target.value)}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">No segment</option>
                {segments.map(seg => (
                  <option key={seg.id} value={seg.id}>
                    {seg.name} ({seg.cidr})
                  </option>
                ))}
              </select>
            </div>

            {isRemoteCheckType && (
              <div>
                <label className="text-sm font-medium">IP Address (optional)</label>
                <Input
                  value={ipAddress}
                  onChange={e => setIpAddress(e.target.value)}
                  placeholder="e.g., 93.184.216.34"
                  className="mt-1"
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional description..."
                className="mt-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Device'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

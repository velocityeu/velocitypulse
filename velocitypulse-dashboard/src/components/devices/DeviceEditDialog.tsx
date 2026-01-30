'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Device, Category, NetworkSegment } from '@/types'

interface DeviceEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  device?: Device | null
  categories: Category[]
  segments: NetworkSegment[]
  onSave: (device: Partial<Device>) => Promise<void>
}

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
  const [checkType, setCheckType] = useState<'ping' | 'http' | 'tcp'>('ping')
  const [url, setUrl] = useState('')
  const [port, setPort] = useState('')
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
      }
      setError(null)
    }
  }, [open, device])

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Device name is required')
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Device' : 'Add Device'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update the device information below'
              : 'Add a new device to monitor on your network'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., Main Server"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">IP Address</label>
              <Input
                value={ipAddress}
                onChange={e => setIpAddress(e.target.value)}
                placeholder="e.g., 192.168.1.100"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">MAC Address</label>
              <Input
                value={macAddress}
                onChange={e => setMacAddress(e.target.value)}
                placeholder="e.g., AA:BB:CC:DD:EE:FF"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Hostname</label>
              <Input
                value={hostname}
                onChange={e => setHostname(e.target.value)}
                placeholder="e.g., server.local"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Check Type</label>
              <select
                value={checkType}
                onChange={e => setCheckType(e.target.value as 'ping' | 'http' | 'tcp')}
                className="mt-1 w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="ping">Ping (ICMP)</option>
                <option value="http">HTTP/HTTPS</option>
                <option value="tcp">TCP Port</option>
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

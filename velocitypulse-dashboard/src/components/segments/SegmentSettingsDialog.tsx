'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { NetworkSegment } from '@/types'

interface SegmentSettingsDialogProps {
  segment: NetworkSegment
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (updates: {
    name?: string
    description?: string
    cidr?: string
    scan_interval_seconds?: number
    is_enabled?: boolean
  }) => Promise<void>
  onDelete?: () => Promise<void>
}

const SCAN_INTERVALS = [
  { value: 60, label: '1 minute' },
  { value: 120, label: '2 minutes' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
]

export function SegmentSettingsDialog({
  segment,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: SegmentSettingsDialogProps) {
  const [name, setName] = useState(segment.name)
  const [description, setDescription] = useState(segment.description || '')
  const [cidr, setCidr] = useState(segment.cidr)
  const [scanInterval, setScanInterval] = useState(segment.scan_interval_seconds)
  const [isEnabled, setIsEnabled] = useState(segment.is_enabled)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Segment name is required')
      return
    }

    if (!cidr.trim()) {
      setError('CIDR is required')
      return
    }

    // Basic CIDR validation
    const cidrPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/
    if (!cidrPattern.test(cidr)) {
      setError('Invalid CIDR format. Expected: x.x.x.x/nn (e.g., 192.168.1.0/24)')
      return
    }

    setError(null)
    setIsSaving(true)

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        cidr: cidr.trim(),
        scan_interval_seconds: scanInterval,
        is_enabled: isEnabled,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save segment')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!onDelete) return

    setIsDeleting(true)
    try {
      await onDelete()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete segment')
      setShowDeleteConfirm(false)
    } finally {
      setIsDeleting(false)
    }
  }

  if (showDeleteConfirm) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete Segment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{segment.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
            <p className="font-medium text-destructive">This will permanently delete:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>The network segment configuration</li>
              <li>All devices discovered in this segment</li>
            </ul>
          </div>

          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Segment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Segment Settings</DialogTitle>
          <DialogDescription>
            Configure the network segment name, CIDR, and scan settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Segment name"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="cidr" className="text-sm font-medium">
              CIDR Range
            </label>
            <input
              id="cidr"
              type="text"
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="192.168.1.0/24"
            />
            <p className="text-xs text-muted-foreground">
              The IP range to scan, e.g., 192.168.1.0/24
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Optional description"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="interval" className="text-sm font-medium">
              Scan Interval
            </label>
            <select
              id="interval"
              value={scanInterval}
              onChange={(e) => setScanInterval(Number(e.target.value))}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              {SCAN_INTERVALS.map((interval) => (
                <option key={interval.value} value={interval.value}>
                  {interval.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="enabled"
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="enabled" className="text-sm font-medium">
              Segment enabled
            </label>
          </div>

          {segment.is_auto_registered && (
            <div className="rounded-lg border bg-muted/50 p-3 text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium">Auto-registered:</span> This segment was automatically detected by the agent
              </p>
              {segment.interface_name && (
                <p className="text-muted-foreground">
                  <span className="font-medium">Interface:</span> {segment.interface_name}
                </p>
              )}
            </div>
          )}

          {segment.last_scan_at && (
            <div className="text-sm text-muted-foreground">
              Last scan: {new Date(segment.last_scan_at).toLocaleString()}
              {segment.last_scan_device_count > 0 && (
                <span> ({segment.last_scan_device_count} devices found)</span>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {onDelete && (
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              className="sm:mr-auto"
            >
              Delete Segment
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

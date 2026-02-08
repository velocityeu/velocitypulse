'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { Settings, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Agent } from '@/types'

const SCAN_INTERVAL_OPTIONS = [
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 600, label: '10 minutes' },
  { value: 900, label: '15 minutes' },
  { value: 1800, label: '30 minutes' },
  { value: 3600, label: '1 hour' },
]

const DISCOVERY_SEGMENTS = [
  { key: 'arp', label: 'ARP Scanning' },
  { key: 'ping', label: 'ICMP Ping Sweep' },
  { key: 'mdns', label: 'mDNS Discovery' },
  { key: 'ssdp', label: 'SSDP/UPnP Discovery' },
]

interface ConfigPushDialogProps {
  agent: Agent
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConfigPushDialog({ agent, open, onOpenChange }: ConfigPushDialogProps) {
  const [scanInterval, setScanInterval] = useState(300)
  const [pingTimeout, setPingTimeout] = useState(2000)
  const [enabledSegments, setEnabledSegments] = useState<string[]>(['arp', 'ping'])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const toggleSegment = (key: string) => {
    setEnabledSegments(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    )
  }

  const handleSubmit = async () => {
    setSending(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await authFetch(`/api/dashboard/agents/${agent.id}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command_type: 'update_config',
          payload: {
            scan_interval_seconds: scanInterval,
            ping_timeout_ms: pingTimeout,
            enabled_discovery: enabledSegments,
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to send configuration')
      }

      setSuccess(true)
      setTimeout(() => onOpenChange(false), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push configuration')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configure Agent
          </DialogTitle>
          <DialogDescription>
            Push configuration to &quot;{agent.name}&quot;. The agent will apply these settings on its next heartbeat.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scan Interval */}
          <div>
            <Label>Scan Interval</Label>
            <select
              value={scanInterval}
              onChange={e => setScanInterval(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {SCAN_INTERVAL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Ping Timeout */}
          <div>
            <Label>Ping Timeout (ms)</Label>
            <Input
              type="number"
              value={pingTimeout}
              onChange={e => setPingTimeout(Number(e.target.value))}
              min={500}
              max={30000}
              step={500}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              How long to wait for a device response (500-30000ms)
            </p>
          </div>

          {/* Discovery Methods */}
          <div>
            <Label>Discovery Methods</Label>
            <div className="mt-2 space-y-2">
              {DISCOVERY_SEGMENTS.map(seg => (
                <label key={seg.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabledSegments.includes(seg.key)}
                    onChange={() => toggleSegment(seg.key)}
                    className="rounded border-input"
                  />
                  <span className="text-sm">{seg.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm">
              Configuration sent successfully!
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={sending || enabledSegments.length === 0}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              'Push Configuration'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

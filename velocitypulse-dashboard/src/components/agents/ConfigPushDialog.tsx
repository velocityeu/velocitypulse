'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { Settings, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Agent } from '@/types'

const HEARTBEAT_INTERVAL_OPTIONS = [
  { value: 10, label: '10 seconds' },
  { value: 15, label: '15 seconds' },
  { value: 30, label: '30 seconds' },
  { value: 60, label: '1 minute' },
]

const LOG_LEVEL_OPTIONS = [
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' },
]

interface ConfigPushDialogProps {
  agent: Agent
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConfigPushDialog({ agent, open, onOpenChange }: ConfigPushDialogProps) {
  const [heartbeatInterval, setHeartbeatInterval] = useState(30)
  const [enableAutoScan, setEnableAutoScan] = useState(true)
  const [autoScanInterval, setAutoScanInterval] = useState(300)
  const [logLevel, setLogLevel] = useState('info')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
            heartbeatInterval,
            enableAutoScan,
            autoScanInterval,
            logLevel,
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
          {/* Heartbeat Interval */}
          <div>
            <Label>Heartbeat Interval</Label>
            <select
              value={heartbeatInterval}
              onChange={e => setHeartbeatInterval(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {HEARTBEAT_INTERVAL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              How often the agent sends heartbeats to the server
            </p>
          </div>

          {/* Auto Scan */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Auto Scan</Label>
              <p className="text-xs text-muted-foreground">
                Automatically discover devices on assigned network segments
              </p>
            </div>
            <Switch checked={enableAutoScan} onCheckedChange={setEnableAutoScan} />
          </div>

          {/* Auto Scan Interval */}
          {enableAutoScan && (
            <div>
              <Label>Auto Scan Interval (seconds)</Label>
              <Input
                type="number"
                value={autoScanInterval}
                onChange={e => setAutoScanInterval(Number(e.target.value))}
                min={30}
                step={30}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                How often to scan for new devices (minimum 30 seconds)
              </p>
            </div>
          )}

          {/* Log Level */}
          <div>
            <Label>Log Level</Label>
            <Select value={logLevel} onValueChange={setLogLevel}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOG_LEVEL_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Controls agent logging verbosity
            </p>
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
          <Button onClick={handleSubmit} disabled={sending}>
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

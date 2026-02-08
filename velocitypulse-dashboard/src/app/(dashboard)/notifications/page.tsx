'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { Bell, Plus, Trash2, Pencil, Mail, MessageSquare, Globe, Webhook, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type {
  NotificationChannel,
  NotificationRule,
  NotificationChannelType,
  NotificationEventType,
} from '@/types'

const channelTypeIcons = {
  email: Mail,
  slack: MessageSquare,
  teams: Globe,
  webhook: Webhook,
}

const channelTypeLabels = {
  email: 'Email',
  slack: 'Slack',
  teams: 'Microsoft Teams',
  webhook: 'Webhook',
}

const eventTypeLabels: Record<NotificationEventType, string> = {
  'device.offline': 'Device Goes Offline',
  'device.online': 'Device Comes Online',
  'device.degraded': 'Device Performance Degraded',
  'agent.offline': 'Agent Goes Offline',
  'agent.online': 'Agent Comes Online',
  'scan.complete': 'Network Scan Complete',
}

export default function NotificationsPage() {
  const [channels, setChannels] = useState<NotificationChannel[]>([])
  const [rules, setRules] = useState<NotificationRule[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Channel dialog state
  const [channelDialogOpen, setChannelDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null)
  const [channelForm, setChannelForm] = useState({
    name: '',
    channel_type: 'email' as NotificationChannelType,
    config: {} as Record<string, unknown>,
  })

  // Rule dialog state
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<NotificationRule | null>(null)
  const [ruleForm, setRuleForm] = useState({
    name: '',
    event_type: 'device.offline' as NotificationEventType,
    channel_ids: [] as string[],
    cooldown_minutes: 5,
  })

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [channelsRes, rulesRes] = await Promise.all([
        authFetch('/api/notifications/channels'),
        authFetch('/api/notifications/rules'),
      ])

      if (channelsRes.ok) {
        const data = await channelsRes.json()
        setChannels(data.channels || [])
      }

      if (rulesRes.ok) {
        const data = await rulesRes.json()
        setRules(data.rules || [])
      }
    } catch (err) {
      setError('Failed to load notification settings')
    } finally {
      setLoading(false)
    }
  }

  // Channel handlers
  function openChannelDialog(channel?: NotificationChannel) {
    if (channel) {
      setEditingChannel(channel)
      setChannelForm({
        name: channel.name,
        channel_type: channel.channel_type,
        config: channel.config as unknown as Record<string, unknown>,
      })
    } else {
      setEditingChannel(null)
      setChannelForm({
        name: '',
        channel_type: 'email',
        config: {},
      })
    }
    setChannelDialogOpen(true)
  }

  async function saveChannel() {
    const method = editingChannel ? 'PATCH' : 'POST'
    const url = editingChannel
      ? `/api/notifications/channels/${editingChannel.id}`
      : '/api/notifications/channels'

    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(channelForm),
    })

    if (res.ok) {
      setChannelDialogOpen(false)
      fetchData()
    }
  }

  async function deleteChannel(id: string) {
    if (!confirm('Delete this notification channel?')) return

    const res = await authFetch(`/api/notifications/channels/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchData()
    }
  }

  async function toggleChannel(id: string, enabled: boolean) {
    await authFetch(`/api/notifications/channels/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: enabled }),
    })
    fetchData()
  }

  // Rule handlers
  function openRuleDialog(rule?: NotificationRule) {
    if (rule) {
      setEditingRule(rule)
      setRuleForm({
        name: rule.name,
        event_type: rule.event_type,
        channel_ids: rule.channel_ids,
        cooldown_minutes: rule.cooldown_minutes,
      })
    } else {
      setEditingRule(null)
      setRuleForm({
        name: '',
        event_type: 'device.offline',
        channel_ids: [],
        cooldown_minutes: 5,
      })
    }
    setRuleDialogOpen(true)
  }

  async function saveRule() {
    const method = editingRule ? 'PATCH' : 'POST'
    const url = editingRule
      ? `/api/notifications/rules/${editingRule.id}`
      : '/api/notifications/rules'

    const res = await authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ruleForm),
    })

    if (res.ok) {
      setRuleDialogOpen(false)
      fetchData()
    }
  }

  async function deleteRule(id: string) {
    if (!confirm('Delete this notification rule?')) return

    const res = await authFetch(`/api/notifications/rules/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchData()
    }
  }

  async function toggleRule(id: string, enabled: boolean) {
    await authFetch(`/api/notifications/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: enabled }),
    })
    fetchData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="text-muted-foreground">
            Configure alerts for device and agent status changes
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg">{error}</div>
      )}

      {/* Notification Channels */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Notification Channels</CardTitle>
            <CardDescription>
              Configure where to send notifications (email, Slack, Teams, webhooks)
            </CardDescription>
          </div>
          <Button onClick={() => openChannelDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Channel
          </Button>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No notification channels configured</p>
              <p className="text-sm">Add a channel to start receiving alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {channels.map((channel) => {
                const Icon = channelTypeIcons[channel.channel_type]
                return (
                  <div
                    key={channel.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">{channel.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {channelTypeLabels[channel.channel_type]}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={channel.is_enabled}
                        onCheckedChange={(checked) => toggleChannel(channel.id, checked)}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openChannelDialog(channel)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteChannel(channel.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notification Rules */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Notification Rules</CardTitle>
            <CardDescription>
              Define which events trigger notifications to which channels
            </CardDescription>
          </div>
          <Button onClick={() => openRuleDialog()} disabled={channels.length === 0}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rule
          </Button>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No notification rules configured</p>
              <p className="text-sm">
                {channels.length === 0
                  ? 'Add a channel first, then create rules'
                  : 'Add a rule to start receiving alerts'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <div className="font-medium">{rule.name}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Badge variant="outline">{eventTypeLabels[rule.event_type]}</Badge>
                      <span>→</span>
                      <span>
                        {rule.channel_ids.length} channel
                        {rule.channel_ids.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_enabled}
                      onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                    />
                    <Button variant="ghost" size="icon" onClick={() => openRuleDialog(rule)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => deleteRule(rule.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Channel Dialog */}
      <Dialog open={channelDialogOpen} onOpenChange={setChannelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingChannel ? 'Edit Channel' : 'Add Channel'}</DialogTitle>
            <DialogDescription>
              Configure a notification channel to receive alerts
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={channelForm.name}
                onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                placeholder="e.g., DevOps Team Email"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={channelForm.channel_type}
                onValueChange={(value: NotificationChannelType) =>
                  setChannelForm({ ...channelForm, channel_type: value, config: {} })
                }
                disabled={!!editingChannel}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="slack">Slack</SelectItem>
                  <SelectItem value="teams">Microsoft Teams</SelectItem>
                  <SelectItem value="webhook">Webhook</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Channel-specific config */}
            {channelForm.channel_type === 'email' && (
              <div className="space-y-2">
                <Label>Recipients (comma-separated)</Label>
                <Input
                  value={(channelForm.config.recipients as string[])?.join(', ') || ''}
                  onChange={(e) =>
                    setChannelForm({
                      ...channelForm,
                      config: {
                        type: 'email',
                        recipients: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                      },
                    })
                  }
                  placeholder="email1@example.com, email2@example.com"
                />
              </div>
            )}

            {(channelForm.channel_type === 'slack' || channelForm.channel_type === 'teams') && (
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  value={(channelForm.config.webhook_url as string) || ''}
                  onChange={(e) =>
                    setChannelForm({
                      ...channelForm,
                      config: {
                        type: channelForm.channel_type,
                        webhook_url: e.target.value,
                      },
                    })
                  }
                  placeholder={
                    channelForm.channel_type === 'slack'
                      ? 'https://hooks.slack.com/services/...'
                      : 'https://outlook.office.com/webhook/...'
                  }
                />
              </div>
            )}

            {channelForm.channel_type === 'webhook' && (
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  value={(channelForm.config.url as string) || ''}
                  onChange={(e) =>
                    setChannelForm({
                      ...channelForm,
                      config: {
                        type: 'webhook',
                        url: e.target.value,
                        method: 'POST',
                      },
                    })
                  }
                  placeholder="https://your-server.com/webhook"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChannelDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveChannel} disabled={!channelForm.name}>
              {editingChannel ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? 'Edit Rule' : 'Add Rule'}</DialogTitle>
            <DialogDescription>Define when and where to send notifications</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={ruleForm.name}
                onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                placeholder="e.g., Alert on device offline"
              />
            </div>
            <div className="space-y-2">
              <Label>Event</Label>
              <Select
                value={ruleForm.event_type}
                onValueChange={(value: NotificationEventType) =>
                  setRuleForm({ ...ruleForm, event_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(eventTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Channels</Label>
              <div className="border rounded-lg p-3 space-y-2 max-h-40 overflow-y-auto">
                {channels.map((channel) => {
                  const selected = ruleForm.channel_ids.includes(channel.id)
                  const Icon = channelTypeIcons[channel.channel_type]
                  return (
                    <div
                      key={channel.id}
                      className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                        selected ? 'bg-primary/10' : 'hover:bg-muted'
                      }`}
                      onClick={() => {
                        const newIds = selected
                          ? ruleForm.channel_ids.filter((id) => id !== channel.id)
                          : [...ruleForm.channel_ids, channel.id]
                        setRuleForm({ ...ruleForm, channel_ids: newIds })
                      }}
                    >
                      <div
                        className={`h-5 w-5 rounded border flex items-center justify-center ${
                          selected ? 'bg-primary border-primary' : 'border-muted-foreground'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{channel.name}</span>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cooldown (minutes)</Label>
              <Input
                type="number"
                min={1}
                max={1440}
                value={ruleForm.cooldown_minutes}
                onChange={(e) =>
                  setRuleForm({ ...ruleForm, cooldown_minutes: parseInt(e.target.value) || 5 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Minimum time between repeated notifications for the same device
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveRule}
              disabled={!ruleForm.name || ruleForm.channel_ids.length === 0}
            >
              {editingRule ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

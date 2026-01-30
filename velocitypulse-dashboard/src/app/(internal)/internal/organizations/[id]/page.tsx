'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Building2,
  Users,
  Monitor,
  Server,
  CreditCard,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pause,
  Play,
  Calendar,
  Key,
  FileText,
  ExternalLink,
  Trash2,
} from 'lucide-react'
import { formatDate, formatDateTime, formatCurrency, getDaysUntilTrialExpires } from '@/lib/utils'
import type { Organization, OrganizationStatus, OrganizationPlan, AuditLog } from '@/types'

interface AgentWithCounts {
  id: string
  name: string
  description?: string
  api_key_prefix: string
  is_enabled: boolean
  last_seen_at?: string
  last_ip_address?: string
  version?: string
  device_count: number
  segment_count: number
  is_online: boolean
}

interface SegmentWithCounts {
  id: string
  agent_id: string
  name: string
  cidr: string
  scan_interval_seconds: number
  is_enabled: boolean
  last_scan_at?: string
  device_count: number
}

interface OrganizationDetails extends Organization {
  member_count: number
  device_count: number
  agent_count: number
  agents: AgentWithCounts[]
  segments: SegmentWithCounts[]
  recent_audit_logs: AuditLog[]
}

const statusColors: Record<OrganizationStatus, { badge: string; dot: string }> = {
  trial: { badge: 'bg-blue-500/10 text-blue-500', dot: 'bg-blue-500' },
  active: { badge: 'bg-green-500/10 text-green-500', dot: 'bg-green-500' },
  past_due: { badge: 'bg-orange-500/10 text-orange-500', dot: 'bg-orange-500' },
  suspended: { badge: 'bg-red-500/10 text-red-500', dot: 'bg-red-500' },
  cancelled: { badge: 'bg-gray-500/10 text-gray-500', dot: 'bg-gray-500' },
}

export default function OrganizationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [org, setOrg] = useState<OrganizationDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    loadOrganization()
  }, [params.id])

  async function loadOrganization() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/internal/organizations/${params.id}`)
      if (response.ok) {
        const data = await response.json()
        setOrg(data)
      }
    } catch (error) {
      console.error('Failed to load organization:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function performAction(action: string, payload?: Record<string, unknown>) {
    setActionLoading(action)
    try {
      const response = await fetch(`/api/internal/organizations/${params.id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...payload }),
      })
      if (response.ok) {
        await loadOrganization()
      } else {
        const error = await response.json()
        alert(error.message || 'Action failed')
      }
    } catch (error) {
      console.error('Action failed:', error)
      alert('Action failed')
    } finally {
      setActionLoading(null)
    }
  }

  // Demo data
  const demoOrg: OrganizationDetails = {
    id: params.id as string,
    name: 'Acme Corporation',
    slug: 'acme-corp',
    customer_number: 'VEU-A1B2C',
    stripe_customer_id: 'cus_ABC123',
    stripe_subscription_id: 'sub_XYZ789',
    plan: 'unlimited',
    status: 'active',
    device_limit: 5000,
    agent_limit: 100,
    user_limit: 50,
    member_count: 12,
    device_count: 245,
    agent_count: 8,
    created_at: '2024-06-15T10:00:00Z',
    updated_at: '2025-01-20T14:30:00Z',
    agents: [
      {
        id: 'agent_1',
        name: 'Office Network Agent',
        description: 'Main office monitoring',
        api_key_prefix: 'vp_acme1234',
        is_enabled: true,
        last_seen_at: new Date(Date.now() - 60000).toISOString(),
        last_ip_address: '192.168.1.100',
        version: '1.0.0',
        device_count: 156,
        segment_count: 3,
        is_online: true,
      },
      {
        id: 'agent_2',
        name: 'Data Center Agent',
        description: 'Server room monitoring',
        api_key_prefix: 'vp_acme5678',
        is_enabled: true,
        last_seen_at: new Date(Date.now() - 300000).toISOString(),
        version: '1.0.0',
        device_count: 89,
        segment_count: 2,
        is_online: true,
      },
    ],
    segments: [
      {
        id: 'seg_1',
        agent_id: 'agent_1',
        name: 'Office LAN',
        cidr: '192.168.1.0/24',
        scan_interval_seconds: 300,
        is_enabled: true,
        last_scan_at: new Date(Date.now() - 120000).toISOString(),
        device_count: 85,
      },
      {
        id: 'seg_2',
        agent_id: 'agent_1',
        name: 'Guest Network',
        cidr: '192.168.10.0/24',
        scan_interval_seconds: 600,
        is_enabled: true,
        last_scan_at: new Date(Date.now() - 180000).toISOString(),
        device_count: 45,
      },
    ],
    recent_audit_logs: [
      {
        id: '1',
        organization_id: params.id as string,
        actor_type: 'user',
        actor_id: 'user_123',
        action: 'agent.created',
        resource_type: 'agent',
        resource_id: 'agent_456',
        created_at: '2025-01-28T14:30:00Z',
      },
      {
        id: '2',
        organization_id: params.id as string,
        actor_type: 'webhook',
        actor_id: 'stripe',
        action: 'subscription.created',
        resource_type: 'subscription',
        resource_id: 'sub_789',
        created_at: '2025-01-20T10:00:00Z',
      },
    ],
  }

  const data = org || demoOrg

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  const trialDaysLeft = data.trial_ends_at ? getDaysUntilTrialExpires(data.trial_ends_at) : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
            <Badge className={statusColors[data.status].badge}>
              <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${statusColors[data.status].dot}`} />
              {data.status.charAt(0).toUpperCase() + data.status.slice(1).replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-muted-foreground font-mono">{data.customer_number}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Card */}
          <Card>
            <CardHeader>
              <CardTitle>Overview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-sm text-muted-foreground">Plan</div>
                <div className="font-medium capitalize">{data.plan}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Slug</div>
                <div className="font-medium font-mono">{data.slug}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Created</div>
                <div className="font-medium">{formatDateTime(data.created_at)}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Last Updated</div>
                <div className="font-medium">{formatDateTime(data.updated_at)}</div>
              </div>
              {data.stripe_customer_id && (
                <div>
                  <div className="text-sm text-muted-foreground">Stripe Customer</div>
                  <div className="font-medium font-mono text-sm">{data.stripe_customer_id}</div>
                </div>
              )}
              {data.trial_ends_at && (
                <div>
                  <div className="text-sm text-muted-foreground">Trial Ends</div>
                  <div className={`font-medium ${trialDaysLeft && trialDaysLeft <= 3 ? 'text-orange-500' : ''}`}>
                    {formatDate(data.trial_ends_at)}
                    {trialDaysLeft !== null && ` (${trialDaysLeft} days)`}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
              <CardDescription>Current resource usage vs limits</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" /> Users
                  </span>
                  <span>{data.member_count} / {data.user_limit}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, (data.member_count / data.user_limit) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" /> Devices
                  </span>
                  <span>{data.device_count} / {data.device_limit}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, (data.device_count / data.device_limit) * 100)}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="flex items-center gap-2">
                    <Server className="h-4 w-4" /> Agents
                  </span>
                  <span>{data.agent_count} / {data.agent_limit}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${Math.min(100, (data.agent_count / data.agent_limit) * 100)}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Agents */}
          <Card>
            <CardHeader>
              <CardTitle>Agents ({data.agents?.length || 0})</CardTitle>
              <CardDescription>Network monitoring agents</CardDescription>
            </CardHeader>
            <CardContent>
              {data.agents && data.agents.length > 0 ? (
                <div className="space-y-3">
                  {data.agents.map((agent) => (
                    <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${agent.is_online ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div>
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {agent.device_count} devices, {agent.segment_count} segments
                            {agent.version && ` • v${agent.version}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={agent.is_enabled ? 'default' : 'secondary'}>
                          {agent.is_enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(`Delete agent "${agent.name}"? This will also delete ${agent.device_count} devices and ${agent.segment_count} segments.`)) {
                              performAction('delete_agent', { agent_id: agent.id })
                            }
                          }}
                          disabled={actionLoading === 'delete_agent'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">No agents configured</div>
              )}
            </CardContent>
          </Card>

          {/* Segments */}
          <Card>
            <CardHeader>
              <CardTitle>Network Segments ({data.segments?.length || 0})</CardTitle>
              <CardDescription>Monitored network ranges</CardDescription>
            </CardHeader>
            <CardContent>
              {data.segments && data.segments.length > 0 ? (
                <div className="space-y-3">
                  {data.segments.map((segment) => (
                    <div key={segment.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium">{segment.name}</div>
                        <div className="text-sm text-muted-foreground font-mono">
                          {segment.cidr} • {segment.device_count} devices
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={segment.is_enabled ? 'default' : 'secondary'}>
                          {segment.is_enabled ? 'Active' : 'Disabled'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(`Delete segment "${segment.name}"? This will also delete ${segment.device_count} devices.`)) {
                              performAction('delete_segment', { segment_id: segment.id })
                            }
                          }}
                          disabled={actionLoading === 'delete_segment'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">No network segments</div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest audit log entries</CardDescription>
            </CardHeader>
            <CardContent>
              {data.recent_audit_logs && data.recent_audit_logs.length > 0 ? (
                <div className="space-y-3">
                  {data.recent_audit_logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-muted-foreground" />
                      <div className="flex-1">
                        <div className="font-medium">{log.action.replace('.', ' ').replace('_', ' ')}</div>
                        <div className="text-muted-foreground">
                          {log.actor_type === 'user' ? 'User' : log.actor_type === 'webhook' ? 'Webhook' : 'System'}
                          {log.actor_id && ` (${log.actor_id})`}
                        </div>
                      </div>
                      <div className="text-muted-foreground">{formatDateTime(log.created_at)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">No recent activity</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Status Actions */}
              {data.status === 'trial' && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => performAction('extend_trial', { days: 7 })}
                  disabled={actionLoading === 'extend_trial'}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Extend Trial (+7 days)
                </Button>
              )}

              {data.status === 'suspended' && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-green-600"
                  onClick={() => performAction('reactivate')}
                  disabled={actionLoading === 'reactivate'}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Reactivate Account
                </Button>
              )}

              {(data.status === 'active' || data.status === 'trial' || data.status === 'past_due') && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-orange-600"
                  onClick={() => {
                    if (confirm('Are you sure you want to suspend this organization?')) {
                      performAction('suspend')
                    }
                  }}
                  disabled={actionLoading === 'suspend'}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Suspend Account
                </Button>
              )}

              <hr className="my-2" />

              {/* Utility Actions */}
              {data.stripe_customer_id && (
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  asChild
                >
                  <a
                    href={`https://dashboard.stripe.com/customers/${data.stripe_customer_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    View in Stripe
                    <ExternalLink className="h-3 w-3 ml-auto" />
                  </a>
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => performAction('reset_api_keys')}
                disabled={actionLoading === 'reset_api_keys'}
              >
                <Key className="h-4 w-4 mr-2" />
                Reset All API Keys
              </Button>

              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => performAction('export_data')}
                disabled={actionLoading === 'export_data'}
              >
                <FileText className="h-4 w-4 mr-2" />
                Export Data (GDPR)
              </Button>

              <hr className="my-2" />

              {/* Danger Zone */}
              {data.status !== 'cancelled' && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => {
                    if (confirm('Are you sure you want to cancel this organization? This will stop billing and schedule data deletion.')) {
                      performAction('cancel')
                    }
                  }}
                  disabled={actionLoading === 'cancel'}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel Subscription
                </Button>
              )}

              {data.status === 'cancelled' && (
                <Button
                  variant="outline"
                  className="w-full justify-start text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => {
                    if (confirm('Are you sure you want to permanently delete this organization and all its data? This cannot be undone.')) {
                      performAction('delete')
                    }
                  }}
                  disabled={actionLoading === 'delete'}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Permanently
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Users</span>
                <span className="font-medium">{data.member_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Devices</span>
                <span className="font-medium">{data.device_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Agents</span>
                <span className="font-medium">{data.agent_count}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {!org && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200">
          Showing demo data. Connect to database to see real organization details.
        </div>
      )}
    </div>
  )
}

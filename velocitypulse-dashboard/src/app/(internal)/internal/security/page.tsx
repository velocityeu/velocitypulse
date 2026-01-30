'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ShieldAlert,
  Search,
  Filter,
  Clock,
  User,
  Webhook,
  Server,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { AuditLog } from '@/types'

const actionColors: Record<string, string> = {
  'organization.created': 'bg-green-500/10 text-green-500',
  'organization.updated': 'bg-blue-500/10 text-blue-500',
  'organization.suspended': 'bg-orange-500/10 text-orange-500',
  'organization.reactivated': 'bg-green-500/10 text-green-500',
  'member.invited': 'bg-blue-500/10 text-blue-500',
  'member.removed': 'bg-red-500/10 text-red-500',
  'agent.created': 'bg-green-500/10 text-green-500',
  'agent.deleted': 'bg-red-500/10 text-red-500',
  'agent.api_key_rotated': 'bg-orange-500/10 text-orange-500',
  'subscription.created': 'bg-green-500/10 text-green-500',
  'subscription.cancelled': 'bg-red-500/10 text-red-500',
  'subscription.payment_failed': 'bg-red-500/10 text-red-500',
}

const actorIcons = {
  user: User,
  webhook: Webhook,
  system: Server,
}

export default function SecurityPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const pageSize = 20

  useEffect(() => {
    loadLogs()
  }, [page])

  async function loadLogs() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/internal/audit-logs?page=${page}&limit=${pageSize}`)
      if (response.ok) {
        const data = await response.json()
        setLogs(data.logs)
      }
    } catch (error) {
      console.error('Failed to load audit logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Demo data
  const demoLogs: AuditLog[] = [
    {
      id: '1',
      organization_id: 'org_1',
      actor_type: 'user',
      actor_id: 'user_abc123',
      action: 'agent.created',
      resource_type: 'agent',
      resource_id: 'agent_xyz',
      metadata: { name: 'Office Agent' },
      ip_address: '192.168.1.100',
      created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '2',
      organization_id: 'org_2',
      actor_type: 'webhook',
      actor_id: 'stripe',
      action: 'subscription.created',
      resource_type: 'subscription',
      resource_id: 'sub_123',
      metadata: { plan: 'starter' },
      created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '3',
      organization_id: 'org_3',
      actor_type: 'system',
      action: 'organization.suspended',
      resource_type: 'organization',
      resource_id: 'org_3',
      metadata: { reason: 'trial_expired' },
      created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '4',
      organization_id: 'org_1',
      actor_type: 'user',
      actor_id: 'user_def456',
      action: 'member.invited',
      resource_type: 'member',
      resource_id: 'member_789',
      metadata: { email: 'newuser@example.com', role: 'editor' },
      ip_address: '10.0.0.50',
      created_at: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '5',
      organization_id: 'org_4',
      actor_type: 'webhook',
      actor_id: 'stripe',
      action: 'subscription.payment_failed',
      resource_type: 'invoice',
      resource_id: 'inv_abc',
      metadata: { amount: 5000 },
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: '6',
      organization_id: 'org_5',
      actor_type: 'user',
      actor_id: 'user_ghi789',
      action: 'agent.api_key_rotated',
      resource_type: 'agent',
      resource_id: 'agent_old',
      ip_address: '172.16.0.1',
      created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    },
  ]

  const data = logs.length > 0 ? logs : demoLogs

  // Filter logs
  const filteredLogs = data.filter((log) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch =
        log.organization_id.toLowerCase().includes(query) ||
        log.action.toLowerCase().includes(query) ||
        log.actor_id?.toLowerCase().includes(query) ||
        log.resource_id?.toLowerCase().includes(query)
      if (!matchesSearch) return false
    }

    if (actionFilter !== 'all' && log.action !== actionFilter) {
      return false
    }

    return true
  })

  // Get unique actions for filter
  const uniqueActions = [...new Set(data.map(l => l.action))].sort()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Security & Audit Logs</h1>
        <p className="text-muted-foreground">
          Monitor platform activity and security events
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by org ID, action, actor, or resource..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Actions</option>
              {uniqueActions.map((action) => (
                <option key={action} value={action}>
                  {action.replace('.', ' ').replace('_', ' ')}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Log</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} entries
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No audit logs found matching your filters.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => {
                const ActorIcon = actorIcons[log.actor_type]
                const actionColor = actionColors[log.action] || 'bg-gray-500/10 text-gray-500'

                return (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {/* Actor Icon */}
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <ActorIcon className="h-5 w-5 text-muted-foreground" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={actionColor}>
                          {log.action.replace('.', ' ').replace('_', ' ')}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          by {log.actor_type}
                          {log.actor_id && (
                            <span className="font-mono ml-1">({log.actor_id})</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="font-mono">{log.organization_id}</span>
                        {log.resource_id && (
                          <span>
                            {log.resource_type}: <span className="font-mono">{log.resource_id}</span>
                          </span>
                        )}
                        {log.ip_address && (
                          <span className="font-mono">{log.ip_address}</span>
                        )}
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground font-mono">
                          {JSON.stringify(log.metadata)}
                        </div>
                      )}
                    </div>

                    {/* Timestamp */}
                    <div className="text-sm text-muted-foreground whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={filteredLogs.length < pageSize}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {logs.length === 0 && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200">
          Showing demo data. Connect to database to see real audit logs.
        </div>
      )}
    </div>
  )
}

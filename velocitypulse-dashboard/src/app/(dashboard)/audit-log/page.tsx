'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { Download, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface AuditLog {
  id: string
  created_at: string
  actor_type: string
  actor_id: string | null
  action: string
  resource_type: string
  resource_id: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const ACTION_LABELS: Record<string, string> = {
  'agent.created': 'Agent Created',
  'agent.updated': 'Agent Updated',
  'agent.deleted': 'Agent Deleted',
  'agent.api_key_rotated': 'API Key Rotated',
  'device.created': 'Device Created',
  'device.updated': 'Device Updated',
  'device.deleted': 'Device Deleted',
  'device.offline': 'Device Offline',
  'device.online': 'Device Online',
  'device.degraded': 'Device Degraded',
  'category.created': 'Category Created',
  'category.updated': 'Category Updated',
  'category.deleted': 'Category Deleted',
  'organization.updated': 'Organization Updated',
  'organization.suspended': 'Organization Suspended',
  'organization.trial_warning_sent': 'Trial Warning Sent',
  'subscription.created': 'Subscription Created',
  'subscription.updated': 'Subscription Updated',
  'subscription.cancelled': 'Subscription Cancelled',
  'subscription.payment_failed': 'Payment Failed',
  'member.invited': 'Member Invited',
  'member.removed': 'Member Removed',
  'member.role_changed': 'Role Changed',
  'branding.updated': 'Branding Updated',
  'notification.created': 'Notification Created',
  'segment.created': 'Segment Created',
  'segment.updated': 'Segment Updated',
  'segment.deleted': 'Segment Deleted',
}

const ACTION_OPTIONS = [
  { value: 'all', label: 'All Actions' },
  { value: 'agent.created', label: 'Agent Created' },
  { value: 'agent.api_key_rotated', label: 'API Key Rotated' },
  { value: 'device.created', label: 'Device Created' },
  { value: 'device.deleted', label: 'Device Deleted' },
  { value: 'organization.updated', label: 'Org Updated' },
  { value: 'subscription.created', label: 'Subscription Created' },
  { value: 'member.invited', label: 'Member Invited' },
  { value: 'member.removed', label: 'Member Removed' },
]

function formatAction(action: string): string {
  return ACTION_LABELS[action] || action.replace(/\./g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

function getActorBadgeVariant(actorType: string): 'default' | 'secondary' | 'outline' {
  switch (actorType) {
    case 'system': return 'secondary'
    case 'user': return 'default'
    default: return 'outline'
  }
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 })
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [action, setAction] = useState('all')
  const [search, setSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchLogs = useCallback(async (page = 1) => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (action !== 'all') params.set('action', action)
      if (search) params.set('search', search)
      if (startDate) params.set('start_date', startDate)
      if (endDate) params.set('end_date', endDate)

      const res = await authFetch(`/api/dashboard/audit-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    } finally {
      setIsLoading(false)
    }
  }, [action, search, startDate, endDate])

  useEffect(() => {
    fetchLogs(1)
  }, [fetchLogs])

  const handleExportCSV = () => {
    const params = new URLSearchParams({ format: 'csv' })
    if (action !== 'all') params.set('action', action)
    if (search) params.set('search', search)
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    window.open(`/api/dashboard/audit-logs?${params}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p className="text-muted-foreground">Activity history for your organization</p>
        </div>
        <Button variant="outline" onClick={handleExportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by actor, resource..."
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Action</label>
              <select
                value={action}
                onChange={e => setAction(e.target.value)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm w-full md:w-48"
              >
                {ACTION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">From</label>
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">To</label>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {pagination.total} event{pagination.total !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex justify-center py-8">
              <p className="text-sm text-muted-foreground">No audit logs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-2 font-medium">Date</th>
                    <th className="text-left py-3 px-2 font-medium">Actor</th>
                    <th className="text-left py-3 px-2 font-medium">Action</th>
                    <th className="text-left py-3 px-2 font-medium">Resource</th>
                    <th className="text-left py-3 px-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => (
                    <tr key={log.id} className="border-b last:border-0">
                      <td className="py-3 px-2 whitespace-nowrap text-muted-foreground">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="py-3 px-2">
                        <Badge variant={getActorBadgeVariant(log.actor_type)}>
                          {log.actor_type}
                        </Badge>
                        {log.actor_id && (
                          <span className="ml-1 text-xs text-muted-foreground truncate max-w-[120px] inline-block align-middle">
                            {log.actor_id.length > 12 ? `${log.actor_id.slice(0, 12)}...` : log.actor_id}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        {formatAction(log.action)}
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {log.resource_type}
                        {log.resource_id && (
                          <span className="ml-1 text-xs truncate max-w-[100px] inline-block align-middle">
                            {log.resource_id.length > 8 ? `${log.resource_id.slice(0, 8)}...` : log.resource_id}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-xs text-muted-foreground max-w-[200px] truncate">
                        {log.metadata ? JSON.stringify(log.metadata) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchLogs(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchLogs(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

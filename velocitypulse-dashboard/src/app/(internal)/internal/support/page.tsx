'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Building2,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  User,
  RefreshCw,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { SupportTicket } from '@/types'

interface AdminTicket extends SupportTicket {
  comment_count?: number
}

interface TicketStats {
  total: number
  open: number
  in_progress: number
  resolved: number
  closed: number
  urgent: number
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-500/10 text-gray-500',
  normal: 'bg-blue-500/10 text-blue-500',
  high: 'bg-orange-500/10 text-orange-500',
  urgent: 'bg-red-500/10 text-red-500',
}

const categoryLabels: Record<string, string> = {
  billing: 'Billing',
  subscription: 'Subscription',
  technical: 'Technical',
  other: 'Other',
}

function KanbanColumn({
  title,
  icon: Icon,
  iconColor,
  tickets,
  emptyText,
}: {
  title: string
  icon: typeof Clock
  iconColor: string
  tickets: AdminTicket[]
  emptyText: string
}) {
  return (
    <div className="flex flex-col min-h-[400px]">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`h-4 w-4 ${iconColor}`} />
        <h3 className="font-semibold text-sm">{title}</h3>
        <Badge variant="secondary" className="ml-auto">{tickets.length}</Badge>
      </div>
      <div className="flex-1 space-y-2 bg-muted/30 rounded-lg p-2 min-h-0 overflow-y-auto max-h-[600px]">
        {tickets.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">{emptyText}</div>
        ) : (
          tickets.map(ticket => (
            <Link key={ticket.id} href={`/internal/support/${ticket.id}`}>
              <div className="bg-background border rounded-lg p-3 hover:shadow-sm transition-shadow cursor-pointer">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</span>
                  <Badge className={priorityColors[ticket.priority] + ' text-xs'}>
                    {ticket.priority}
                  </Badge>
                </div>
                <h4 className="text-sm font-medium line-clamp-2 mb-2">{ticket.subject}</h4>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Building2 className="h-3 w-3" />
                  <span className="truncate">{ticket.organization?.name || 'Unknown'}</span>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                  <span>{formatDate(ticket.created_at)}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="secondary" className="text-xs">{categoryLabels[ticket.category] || ticket.category}</Badge>
                    {(ticket.comment_count ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5">
                        <MessageSquare className="h-3 w-3" />
                        {ticket.comment_count}
                      </span>
                    )}
                  </div>
                </div>
                {ticket.assignee && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span>
                      {ticket.assignee.first_name || ticket.assignee.email}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([])
  const [stats, setStats] = useState<TicketStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')

  useEffect(() => {
    loadTickets()
  }, [])

  async function loadTickets() {
    setIsLoading(true)
    try {
      const res = await fetch('/api/internal/support')
      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets || [])
        setStats(data.stats || null)
      }
    } catch (error) {
      console.error('Failed to load tickets:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Apply client-side filters
  const filtered = tickets.filter(t => {
    if (search) {
      const q = search.toLowerCase()
      if (
        !t.subject.toLowerCase().includes(q) &&
        !t.ticket_number.toLowerCase().includes(q) &&
        !(t.organization?.name || '').toLowerCase().includes(q)
      ) return false
    }
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
    return true
  })

  const incoming = filtered.filter(t => t.status === 'open')
  const inProgress = filtered.filter(t => t.status === 'in_progress')
  const resolved = filtered.filter(t => t.status === 'resolved' || t.status === 'closed')

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="h-96 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support Tickets</h1>
          <p className="text-muted-foreground">Manage customer support requests</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadTickets} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/internal/support/lookup">
              <Search className="h-4 w-4 mr-2" />
              Customer Lookup
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{stats.open}</div>
                  <div className="text-sm text-muted-foreground">Open</div>
                </div>
                <AlertCircle className="h-5 w-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{stats.in_progress}</div>
                  <div className="text-sm text-muted-foreground">In Progress</div>
                </div>
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{stats.resolved}</div>
                  <div className="text-sm text-muted-foreground">Resolved</div>
                </div>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-red-500">{stats.urgent}</div>
                  <div className="text-sm text-muted-foreground">Urgent Open</div>
                </div>
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tickets, orgs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-10 pr-4 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="all">All Categories</option>
          <option value="billing">Billing</option>
          <option value="subscription">Subscription</option>
          <option value="technical">Technical</option>
          <option value="other">Other</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="h-9 px-3 rounded-md border border-input bg-background text-sm"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>

      {/* Kanban Board */}
      <div className="grid gap-4 lg:grid-cols-3">
        <KanbanColumn
          title="Incoming"
          icon={AlertCircle}
          iconColor="text-blue-500"
          tickets={incoming}
          emptyText="No open tickets"
        />
        <KanbanColumn
          title="In Progress"
          icon={Clock}
          iconColor="text-amber-500"
          tickets={inProgress}
          emptyText="No tickets in progress"
        />
        <KanbanColumn
          title="Resolved / Closed"
          icon={CheckCircle2}
          iconColor="text-green-500"
          tickets={resolved}
          emptyText="No resolved tickets"
        />
      </div>
    </div>
  )
}

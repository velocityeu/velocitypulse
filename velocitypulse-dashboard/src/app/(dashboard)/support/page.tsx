'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus,
  MessageSquare,
  Clock,
  AlertCircle,
  CheckCircle2,
  Search,
  LifeBuoy,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { SupportTicket } from '@/types'

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  open: { label: 'Open', color: 'bg-blue-500/10 text-blue-500', icon: AlertCircle },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/10 text-amber-500', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-500/10 text-green-500', icon: CheckCircle2 },
  closed: { label: 'Closed', color: 'bg-gray-500/10 text-gray-500', icon: CheckCircle2 },
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

export default function SupportPage() {
  const [tickets, setTickets] = useState<(SupportTicket & { comment_count?: number })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved' | 'closed'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadTickets()
  }, [])

  async function loadTickets() {
    setIsLoading(true)
    try {
      const res = await authFetch('/api/dashboard/support')
      if (res.ok) {
        const data = await res.json()
        setTickets(data.tickets || [])
      }
    } catch (error) {
      console.error('Failed to load tickets:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filtered = tickets.filter(t => {
    if (filter !== 'all' && t.status !== filter) return false
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !t.ticket_number.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const openCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Support</h1>
          <p className="text-muted-foreground">
            {openCount > 0 ? `${openCount} open ticket${openCount !== 1 ? 's' : ''}` : 'No open tickets'}
          </p>
        </div>
        <Button asChild>
          <Link href="/support/new">
            <Plus className="h-4 w-4 mr-2" />
            New Ticket
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search tickets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
            <Button
              key={s}
              variant={filter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? 'All' : s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Tickets List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LifeBuoy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">
              {tickets.length === 0 ? 'No support tickets yet' : 'No tickets match your filter'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {tickets.length === 0
                ? 'Need help? Create a support ticket and our team will get back to you.'
                : 'Try changing the filter or search term.'}
            </p>
            {tickets.length === 0 && (
              <Button asChild>
                <Link href="/support/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Ticket
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Tickets</CardTitle>
            <CardDescription>
              {filtered.length} ticket{filtered.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filtered.map(ticket => {
                const statusInfo = statusConfig[ticket.status] || statusConfig.open
                const StatusIcon = statusInfo.icon
                return (
                  <Link key={ticket.id} href={`/support/${ticket.id}`}>
                    <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors">
                      <StatusIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</span>
                          <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
                          <Badge className={priorityColors[ticket.priority]}>
                            {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                          </Badge>
                          <Badge variant="secondary">{categoryLabels[ticket.category] || ticket.category}</Badge>
                        </div>
                        <h3 className="font-medium truncate">{ticket.subject}</h3>
                        <p className="text-sm text-muted-foreground">
                          Created {formatDate(ticket.created_at)}
                        </p>
                      </div>
                      {(ticket.comment_count ?? 0) > 0 && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <MessageSquare className="h-4 w-4" />
                          {ticket.comment_count}
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

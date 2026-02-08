'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Building2,
  User,
  Shield,
  Send,
  Lock,
  MessageSquare,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import type { SupportTicket, TicketComment } from '@/types'

const statusConfig: Record<string, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-blue-500/10 text-blue-500' },
  in_progress: { label: 'In Progress', color: 'bg-amber-500/10 text-amber-500' },
  resolved: { label: 'Resolved', color: 'bg-green-500/10 text-green-500' },
  closed: { label: 'Closed', color: 'bg-gray-500/10 text-gray-500' },
}

const priorityColors: Record<string, string> = {
  low: 'bg-gray-500/10 text-gray-500',
  normal: 'bg-blue-500/10 text-blue-500',
  high: 'bg-orange-500/10 text-orange-500',
  urgent: 'bg-red-500/10 text-red-500',
}

interface Admin {
  id: string
  email: string
  name: string
}

export default function AdminTicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [comments, setComments] = useState<(TicketComment & { author?: { email: string; first_name: string | null; last_name: string | null } })[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [isInternal, setIsInternal] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  useEffect(() => {
    loadTicket()
  }, [params.id])

  async function loadTicket() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/internal/support/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setTicket(data.ticket)
        setComments(data.comments || [])
        setAdmins(data.admins || [])
      }
    } catch (error) {
      console.error('Failed to load ticket:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function updateTicket(updates: Record<string, unknown>) {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/internal/support/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        await loadTicket()
      }
    } catch (error) {
      console.error('Failed to update ticket:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyContent.trim()) return

    setIsSending(true)
    try {
      const res = await fetch(`/api/internal/support/${params.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent, is_internal: isInternal }),
      })
      if (res.ok) {
        setReplyContent('')
        setIsInternal(false)
        await loadTicket()
      }
    } catch (error) {
      console.error('Failed to send reply:', error)
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Ticket Not Found</h1>
        </div>
      </div>
    )
  }

  const statusInfo = statusConfig[ticket.status] || statusConfig.open

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/internal/support')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm text-muted-foreground">{ticket.ticket_number}</span>
            <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            <Badge className={priorityColors[ticket.priority]}>
              {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
            </Badge>
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-1">{ticket.subject}</h1>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm">{ticket.description}</div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                <span>Created {formatDateTime(ticket.created_at)}</span>
                <span>Updated {formatDateTime(ticket.updated_at)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Comment Thread */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments ({comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {comments.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No comments yet. Add a reply below.
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map(comment => {
                    const isAdmin = comment.author_type === 'admin'
                    const authorName = comment.author
                      ? `${comment.author.first_name || ''} ${comment.author.last_name || ''}`.trim() || comment.author.email
                      : 'Unknown'
                    return (
                      <div
                        key={comment.id}
                        className={`p-4 rounded-lg ${
                          comment.is_internal
                            ? 'bg-amber-500/5 border border-amber-500/20'
                            : isAdmin
                            ? 'bg-primary/5 border border-primary/20'
                            : 'bg-muted/50 border'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                            comment.is_internal ? 'bg-amber-500/10' : isAdmin ? 'bg-primary/10' : 'bg-muted'
                          }`}>
                            {comment.is_internal ? (
                              <Lock className="h-3 w-3 text-amber-600" />
                            ) : isAdmin ? (
                              <Shield className="h-3 w-3 text-primary" />
                            ) : (
                              <User className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <span className="text-sm font-medium">{authorName}</span>
                          {comment.is_internal && (
                            <Badge className="bg-amber-500/10 text-amber-600 text-xs">Internal Note</Badge>
                          )}
                          {isAdmin && !comment.is_internal && (
                            <Badge variant="secondary" className="text-xs">Support Team</Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatDateTime(comment.created_at)}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap text-sm pl-8">{comment.content}</div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Reply Form */}
              <form onSubmit={handleReply} className="mt-6 pt-4 border-t">
                <textarea
                  placeholder={isInternal ? 'Write an internal note (not visible to customer)...' : 'Write a reply to the customer...'}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  rows={3}
                  className={`w-full px-3 py-2 rounded-md border text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y ${
                    isInternal
                      ? 'border-amber-500/50 bg-amber-500/5'
                      : 'border-input bg-background'
                  }`}
                />
                <div className="flex items-center justify-between mt-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded border-input"
                    />
                    <Lock className="h-3 w-3 text-amber-600" />
                    Internal note (not visible to customer)
                  </label>
                  <Button type="submit" disabled={isSending || !replyContent.trim()} size="sm">
                    <Send className="h-4 w-4 mr-2" />
                    {isSending ? 'Sending...' : isInternal ? 'Add Note' : 'Send Reply'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status / Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ticket Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <select
                  value={ticket.status}
                  onChange={(e) => updateTicket({ status: e.target.value })}
                  disabled={isUpdating}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="text-sm font-medium mb-1 block">Priority</label>
                <select
                  value={ticket.priority}
                  onChange={(e) => updateTicket({ priority: e.target.value })}
                  disabled={isUpdating}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              {/* Assignment */}
              <div>
                <label className="text-sm font-medium mb-1 block">Assigned To</label>
                <select
                  value={ticket.assigned_to || ''}
                  onChange={(e) => updateTicket({ assigned_to: e.target.value })}
                  disabled={isUpdating}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Unassigned</option>
                  {admins.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="text-sm text-muted-foreground">Category</label>
                <div className="font-medium capitalize">{ticket.category}</div>
              </div>
            </CardContent>
          </Card>

          {/* Organization */}
          {ticket.organization && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Organization</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{ticket.organization.name}</div>
                    <div className="text-sm text-muted-foreground">{ticket.organization.customer_number}</div>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-3" asChild>
                  <Link href={`/internal/organizations/${ticket.organization.id || ''}`}>
                    View Organization
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Creator Info */}
          {ticket.creator && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Created By</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">
                      {`${ticket.creator.first_name || ''} ${ticket.creator.last_name || ''}`.trim() || 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-foreground">{ticket.creator.email}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

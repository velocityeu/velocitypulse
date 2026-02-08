'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  Clock,
  AlertCircle,
  CheckCircle2,
  Send,
  User,
  Shield,
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

export default function TicketDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [ticket, setTicket] = useState<SupportTicket | null>(null)
  const [comments, setComments] = useState<(TicketComment & { author?: { email: string; first_name: string | null; last_name: string | null } })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    loadTicket()
  }, [params.id])

  async function loadTicket() {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/dashboard/support/${params.id}`)
      if (res.ok) {
        const data = await res.json()
        setTicket(data.ticket)
        setComments(data.comments || [])
      }
    } catch (error) {
      console.error('Failed to load ticket:', error)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleReply(e: React.FormEvent) {
    e.preventDefault()
    if (!replyContent.trim()) return

    setIsSending(true)
    try {
      const res = await fetch(`/api/dashboard/support/${params.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent }),
      })

      if (res.ok) {
        setReplyContent('')
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
  const isClosed = ticket.status === 'closed'

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/support')}>
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

      {/* Ticket Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Details</CardTitle>
            <span className="text-sm text-muted-foreground">
              Created {formatDateTime(ticket.created_at)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3 mb-4">
            <div>
              <div className="text-sm text-muted-foreground">Category</div>
              <div className="font-medium capitalize">{ticket.category}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <Badge className={statusInfo.color}>{statusInfo.label}</Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Last Updated</div>
              <div className="font-medium">{formatDateTime(ticket.updated_at)}</div>
            </div>
          </div>
          <div className="border-t pt-4">
            <div className="text-sm text-muted-foreground mb-2">Description</div>
            <div className="whitespace-pre-wrap text-sm">{ticket.description}</div>
          </div>
        </CardContent>
      </Card>

      {/* Comment Thread */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Conversation ({comments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comments.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No replies yet. Our team will respond soon.
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
                      isAdmin ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50 border'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                        isAdmin ? 'bg-primary/10' : 'bg-muted'
                      }`}>
                        {isAdmin ? (
                          <Shield className="h-3 w-3 text-primary" />
                        ) : (
                          <User className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{authorName}</span>
                      {isAdmin && (
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
          {!isClosed && (
            <form onSubmit={handleReply} className="mt-6 pt-4 border-t">
              <textarea
                placeholder="Write a reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
              />
              <div className="flex justify-end mt-2">
                <Button type="submit" disabled={isSending || !replyContent.trim()} size="sm">
                  <Send className="h-4 w-4 mr-2" />
                  {isSending ? 'Sending...' : 'Send Reply'}
                </Button>
              </div>
            </form>
          )}

          {isClosed && (
            <div className="mt-4 pt-4 border-t text-center text-sm text-muted-foreground">
              This ticket is closed. Create a new ticket if you need further assistance.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

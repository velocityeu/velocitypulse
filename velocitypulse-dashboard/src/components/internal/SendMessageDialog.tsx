'use client'

import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
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

interface SendMessageDialogProps {
  orgId: string
  orgName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SendMessageDialog({ orgId, orgName, open, onOpenChange }: SendMessageDialogProps) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) return

    setSending(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetch(`/api/internal/organizations/${orgId}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send message')

      setSuccess(data.message || 'Message sent successfully')
      setSubject('')
      setMessage('')
      setTimeout(() => onOpenChange(false), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setSending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Send Message to Owner
          </DialogTitle>
          <DialogDescription>
            Send an email to the owner of &quot;{orgName}&quot;
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g., Important notice about your account"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Message</Label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Type your message here..."
              rows={5}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
            />
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-sm">
              {success}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending || !subject.trim() || !message.trim()}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Email
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

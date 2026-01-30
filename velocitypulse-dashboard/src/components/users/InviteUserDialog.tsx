'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MemberRole } from '@/types'

interface InviteUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onInvite: (email: string, role: MemberRole) => Promise<void>
}

const ROLES: { value: MemberRole; label: string; description: string }[] = [
  {
    value: 'admin',
    label: 'Admin',
    description: 'Can manage agents, devices, and users',
  },
  {
    value: 'editor',
    label: 'Editor',
    description: 'Can manage devices only',
  },
  {
    value: 'viewer',
    label: 'Viewer',
    description: 'View-only access to the dashboard',
  },
]

export function InviteUserDialog({ open, onOpenChange, onInvite }: InviteUserDialogProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<MemberRole>('viewer')
  const [inviting, setInviting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleInvite = async () => {
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }

    setInviting(true)
    setError(null)
    try {
      await onInvite(email.trim().toLowerCase(), role)
      setEmail('')
      setRole('viewer')
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to invite user')
    } finally {
      setInviting(false)
    }
  }

  const handleClose = () => {
    setEmail('')
    setRole('viewer')
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription>
            Add a team member to your organization. They must have an existing account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Email Address</label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Role</label>
            <div className="mt-2 space-y-2">
              {ROLES.map(r => (
                <label
                  key={r.value}
                  className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    role === r.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="font-medium">{r.label}</p>
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={inviting}>
            Cancel
          </Button>
          <Button onClick={handleInvite} disabled={inviting || !email.trim()}>
            {inviting ? 'Inviting...' : 'Send Invite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

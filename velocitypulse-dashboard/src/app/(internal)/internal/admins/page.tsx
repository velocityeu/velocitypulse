'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Loader2, AlertCircle, RefreshCw, Shield,
  UserPlus, MoreVertical, Trash2, Ban, CheckCircle2,
  Clock, Mail, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import type { AdminRole } from '@/types'

interface AdminUser {
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  full_name: string
  image_url: string | null
  role: AdminRole
  is_active: boolean
  invited_by: string | null
  last_sign_in_at: string | null
  created_at: string
}

const ADMIN_ROLE_CONFIG: Record<AdminRole, { label: string; color: string; bgColor: string }> = {
  super_admin: { label: 'Super Admin', color: 'text-red-600', bgColor: 'bg-red-500/10' },
  billing_admin: { label: 'Billing Admin', color: 'text-amber-600', bgColor: 'bg-amber-500/10' },
  support_admin: { label: 'Support Admin', color: 'text-blue-600', bgColor: 'bg-blue-500/10' },
  viewer: { label: 'Viewer', color: 'text-gray-600', bgColor: 'bg-gray-500/10' },
}

interface PendingAdminInvitation {
  id: string
  email: string
  role: string
  status: string
  invited_by: string
  expires_at: string
  created_at: string
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [invitations, setInvitations] = useState<PendingAdminInvitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<AdminRole>('support_admin')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)

  // Change role dialog
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null)
  const [newRole, setNewRole] = useState<AdminRole>('viewer')
  const [changingRole, setChangingRole] = useState(false)

  // Remove dialog
  const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null)
  const [removing, setRemoving] = useState(false)

  const loadAdmins = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/internal/admins')
      if (!res.ok) throw new Error('Failed to load admins')
      const data = await res.json()
      setAdmins(data.admins || [])
      setInvitations(data.invitations || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load admins')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAdmins()
  }, [loadAdmins])

  const handleInvite = async () => {
    setInviting(true)
    setInviteError(null)
    try {
      const res = await fetch('/api/internal/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to invite admin')
      if (data.admin) {
        setAdmins(prev => [...prev, data.admin])
      } else if (data.invitation) {
        setInvitations(prev => [...prev, data.invitation])
      }
      setInviteOpen(false)
      setInviteEmail('')
      setInviteRole('support_admin')
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to invite admin')
    } finally {
      setInviting(false)
    }
  }

  const handleChangeRole = async () => {
    if (!roleTarget) return
    setChangingRole(true)
    try {
      const res = await fetch(`/api/internal/admins/${roleTarget.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to change role')
      }
      setAdmins(prev => prev.map(a =>
        a.user_id === roleTarget.user_id ? { ...a, role: newRole } : a
      ))
      setRoleTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role')
    } finally {
      setChangingRole(false)
    }
  }

  const handleToggleActive = async (admin: AdminUser) => {
    try {
      const res = await fetch(`/api/internal/admins/${admin.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !admin.is_active }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to update admin')
      }
      setAdmins(prev => prev.map(a =>
        a.user_id === admin.user_id ? { ...a, is_active: !admin.is_active } : a
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update admin')
    }
  }

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      const res = await fetch(`/api/internal/admins/${removeTarget.user_id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove admin')
      }
      setAdmins(prev => prev.filter(a => a.user_id !== removeTarget.user_id))
      setRemoveTarget(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove admin')
    } finally {
      setRemoving(false)
    }
  }

  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const res = await fetch(`/api/internal/invitations/${invitationId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to revoke invitation')
      }
      setInvitations(prev => prev.filter(i => i.id !== invitationId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invitation')
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Users</h1>
          <p className="text-muted-foreground">
            Manage staff access to the internal admin panel
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadAdmins} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setInviteOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Admin
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
            Dismiss
          </Button>
        </div>
      )}

      {/* Pending Admin Invitations */}
      {!isLoading && invitations.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b bg-amber-50/50 dark:bg-amber-950/20">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-medium">Pending Invitations</span>
                <Badge variant="secondary" className="ml-1">{invitations.length}</Badge>
              </div>
            </div>
            <div className="divide-y">
              {invitations.map(inv => {
                const roleConfig = ADMIN_ROLE_CONFIG[inv.role as AdminRole]
                return (
                  <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Invited as{' '}
                          <span className={roleConfig?.color}>{roleConfig?.label || inv.role}</span>
                          {' '}&middot; Expires {formatDate(inv.expires_at)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRevokeInvitation(inv.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : admins.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No admin users</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Add your first admin user to manage the platform
            </p>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Admin
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">User</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Role</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden md:table-cell">Status</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden lg:table-cell">Last Login</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map(admin => {
                    const roleConfig = ADMIN_ROLE_CONFIG[admin.role]
                    return (
                      <tr key={admin.user_id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {admin.image_url ? (
                              <img src={admin.image_url} alt="" className="h-8 w-8 rounded-full" />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                {admin.full_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{admin.full_name}</p>
                              <p className="text-xs text-muted-foreground">{admin.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${roleConfig.bgColor} ${roleConfig.color}`}>
                            {roleConfig.label}
                          </span>
                        </td>
                        <td className="p-3 hidden md:table-cell">
                          {admin.is_active ? (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-gray-500 border-gray-200 bg-gray-50">
                              Disabled
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-sm text-muted-foreground hidden lg:table-cell">
                          {formatDate(admin.last_sign_in_at)}
                        </td>
                        <td className="p-3">
                          <DropdownMenu>
                            <DropdownMenuTrigger>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={() => {
                                setRoleTarget(admin)
                                setNewRole(admin.role)
                              }}>
                                <Shield className="h-4 w-4 mr-2" />
                                Change Role
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleToggleActive(admin)}>
                                {admin.is_active ? (
                                  <>
                                    <Ban className="h-4 w-4 mr-2" />
                                    Disable
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Enable
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setRemoveTarget(admin)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove Admin
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin count */}
      {!isLoading && admins.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {admins.length} admin{admins.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Invite Admin Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Admin User</DialogTitle>
            <DialogDescription>
              Grant admin access to a VelocityPulse user. If they don't have an account yet, they'll receive an email invitation to sign up.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <Input
                placeholder="admin@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Role</label>
              <div className="space-y-2">
                {(Object.entries(ADMIN_ROLE_CONFIG) as [AdminRole, typeof ADMIN_ROLE_CONFIG[AdminRole]][]).map(([role, config]) => (
                  <label
                    key={role}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      inviteRole === role
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <input
                      type="radio"
                      name="inviteRole"
                      value={role}
                      checked={inviteRole === role}
                      onChange={() => setInviteRole(role)}
                    />
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
                      {config.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {inviteError && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                {inviteError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviting}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.includes('@')}
            >
              {inviting ? 'Adding...' : 'Add Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={!!roleTarget} onOpenChange={() => setRoleTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Admin Role</DialogTitle>
            <DialogDescription>
              Change the role for {roleTarget?.full_name}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2">
            {(Object.entries(ADMIN_ROLE_CONFIG) as [AdminRole, typeof ADMIN_ROLE_CONFIG[AdminRole]][]).map(([role, config]) => (
              <label
                key={role}
                className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                  newRole === role
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground'
                }`}
              >
                <input
                  type="radio"
                  name="changeRole"
                  value={role}
                  checked={newRole === role}
                  onChange={() => setNewRole(role)}
                />
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
                  {config.label}
                </span>
              </label>
            ))}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleTarget(null)} disabled={changingRole}>
              Cancel
            </Button>
            <Button onClick={handleChangeRole} disabled={changingRole || newRole === roleTarget?.role}>
              {changingRole ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Admin Dialog */}
      <Dialog open={!!removeTarget} onOpenChange={() => setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Remove Admin Access</DialogTitle>
            <DialogDescription>
              Remove admin access for {removeTarget?.full_name}? They will no longer be able to access the internal panel.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
            <p className="text-muted-foreground">
              This will set is_staff to false and remove their admin role. This does not affect
              their subscriber account or organization memberships.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={removing}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={removing}>
              {removing ? 'Removing...' : 'Remove Admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

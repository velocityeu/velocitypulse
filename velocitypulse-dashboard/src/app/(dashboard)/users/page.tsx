'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Trash2, RefreshCw, Loader2, AlertCircle,
  Users, Crown, Shield, Edit3, Eye
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { InviteUserDialog } from '@/components/users/InviteUserDialog'
import type { OrganizationMember, MemberRole } from '@/types'

interface MemberWithUser extends OrganizationMember {
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    fullName: string
    imageUrl: string | null
  }
}

// Role configuration
const ROLE_CONFIG: Record<MemberRole, { label: string; icon: typeof Crown; variant: 'default' | 'secondary' | 'outline' | 'destructive'; color: string }> = {
  owner: { label: 'Owner', icon: Crown, variant: 'default', color: 'text-amber-500' },
  admin: { label: 'Admin', icon: Shield, variant: 'secondary', color: 'text-blue-500' },
  editor: { label: 'Editor', icon: Edit3, variant: 'outline', color: 'text-green-500' },
  viewer: { label: 'Viewer', icon: Eye, variant: 'outline', color: 'text-muted-foreground' },
}

export default function UsersPage() {
  const [members, setMembers] = useState<MemberWithUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invite dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  // Change role dialog
  const [memberToChangeRole, setMemberToChangeRole] = useState<MemberWithUser | null>(null)
  const [newRole, setNewRole] = useState<MemberRole>('viewer')
  const [changingRole, setChangingRole] = useState(false)

  // Remove dialog
  const [memberToRemove, setMemberToRemove] = useState<MemberWithUser | null>(null)
  const [removingMember, setRemovingMember] = useState(false)

  // Load members
  const loadMembers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/dashboard/members')
      if (!res.ok) throw new Error('Failed to load members')
      const data = await res.json()
      setMembers(data.members || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  // Invite user
  const handleInvite = async (email: string, role: MemberRole) => {
    const res = await fetch('/api/dashboard/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to invite user')
    setMembers(prev => [...prev, data.member])
  }

  // Change role
  const handleChangeRole = async () => {
    if (!memberToChangeRole) return
    setChangingRole(true)
    try {
      const res = await fetch(`/api/dashboard/members/${memberToChangeRole.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to change role')
      setMembers(prev => prev.map(m => m.id === memberToChangeRole.id ? { ...m, ...data.member } : m))
      setMemberToChangeRole(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change role')
    } finally {
      setChangingRole(false)
    }
  }

  // Remove member
  const handleRemoveMember = async () => {
    if (!memberToRemove) return
    setRemovingMember(true)
    try {
      const res = await fetch(`/api/dashboard/members/${memberToRemove.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to remove member')
      }
      setMembers(prev => prev.filter(m => m.id !== memberToRemove.id))
      setMemberToRemove(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member')
    } finally {
      setRemovingMember(false)
    }
  }

  // Open change role dialog
  const openChangeRoleDialog = (member: MemberWithUser) => {
    setMemberToChangeRole(member)
    setNewRole(member.role)
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            Manage your team members and their access
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadMembers} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setInviteDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">
            Dismiss
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : members.length === 0 ? (
        /* Empty state */
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No team members</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Invite team members to collaborate on your organization
            </p>
            <Button onClick={() => setInviteDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Invite your first user
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Members table */
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">User</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Role</th>
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden md:table-cell">Joined</th>
                    <th className="text-right p-3 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map(member => {
                    const roleConfig = ROLE_CONFIG[member.role]
                    const RoleIcon = roleConfig.icon
                    const isOwner = member.role === 'owner'

                    return (
                      <tr key={member.id} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            {member.user.imageUrl ? (
                              <img
                                src={member.user.imageUrl}
                                alt=""
                                className="h-8 w-8 rounded-full"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                                {member.user.fullName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-medium">{member.user.fullName}</p>
                              <p className="text-xs text-muted-foreground sm:hidden">{member.user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-sm hidden sm:table-cell">
                          {member.user.email}
                        </td>
                        <td className="p-3">
                          <Badge variant={roleConfig.variant} className="gap-1">
                            <RoleIcon className={`h-3 w-3 ${roleConfig.color}`} />
                            {roleConfig.label}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">
                          {formatDate(member.created_at)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-1">
                            {!isOwner && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openChangeRoleDialog(member)}
                                >
                                  Change Role
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => setMemberToRemove(member)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
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

      {/* Member count */}
      {!isLoading && members.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {members.length} user{members.length !== 1 ? 's' : ''}
        </p>
      )}

      {/* Invite Dialog */}
      <InviteUserDialog
        open={inviteDialogOpen}
        onOpenChange={setInviteDialogOpen}
        onInvite={handleInvite}
      />

      {/* Change Role Dialog */}
      <Dialog open={!!memberToChangeRole} onOpenChange={() => setMemberToChangeRole(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              Change the role for {memberToChangeRole?.user.fullName}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2">
            {(['admin', 'editor', 'viewer'] as MemberRole[]).map(role => {
              const config = ROLE_CONFIG[role]
              const Icon = config.icon
              return (
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
                    name="role"
                    value={role}
                    checked={newRole === role}
                    onChange={() => setNewRole(role)}
                  />
                  <Icon className={`h-4 w-4 ${config.color}`} />
                  <span className="font-medium">{config.label}</span>
                </label>
              )
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberToChangeRole(null)} disabled={changingRole}>
              Cancel
            </Button>
            <Button onClick={handleChangeRole} disabled={changingRole || newRole === memberToChangeRole?.role}>
              {changingRole ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Remove User</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {memberToRemove?.user.fullName} from this organization?
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
            <p className="text-muted-foreground">
              This user will lose access to all organization resources. This action cannot be undone.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMemberToRemove(null)} disabled={removingMember}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveMember} disabled={removingMember}>
              {removingMember ? 'Removing...' : 'Remove User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

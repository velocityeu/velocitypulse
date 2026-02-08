'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import {
  Plus, Trash2, RefreshCw, Loader2, AlertCircle,
  Users, Crown, Shield, Edit3, Eye, Search,
  MoreVertical, UserCog, ChevronDown, Clock, Mail, RotateCw, X
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
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
    lastSignInAt: string | null
  }
}

interface PendingInvitation {
  id: string
  email: string
  role: string
  status: string
  invited_by: string
  expires_at: string
  created_at: string
}

// Role configuration with tooltips
const ROLE_CONFIG: Record<MemberRole, {
  label: string
  icon: typeof Crown
  variant: 'default' | 'secondary' | 'outline' | 'destructive'
  color: string
  tooltip: string
}> = {
  owner: {
    label: 'Owner',
    icon: Crown,
    variant: 'default',
    color: 'text-amber-500',
    tooltip: 'Full access. Can manage billing, users, agents, and all settings.',
  },
  admin: {
    label: 'Admin',
    icon: Shield,
    variant: 'secondary',
    color: 'text-blue-500',
    tooltip: 'Can manage users, agents, and devices. Cannot manage billing.',
  },
  editor: {
    label: 'Editor',
    icon: Edit3,
    variant: 'outline',
    color: 'text-green-500',
    tooltip: 'Can manage devices. Cannot manage agents, users, or billing.',
  },
  viewer: {
    label: 'Viewer',
    icon: Eye,
    variant: 'outline',
    color: 'text-muted-foreground',
    tooltip: 'Read-only access. Can view dashboards and devices.',
  },
}

export default function UsersPage() {
  const [members, setMembers] = useState<MemberWithUser[]>([])
  const [invitations, setInvitations] = useState<PendingInvitation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Selection state for bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Invite dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  // Change role dialog
  const [memberToChangeRole, setMemberToChangeRole] = useState<MemberWithUser | null>(null)
  const [newRole, setNewRole] = useState<MemberRole>('viewer')
  const [changingRole, setChangingRole] = useState(false)

  // Remove dialog
  const [memberToRemove, setMemberToRemove] = useState<MemberWithUser | null>(null)
  const [removingMember, setRemovingMember] = useState(false)

  // Bulk role change dialog
  const [bulkRoleDialogOpen, setBulkRoleDialogOpen] = useState(false)
  const [bulkNewRole, setBulkNewRole] = useState<MemberRole>('viewer')
  const [bulkChanging, setBulkChanging] = useState(false)

  // Bulk remove dialog
  const [bulkRemoveDialogOpen, setBulkRemoveDialogOpen] = useState(false)
  const [bulkRemoving, setBulkRemoving] = useState(false)

  // Filter members by search query
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members
    const q = searchQuery.toLowerCase()
    return members.filter(m =>
      m.user.fullName.toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q)
    )
  }, [members, searchQuery])

  // Non-owner selected members (bulk ops don't apply to owners)
  const selectedNonOwnerMembers = useMemo(() => {
    return filteredMembers.filter(m => selectedIds.has(m.id) && m.role !== 'owner')
  }, [filteredMembers, selectedIds])

  // Load members
  const loadMembers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/dashboard/members')
      if (!res.ok) throw new Error('Failed to load members')
      const data = await res.json()
      setMembers(data.members || [])
      setInvitations(data.invitations || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMembers()
  }, [loadMembers])

  // Clear selection when search changes
  useEffect(() => {
    setSelectedIds(new Set())
  }, [searchQuery])

  // Invite user — handles both member and invitation responses
  const handleInvite = async (email: string, role: MemberRole) => {
    const res = await authFetch('/api/dashboard/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to invite user')
    if (data.member) {
      setMembers(prev => [...prev, data.member])
    } else if (data.invitation) {
      setInvitations(prev => [...prev, data.invitation])
    }
  }

  // Change role
  const handleChangeRole = async () => {
    if (!memberToChangeRole) return
    setChangingRole(true)
    try {
      const res = await authFetch(`/api/dashboard/members/${memberToChangeRole.id}`, {
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
      const res = await authFetch(`/api/dashboard/members/${memberToRemove.id}`, { method: 'DELETE' })
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

  // Revoke invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const res = await authFetch(`/api/dashboard/invitations/${invitationId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to revoke invitation')
      }
      setInvitations(prev => prev.filter(i => i.id !== invitationId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke invitation')
    }
  }

  // Resend invitation
  const handleResendInvitation = async (invitationId: string) => {
    try {
      const res = await authFetch(`/api/dashboard/invitations/${invitationId}/resend`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to resend invitation')
      // Update the invitation in state with new expiry
      if (data.invitation) {
        setInvitations(prev => prev.map(i =>
          i.id === invitationId ? { ...i, ...data.invitation } : i
        ))
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend invitation')
    }
  }

  // Bulk change role
  const handleBulkChangeRole = async () => {
    setBulkChanging(true)
    try {
      const promises = selectedNonOwnerMembers.map(m =>
        authFetch(`/api/dashboard/members/${m.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: bulkNewRole }),
        }).then(async res => {
          if (!res.ok) throw new Error('Failed')
          const data = await res.json()
          return { id: m.id, member: data.member }
        })
      )
      const results = await Promise.allSettled(promises)
      const succeeded = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<{ id: string; member: OrganizationMember }>[]
      setMembers(prev => prev.map(m => {
        const updated = succeeded.find(s => s.value.id === m.id)
        return updated ? { ...m, ...updated.value.member } : m
      }))
      setSelectedIds(new Set())
      setBulkRoleDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change roles')
    } finally {
      setBulkChanging(false)
    }
  }

  // Bulk remove
  const handleBulkRemove = async () => {
    setBulkRemoving(true)
    try {
      const promises = selectedNonOwnerMembers.map(m =>
        authFetch(`/api/dashboard/members/${m.id}`, { method: 'DELETE' }).then(res => {
          if (!res.ok) throw new Error('Failed')
          return m.id
        })
      )
      const results = await Promise.allSettled(promises)
      const removedIds = results
        .filter(r => r.status === 'fulfilled')
        .map(r => (r as PromiseFulfilledResult<string>).value)
      setMembers(prev => prev.filter(m => !removedIds.includes(m.id)))
      setSelectedIds(new Set())
      setBulkRemoveDialogOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove members')
    } finally {
      setBulkRemoving(false)
    }
  }

  // Toggle selection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Select all / deselect all (only non-owners in filtered list)
  const toggleSelectAll = () => {
    const nonOwners = filteredMembers.filter(m => m.role !== 'owner')
    if (selectedIds.size === nonOwners.length && nonOwners.length > 0) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(nonOwners.map(m => m.id)))
    }
  }

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const diff = Date.now() - new Date(dateStr).getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return formatDate(dateStr)
  }

  return (
    <TooltipProvider>
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

        {/* Search bar */}
        {!isLoading && members.length > 0 && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

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

        {/* Bulk action bar */}
        {selectedNonOwnerMembers.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <span className="text-sm font-medium">
              {selectedNonOwnerMembers.length} selected
            </span>
            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setBulkNewRole('viewer')
                  setBulkRoleDialogOpen(true)
                }}
              >
                <UserCog className="h-4 w-4 mr-1" />
                Change Role
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkRemoveDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Remove
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Pending Invitations */}
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
                {invitations.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                        <Mail className="h-4 w-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{inv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Invited as {inv.role} &middot; Expires {formatDate(inv.expires_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleResendInvitation(inv.id)}
                          >
                            <RotateCw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Resend invitation</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleRevokeInvitation(inv.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Revoke invitation</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
        ) : filteredMembers.length === 0 ? (
          /* No search results */
          <Card>
            <CardContent className="py-12 text-center">
              <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No results</h3>
              <p className="text-sm text-muted-foreground">
                No members match &ldquo;{searchQuery}&rdquo;
              </p>
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
                      <th className="w-10 p-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input accent-primary"
                          checked={
                            filteredMembers.filter(m => m.role !== 'owner').length > 0 &&
                            selectedIds.size === filteredMembers.filter(m => m.role !== 'owner').length
                          }
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">User</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden sm:table-cell">Email</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground">Role</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden lg:table-cell">Last Login</th>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground hidden md:table-cell">Joined</th>
                      <th className="text-right p-3 text-sm font-medium text-muted-foreground w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMembers.map(member => {
                      const roleConfig = ROLE_CONFIG[member.role]
                      const RoleIcon = roleConfig.icon
                      const isOwner = member.role === 'owner'
                      const isSelected = selectedIds.has(member.id)

                      return (
                        <tr
                          key={member.id}
                          className={`border-b last:border-0 hover:bg-muted/50 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
                        >
                          <td className="p-3">
                            {!isOwner ? (
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-input accent-primary"
                                checked={isSelected}
                                onChange={() => toggleSelect(member.id)}
                              />
                            ) : (
                              <div className="h-4 w-4" />
                            )}
                          </td>
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
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant={roleConfig.variant} className="gap-1 cursor-help">
                                  <RoleIcon className={`h-3 w-3 ${roleConfig.color}`} />
                                  {roleConfig.label}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs text-xs">{roleConfig.tooltip}</p>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="p-3 text-sm text-muted-foreground hidden lg:table-cell">
                            {formatRelativeTime(member.user.lastSignInAt)}
                          </td>
                          <td className="p-3 text-sm text-muted-foreground hidden md:table-cell">
                            {formatDate(member.created_at)}
                          </td>
                          <td className="p-3">
                            {!isOwner && (
                              <DropdownMenu>
                                <DropdownMenuTrigger>
                                  <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => {
                                    setMemberToChangeRole(member)
                                    setNewRole(member.role)
                                  }}>
                                    <UserCog className="h-4 w-4 mr-2" />
                                    Change Role
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => setMemberToRemove(member)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Remove User
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
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
            {filteredMembers.length === members.length
              ? `${members.length} user${members.length !== 1 ? 's' : ''}`
              : `${filteredMembers.length} of ${members.length} users`}
            {invitations.length > 0 && ` + ${invitations.length} pending`}
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
                    <div>
                      <span className="font-medium">{config.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{config.tooltip}</p>
                    </div>
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

        {/* Bulk Change Role Dialog */}
        <Dialog open={bulkRoleDialogOpen} onOpenChange={setBulkRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Role for {selectedNonOwnerMembers.length} Users</DialogTitle>
              <DialogDescription>
                Select a new role for all selected users.
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
                      bulkNewRole === role
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground'
                    }`}
                  >
                    <input
                      type="radio"
                      name="bulkRole"
                      value={role}
                      checked={bulkNewRole === role}
                      onChange={() => setBulkNewRole(role)}
                    />
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <div>
                      <span className="font-medium">{config.label}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{config.tooltip}</p>
                    </div>
                  </label>
                )
              })}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkRoleDialogOpen(false)} disabled={bulkChanging}>
                Cancel
              </Button>
              <Button onClick={handleBulkChangeRole} disabled={bulkChanging}>
                {bulkChanging ? 'Updating...' : `Update ${selectedNonOwnerMembers.length} Users`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bulk Remove Dialog */}
        <Dialog open={bulkRemoveDialogOpen} onOpenChange={setBulkRemoveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">Remove {selectedNonOwnerMembers.length} Users</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove {selectedNonOwnerMembers.length} users from this organization?
              </DialogDescription>
            </DialogHeader>

            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
              <p className="text-muted-foreground">
                These users will lose access to all organization resources. This action cannot be undone.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkRemoveDialogOpen(false)} disabled={bulkRemoving}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleBulkRemove} disabled={bulkRemoving}>
                {bulkRemoving ? 'Removing...' : `Remove ${selectedNonOwnerMembers.length} Users`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}

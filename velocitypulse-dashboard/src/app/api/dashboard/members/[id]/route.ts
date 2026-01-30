import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import type { MemberRole, MemberPermissions } from '@/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

// Default permissions by role
const DEFAULT_PERMISSIONS: Record<MemberRole, MemberPermissions> = {
  owner: {
    can_manage_billing: true,
    can_manage_agents: true,
    can_manage_devices: true,
    can_manage_members: true,
    can_view_audit_logs: true,
  },
  admin: {
    can_manage_billing: false,
    can_manage_agents: true,
    can_manage_devices: true,
    can_manage_members: true,
    can_view_audit_logs: true,
  },
  editor: {
    can_manage_billing: false,
    can_manage_agents: false,
    can_manage_devices: true,
    can_manage_members: false,
    can_view_audit_logs: false,
  },
  viewer: {
    can_manage_billing: false,
    can_manage_agents: false,
    can_manage_devices: false,
    can_manage_members: false,
    can_view_audit_logs: false,
  },
}

/**
 * PATCH /api/dashboard/members/[id]
 * Update a member's role or permissions
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServiceClient()

    // Get user's organization and membership
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Check permission
    const canManage = membership.role === 'owner' || membership.role === 'admin' ||
      (membership.permissions as MemberPermissions)?.can_manage_members
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to update members' }, { status: 403 })
    }

    // Verify member belongs to organization
    const { data: targetMember, error: targetError } = await supabase
      .from('organization_members')
      .select('id, user_id, role')
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .single()

    if (targetError || !targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Cannot modify owner
    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot modify owner' }, { status: 403 })
    }

    // Cannot modify yourself (use account settings)
    if (targetMember.user_id === userId) {
      return NextResponse.json({ error: 'Cannot modify your own membership' }, { status: 403 })
    }

    // Parse request body
    let body: {
      role?: MemberRole
      permissions?: Partial<MemberPermissions>
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Build update object
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.role !== undefined) {
      if (!['admin', 'editor', 'viewer'].includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
      }
      updates.role = body.role
      // Set default permissions for new role
      updates.permissions = DEFAULT_PERMISSIONS[body.role]
    }

    if (body.permissions !== undefined) {
      // Merge custom permissions
      const currentPermissions = (targetMember as { permissions?: MemberPermissions }).permissions ||
        DEFAULT_PERMISSIONS[targetMember.role as MemberRole]
      updates.permissions = {
        ...currentPermissions,
        ...body.permissions,
      }
    }

    // Update member
    const { data: member, error: updateError } = await supabase
      .from('organization_members')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Update member error:', updateError)
      return NextResponse.json({ error: 'Failed to update member' }, { status: 500 })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      actor_type: 'user',
      actor_id: userId,
      action: 'member.role_changed',
      resource_type: 'organization_member',
      resource_id: id,
      metadata: { role: member.role },
    })

    return NextResponse.json({ member })
  } catch (error) {
    console.error('Update member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/dashboard/members/[id]
 * Remove a member from the organization
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServiceClient()

    // Get user's organization and membership
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Check permission
    const canManage = membership.role === 'owner' || membership.role === 'admin' ||
      (membership.permissions as MemberPermissions)?.can_manage_members
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to remove members' }, { status: 403 })
    }

    // Get target member
    const { data: targetMember, error: targetError } = await supabase
      .from('organization_members')
      .select('id, user_id, role')
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .single()

    if (targetError || !targetMember) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Cannot remove owner
    if (targetMember.role === 'owner') {
      return NextResponse.json({ error: 'Cannot remove owner' }, { status: 403 })
    }

    // Cannot remove yourself (use leave organization)
    if (targetMember.user_id === userId) {
      return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 403 })
    }

    // Delete member
    const { error: deleteError } = await supabase
      .from('organization_members')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Delete member error:', deleteError)
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      actor_type: 'user',
      actor_id: userId,
      action: 'member.removed',
      resource_type: 'organization_member',
      resource_id: id,
      metadata: { removed_user_id: targetMember.user_id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

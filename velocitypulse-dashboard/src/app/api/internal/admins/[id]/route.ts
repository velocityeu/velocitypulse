import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/client'
import { verifyInternalAccess, hasAdminRole } from '@/lib/api/internal-auth'
import type { AdminRole } from '@/types'

/**
 * PATCH /api/internal/admins/[id]
 * Update an admin's role or status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyInternalAccess()
  if (!authResult.authorized) return authResult.error!

  // Only super_admin can modify admins
  if (!hasAdminRole(authResult.adminRole, 'super_admin')) {
    return NextResponse.json({ error: 'Only super admins can modify admin roles' }, { status: 403 })
  }

  const { id: targetUserId } = await params

  // Prevent self-demotion
  if (targetUserId === authResult.userId) {
    return NextResponse.json({ error: 'Cannot modify your own admin role' }, { status: 400 })
  }

  let body: { role?: AdminRole; is_active?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (body.role !== undefined) {
    const validRoles: AdminRole[] = ['super_admin', 'billing_admin', 'support_admin', 'viewer']
    if (!validRoles.includes(body.role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }
    updates.role = body.role
  }
  if (body.is_active !== undefined) {
    updates.is_active = body.is_active
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updates provided' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Check if admin_roles row exists, create if not
  const { data: existing } = await supabase
    .from('admin_roles')
    .select('user_id')
    .eq('user_id', targetUserId)
    .single()

  if (!existing) {
    // Create the row with defaults + updates
    const { error: insertError } = await supabase
      .from('admin_roles')
      .insert({
        user_id: targetUserId,
        role: (updates.role as AdminRole) || 'super_admin',
        is_active: updates.is_active !== undefined ? (updates.is_active as boolean) : true,
        invited_by: authResult.userId,
      })
    if (insertError) {
      console.error('Failed to create admin role:', insertError)
      return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 })
    }
  } else {
    const { error: updateError } = await supabase
      .from('admin_roles')
      .update(updates)
      .eq('user_id', targetUserId)

    if (updateError) {
      console.error('Failed to update admin role:', updateError)
      return NextResponse.json({ error: 'Failed to update admin' }, { status: 500 })
    }
  }

  // Admin audit log
  await supabase.from('admin_audit_logs').insert({
    actor_id: authResult.userId!,
    actor_email: authResult.email,
    action: 'admin.updated',
    resource_type: 'admin_role',
    resource_id: targetUserId,
    metadata: updates,
  })

  return NextResponse.json({ success: true })
}

/**
 * DELETE /api/internal/admins/[id]
 * Remove admin access from a user
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyInternalAccess()
  if (!authResult.authorized) return authResult.error!

  // Only super_admin can remove admins
  if (!hasAdminRole(authResult.adminRole, 'super_admin')) {
    return NextResponse.json({ error: 'Only super admins can remove admin access' }, { status: 403 })
  }

  const { id: targetUserId } = await params

  // Prevent self-removal
  if (targetUserId === authResult.userId) {
    return NextResponse.json({ error: 'Cannot remove your own admin access' }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Remove admin_roles row
  await supabase
    .from('admin_roles')
    .delete()
    .eq('user_id', targetUserId)

  // Set is_staff = false
  await supabase
    .from('users')
    .update({ is_staff: false })
    .eq('id', targetUserId)

  // Admin audit log
  await supabase.from('admin_audit_logs').insert({
    actor_id: authResult.userId!,
    actor_email: authResult.email,
    action: 'admin.removed',
    resource_type: 'admin_role',
    resource_id: targetUserId,
  })

  return NextResponse.json({ success: true })
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import type { MemberPermissions } from '@/types'

/**
 * DELETE /api/dashboard/invitations/[id]
 * Revoke a pending org member invitation
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServiceClient()

    // Get user's organization and check permission
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const canManage = membership.role === 'owner' || membership.role === 'admin' ||
      (membership.permissions as MemberPermissions)?.can_manage_members
    if (!canManage) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 })
    }

    // Verify the invitation belongs to this org and is pending
    const { data: invitation, error: invError } = await supabase
      .from('invitations')
      .select('id, organization_id, status, email, role')
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .eq('invitation_type', 'member')
      .single()

    if (invError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending invitations can be revoked' }, { status: 400 })
    }

    // Revoke
    await supabase
      .from('invitations')
      .update({ status: 'revoked' })
      .eq('id', id)

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      actor_type: 'user',
      actor_id: userId,
      action: 'member.invitation_revoked',
      resource_type: 'invitation',
      resource_id: id,
      metadata: { email: invitation.email, role: invitation.role },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Revoke invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

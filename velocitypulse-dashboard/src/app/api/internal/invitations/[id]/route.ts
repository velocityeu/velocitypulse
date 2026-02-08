import { NextRequest, NextResponse } from 'next/server'
import { verifyInternalAccess, hasAdminRole } from '@/lib/api/internal-auth'
import { createServiceClient } from '@/lib/db/client'

/**
 * DELETE /api/internal/invitations/[id]
 * Revoke a pending admin invitation (requires super_admin)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await verifyInternalAccess()
  if (!authResult.authorized) return authResult.error!

  if (!hasAdminRole(authResult.adminRole, 'super_admin')) {
    return NextResponse.json({ error: 'Only super admins can revoke admin invitations' }, { status: 403 })
  }

  try {
    const { id } = await params
    const supabase = createServiceClient()

    // Verify the invitation is an admin invitation and pending
    const { data: invitation, error: invError } = await supabase
      .from('invitations')
      .select('id, status, email, role')
      .eq('id', id)
      .eq('invitation_type', 'admin')
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

    // Admin audit log
    await supabase.from('admin_audit_logs').insert({
      actor_id: authResult.userId!,
      actor_email: authResult.email,
      action: 'admin.invitation_revoked',
      resource_type: 'invitation',
      resource_id: id,
      metadata: { email: invitation.email, role: invitation.role },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Revoke admin invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

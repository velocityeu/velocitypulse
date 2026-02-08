import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { isInvitationExpired } from '@/lib/invitations'
import { DEFAULT_PERMISSIONS } from '@/lib/permissions'
import type { MemberRole } from '@/types'

/**
 * POST /api/invitations/accept
 * Authenticated endpoint — accepts an invitation.
 * Body: { token: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'You must be signed in to accept an invitation' }, { status: 401 })
    }

    let body: { token: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.token || body.token.length !== 64) {
      return NextResponse.json({ error: 'Invalid invitation token' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Look up invitation
    const { data: invitation, error: invError } = await supabase
      .from('invitations')
      .select('*')
      .eq('token', body.token)
      .single()

    if (invError || !invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    if (invitation.status !== 'pending') {
      return NextResponse.json({
        error: invitation.status === 'accepted'
          ? 'This invitation has already been accepted'
          : invitation.status === 'revoked'
          ? 'This invitation has been revoked'
          : 'This invitation has expired',
      }, { status: 410 })
    }

    if (isInvitationExpired(invitation.expires_at)) {
      // Auto-expire
      await supabase
        .from('invitations')
        .update({ status: 'expired' })
        .eq('id', invitation.id)
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 })
    }

    // Verify email match
    const { data: user } = await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .single()

    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      return NextResponse.json({
        error: `This invitation was sent to a different email address. Please sign in with the account for ${invitation.email}`,
      }, { status: 403 })
    }

    let redirectUrl = '/dashboard'

    if (invitation.invitation_type === 'member') {
      // ===== Member invitation: add to organization =====

      // Check if already a member
      const { data: existing } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', invitation.organization_id)
        .eq('user_id', userId)
        .single()

      if (existing) {
        // Already a member (maybe via webhook auto-accept) — just mark invitation accepted
        await supabase
          .from('invitations')
          .update({
            status: 'accepted',
            accepted_by: userId,
            accepted_at: new Date().toISOString(),
          })
          .eq('id', invitation.id)

        return NextResponse.json({ success: true, redirectUrl })
      }

      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: invitation.organization_id,
          user_id: userId,
          role: invitation.role as MemberRole,
          permissions: DEFAULT_PERMISSIONS[invitation.role as MemberRole] || DEFAULT_PERMISSIONS.viewer,
        })

      if (memberError) {
        console.error('Failed to add member from invitation:', memberError)
        return NextResponse.json({ error: 'Failed to join organization' }, { status: 500 })
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        organization_id: invitation.organization_id,
        actor_type: 'user',
        actor_id: userId,
        action: 'member.invitation_accepted',
        resource_type: 'invitation',
        resource_id: invitation.id,
        metadata: { email: invitation.email, role: invitation.role },
      })

    } else if (invitation.invitation_type === 'admin') {
      // ===== Admin invitation: grant staff access =====

      // Check if already staff
      const { data: existingUser } = await supabase
        .from('users')
        .select('is_staff')
        .eq('id', userId)
        .single()

      if (!existingUser?.is_staff) {
        await supabase
          .from('users')
          .update({ is_staff: true })
          .eq('id', userId)
      }

      // Check for existing admin_roles entry
      const { data: existingRole } = await supabase
        .from('admin_roles')
        .select('user_id')
        .eq('user_id', userId)
        .single()

      if (!existingRole) {
        await supabase.from('admin_roles').insert({
          user_id: userId,
          role: invitation.role,
          is_active: true,
          invited_by: invitation.invited_by,
        })
      }

      // Admin audit log
      await supabase.from('admin_audit_logs').insert({
        actor_id: userId,
        action: 'admin.invitation_accepted',
        resource_type: 'invitation',
        resource_id: invitation.id,
        metadata: { email: invitation.email, role: invitation.role },
      })

      redirectUrl = '/internal'
    }

    // Mark invitation as accepted
    await supabase
      .from('invitations')
      .update({
        status: 'accepted',
        accepted_by: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', invitation.id)

    return NextResponse.json({ success: true, redirectUrl })
  } catch (error) {
    console.error('Accept invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

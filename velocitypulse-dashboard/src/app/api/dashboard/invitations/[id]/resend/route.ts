import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { generateInvitationToken, getInvitationExpiry } from '@/lib/invitations'
import { sendMemberInvitationEmail } from '@/lib/emails/lifecycle'
import { logger } from '@/lib/logger'
import type { MemberPermissions } from '@/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.velocitypulse.io'

/**
 * POST /api/dashboard/invitations/[id]/resend
 * Resend an invitation email (generates a new token + extends expiry)
 */
export async function POST(
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
      return NextResponse.json({ error: 'Only pending invitations can be resent' }, { status: 400 })
    }

    // Generate new token and extend expiry
    const newToken = generateInvitationToken()
    const newExpiry = getInvitationExpiry()

    await supabase
      .from('invitations')
      .update({
        token: newToken,
        expires_at: newExpiry.toISOString(),
      })
      .eq('id', id)

    // Get org name and inviter name
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', membership.organization_id)
      .single()

    const { data: inviter } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', userId)
      .single()

    const inviterName = inviter
      ? [inviter.first_name, inviter.last_name].filter(Boolean).join(' ') || inviter.email
      : 'A team member'

    const acceptUrl = `${APP_URL}/accept-invite?token=${newToken}`
    const sent = await sendMemberInvitationEmail(
      inviterName,
      org?.name || 'your organization',
      invitation.role,
      acceptUrl,
      invitation.email
    )

    if (!sent) {
      logger.warn('member.invitation resend email delivery failed', {
        route: 'api/dashboard/invitations/[id]/resend',
        invitationId: id,
        organizationId: membership.organization_id,
        email: invitation.email,
      })
      return NextResponse.json(
        { error: 'Invitation token refreshed but email delivery failed. Please retry.' },
        { status: 502 }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      actor_type: 'user',
      actor_id: userId,
      action: 'member.invitation_resent',
      resource_type: 'invitation',
      resource_id: id,
      metadata: { email: invitation.email, role: invitation.role },
    })

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: 'pending',
        expires_at: newExpiry.toISOString(),
      },
    })
  } catch (error) {
    console.error('Resend invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

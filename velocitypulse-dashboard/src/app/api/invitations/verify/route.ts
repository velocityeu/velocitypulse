import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/client'
import { isInvitationExpired } from '@/lib/invitations'

/**
 * GET /api/invitations/verify?token=...
 * Public endpoint — returns invitation metadata for the accept-invite page.
 * No auth required.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token || token.length !== 64) {
    return NextResponse.json({ error: 'Invalid invitation token' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: invitation, error } = await supabase
    .from('invitations')
    .select('id, email, invitation_type, organization_id, role, status, expires_at, created_at')
    .eq('token', token)
    .single()

  if (error || !invitation) {
    return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  }

  // Get org name if this is a member invitation
  let orgName: string | null = null
  if (invitation.invitation_type === 'member' && invitation.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', invitation.organization_id)
      .single()
    orgName = org?.name || null
  }

  // Mask email: show first 2 chars + domain
  const [localPart, domain] = invitation.email.split('@')
  const maskedEmail = localPart.length > 2
    ? `${localPart.slice(0, 2)}***@${domain}`
    : `${localPart[0]}***@${domain}`

  return NextResponse.json({
    invitation: {
      id: invitation.id,
      email: maskedEmail,
      type: invitation.invitation_type,
      role: invitation.role,
      status: invitation.status,
      orgName,
      expired: isInvitationExpired(invitation.expires_at),
      expiresAt: invitation.expires_at,
    },
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS } from '@/lib/constants'
import { DEFAULT_PERMISSIONS } from '@/lib/permissions'
import { generateInvitationToken, getInvitationExpiry } from '@/lib/invitations'
import { logger } from '@/lib/logger'
import {
  sendMemberInvitationEmail,
  sendMemberAddedNotificationEmail,
} from '@/lib/emails/lifecycle'
import type { MemberRole, MemberPermissions } from '@/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.velocitypulse.io'

/**
 * GET /api/dashboard/members
 * Get all members + pending invitations of the organization
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get user's organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Get all members of the organization
    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .order('created_at')

    if (membersError) {
      console.error('Failed to fetch members:', membersError)
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
    }

    // Batch-fetch user details from Supabase users table
    const userIds = (members || []).map(m => m.user_id)
    const { data: users } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, image_url, last_sign_in_at')
      .in('id', userIds)

    const userMap = new Map(
      (users || []).map((u: { id: string; email: string; first_name: string | null; last_name: string | null; image_url: string | null; last_sign_in_at: string | null }) => [u.id, u])
    )

    const membersWithUserData = (members || []).map(member => {
      const user = userMap.get(member.user_id)
      return {
        ...member,
        user: user
          ? {
              id: user.id,
              email: user.email,
              firstName: user.first_name,
              lastName: user.last_name,
              fullName: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown',
              imageUrl: user.image_url,
              lastSignInAt: user.last_sign_in_at,
            }
          : {
              id: member.user_id,
              email: 'Unknown',
              firstName: null,
              lastName: null,
              fullName: 'Unknown User',
              imageUrl: null,
              lastSignInAt: null,
            },
      }
    })

    // Also fetch pending invitations for this org
    const { data: invitations } = await supabase
      .from('invitations')
      .select('id, email, role, status, invited_by, expires_at, created_at')
      .eq('organization_id', membership.organization_id)
      .eq('invitation_type', 'member')
      .eq('status', 'pending')
      .order('created_at')

    return NextResponse.json({
      members: membersWithUserData,
      invitations: invitations || [],
    })
  } catch (error) {
    console.error('Get members error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/members
 * Invite a new member to the organization.
 * Path A: User exists in Clerk → add directly
 * Path B: User not found → create invitation + send email
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
      return NextResponse.json({ error: 'You do not have permission to invite members' }, { status: 403 })
    }

    const organizationId = membership.organization_id

    // Get organization to check limits
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, plan, user_limit')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Count existing members + pending invitations against limit
    const { count: memberCount } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    const { count: pendingInviteCount } = await supabase
      .from('invitations')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('invitation_type', 'member')
      .eq('status', 'pending')

    const limit = org.user_limit || PLAN_LIMITS[org.plan as keyof typeof PLAN_LIMITS]?.users || 5
    if (((memberCount || 0) + (pendingInviteCount || 0)) >= limit) {
      return NextResponse.json(
        { error: `User limit reached (${limit}). Upgrade your plan to add more users.` },
        { status: 403 }
      )
    }

    // Parse request body
    let body: {
      email: string
      role?: MemberRole
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.email || !body.email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    const email = body.email.trim().toLowerCase()
    const role: MemberRole = body.role || 'viewer'
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Check for existing pending invitation
    const { data: existingInvite } = await supabase
      .from('invitations')
      .select('id')
      .eq('email', email)
      .eq('organization_id', organizationId)
      .eq('invitation_type', 'member')
      .eq('status', 'pending')
      .limit(1)
      .single()

    if (existingInvite) {
      return NextResponse.json({ error: 'An invitation has already been sent to this email' }, { status: 409 })
    }

    // Check if user exists in our DB (by email)
    const { data: existingDbUser } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, image_url')
      .eq('email', email)
      .single()

    if (existingDbUser) {
      // ===== Path A: User exists → add directly =====

      // Check if already a member
      const { data: existingMember } = await supabase
        .from('organization_members')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('user_id', existingDbUser.id)
        .single()

      if (existingMember) {
        return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 409 })
      }

      // Create member
      const { data: member, error: createError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: organizationId,
          user_id: existingDbUser.id,
          role,
          permissions: DEFAULT_PERMISSIONS[role],
        })
        .select()
        .single()

      if (createError) {
        console.error('Create member error:', createError)
        return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
      }

      // Send notification email and surface degraded delivery explicitly
      const memberAddedEmailSent = await sendMemberAddedNotificationEmail(org.name, role, existingDbUser.email)
      if (!memberAddedEmailSent) {
        logger.warn('member.added_directly email delivery failed', {
          route: 'api/dashboard/members',
          organizationId,
          memberId: member.id,
          email: existingDbUser.email,
        })
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
        actor_type: 'user',
        actor_id: userId,
        action: 'member.added_directly',
        resource_type: 'organization_member',
        resource_id: member.id,
        metadata: { email, role },
      })

      return NextResponse.json({
        member: {
          ...member,
          user: {
            id: existingDbUser.id,
            email: existingDbUser.email,
            firstName: existingDbUser.first_name,
            lastName: existingDbUser.last_name,
            fullName: [existingDbUser.first_name, existingDbUser.last_name].filter(Boolean).join(' ') || 'Unknown',
            imageUrl: existingDbUser.image_url,
          },
        },
        notification_email_sent: memberAddedEmailSent,
      }, { status: 201 })
    } else {
      // ===== Path B: User not found → create invitation =====
      const token = generateInvitationToken()
      const expiresAt = getInvitationExpiry()

      const { data: invitation, error: inviteError } = await supabase
        .from('invitations')
        .insert({
          token,
          email,
          invitation_type: 'member',
          organization_id: organizationId,
          role,
          status: 'pending',
          invited_by: userId,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

      if (inviteError) {
        console.error('Create invitation error:', inviteError)
        return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
      }

      // Get inviter name for the email
      const { data: inviter } = await supabase
        .from('users')
        .select('first_name, last_name, email')
        .eq('id', userId)
        .single()

      const inviterName = inviter
        ? [inviter.first_name, inviter.last_name].filter(Boolean).join(' ') || inviter.email
        : 'A team member'

      const acceptUrl = `${APP_URL}/accept-invite?token=${token}`
      const invitationEmailSent = await sendMemberInvitationEmail(inviterName, org.name, role, acceptUrl, email)
      if (!invitationEmailSent) {
        await supabase
          .from('invitations')
          .delete()
          .eq('id', invitation.id)

        logger.warn('member.invitation email delivery failed', {
          route: 'api/dashboard/members',
          organizationId,
          invitationId: invitation.id,
          email,
        })
        return NextResponse.json(
          { error: 'Invitation created but email delivery failed. Please retry.' },
          { status: 502 }
        )
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        organization_id: organizationId,
        actor_type: 'user',
        actor_id: userId,
        action: 'member.invitation_sent',
        resource_type: 'invitation',
        resource_id: invitation.id,
        metadata: { email, role },
      })

      return NextResponse.json({
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          status: invitation.status,
          expires_at: invitation.expires_at,
          created_at: invitation.created_at,
        },
      }, { status: 201 })
    }
  } catch (error) {
    console.error('Invite member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

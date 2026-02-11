import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/client'
import { verifyInternalAccess, hasAdminRole } from '@/lib/api/internal-auth'
import { generateInvitationToken, getInvitationExpiry } from '@/lib/invitations'
import { sendAdminInvitationEmail } from '@/lib/emails/lifecycle'
import { logger } from '@/lib/logger'
import type { AdminRole } from '@/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.velocitypulse.io'

/**
 * GET /api/internal/admins
 * List all admin users with their roles + pending admin invitations
 */
export async function GET() {
  const authResult = await verifyInternalAccess()
  if (!authResult.authorized) return authResult.error!

  const supabase = createServiceClient()

  // Get all staff users from users table
  const { data: staffUsers, error: staffError } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, image_url, is_staff, last_sign_in_at, created_at')
    .eq('is_staff', true)
    .order('created_at')

  if (staffError) {
    console.error('Failed to fetch staff users:', staffError)
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
  }

  // Get admin roles for these users
  const userIds = (staffUsers || []).map(u => u.id)
  const { data: adminRoles } = await supabase
    .from('admin_roles')
    .select('*')
    .in('user_id', userIds.length > 0 ? userIds : ['__none__'])

  const roleMap = new Map(
    (adminRoles || []).map(r => [r.user_id, r])
  )

  const admins = (staffUsers || []).map(user => {
    const roleRecord = roleMap.get(user.id)
    return {
      user_id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      full_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown',
      image_url: user.image_url,
      role: roleRecord?.role || 'super_admin', // Default for staff without explicit role
      is_active: roleRecord?.is_active ?? true,
      invited_by: roleRecord?.invited_by || null,
      last_sign_in_at: user.last_sign_in_at,
      created_at: roleRecord?.created_at || user.created_at,
    }
  })

  // Also fetch pending admin invitations
  const { data: invitations } = await supabase
    .from('invitations')
    .select('id, email, role, status, invited_by, expires_at, created_at')
    .eq('invitation_type', 'admin')
    .eq('status', 'pending')
    .order('created_at')

  return NextResponse.json({
    admins,
    invitations: invitations || [],
  })
}

/**
 * POST /api/internal/admins
 * Invite a new admin user.
 * Path A: User exists in Clerk → grant staff access directly
 * Path B: User not found → create invitation + send email
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyInternalAccess()
  if (!authResult.authorized) return authResult.error!

  // Only super_admin can invite new admins
  if (!hasAdminRole(authResult.adminRole, 'super_admin')) {
    return NextResponse.json({ error: 'Only super admins can invite new admins' }, { status: 403 })
  }

  let body: { email: string; role: AdminRole }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.email || !body.email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  const validRoles: AdminRole[] = ['super_admin', 'billing_admin', 'support_admin', 'viewer']
  if (!validRoles.includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const email = body.email.trim().toLowerCase()
  const supabase = createServiceClient()

  // Check for existing pending admin invitation
  const { data: existingInvite } = await supabase
    .from('invitations')
    .select('id')
    .eq('email', email)
    .eq('invitation_type', 'admin')
    .eq('status', 'pending')
    .limit(1)
    .single()

  if (existingInvite) {
    return NextResponse.json({ error: 'An admin invitation has already been sent to this email' }, { status: 409 })
  }

  // Look up user in DB by email
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, image_url, is_staff')
    .eq('email', email)
    .single()

  if (existingUser) {
    // ===== Path A: User exists → grant staff directly =====

    if (existingUser.is_staff) {
      return NextResponse.json({ error: 'User is already an admin' }, { status: 409 })
    }

    // Set is_staff = true
    await supabase
      .from('users')
      .update({ is_staff: true })
      .eq('id', existingUser.id)

    // Create admin_roles row
    const { error: roleError } = await supabase
      .from('admin_roles')
      .insert({
        user_id: existingUser.id,
        role: body.role,
        is_active: true,
        invited_by: authResult.userId,
      })

    if (roleError) {
      console.error('Failed to create admin role:', roleError)
      return NextResponse.json({ error: 'Failed to create admin role' }, { status: 500 })
    }

    // Admin audit log
    await supabase.from('admin_audit_logs').insert({
      actor_id: authResult.userId!,
      actor_email: authResult.email,
      action: 'admin.invited',
      resource_type: 'admin_role',
      resource_id: existingUser.id,
      metadata: { email, role: body.role },
    })

    return NextResponse.json({
      admin: {
        user_id: existingUser.id,
        email: existingUser.email,
        first_name: existingUser.first_name,
        last_name: existingUser.last_name,
        full_name: [existingUser.first_name, existingUser.last_name].filter(Boolean).join(' ') || 'Unknown',
        image_url: existingUser.image_url,
        role: body.role,
        is_active: true,
        invited_by: authResult.userId,
        last_sign_in_at: null,
        created_at: new Date().toISOString(),
      },
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
        invitation_type: 'admin',
        organization_id: null,
        role: body.role,
        status: 'pending',
        invited_by: authResult.userId!,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single()

    if (inviteError) {
      console.error('Create admin invitation error:', inviteError)
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 })
    }

    // Get inviter name
    const { data: inviter } = await supabase
      .from('users')
      .select('first_name, last_name, email')
      .eq('id', authResult.userId!)
      .single()

    const inviterName = inviter
      ? [inviter.first_name, inviter.last_name].filter(Boolean).join(' ') || inviter.email
      : 'A VelocityPulse admin'

    const roleLabel = validRoles.includes(body.role)
      ? body.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      : body.role

    const acceptUrl = `${APP_URL}/accept-invite?token=${token}`
    const sent = await sendAdminInvitationEmail(inviterName, roleLabel, acceptUrl, email)
    if (!sent) {
      await supabase
        .from('invitations')
        .delete()
        .eq('id', invitation.id)

      logger.warn('admin.invitation email delivery failed', {
        route: 'api/internal/admins',
        invitationId: invitation.id,
        email,
      })

      return NextResponse.json(
        { error: 'Invitation created but email delivery failed. Please retry.' },
        { status: 502 }
      )
    }

    // Admin audit log
    await supabase.from('admin_audit_logs').insert({
      actor_id: authResult.userId!,
      actor_email: authResult.email,
      action: 'admin.invitation_sent',
      resource_type: 'invitation',
      resource_id: invitation.id,
      metadata: { email, role: body.role },
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
}

import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import * as Sentry from '@sentry/nextjs'
import { createServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { DEFAULT_PERMISSIONS } from '@/lib/permissions'
import { isInvitationExpired } from '@/lib/invitations'
import type { MemberRole } from '@/types'

export const runtime = 'nodejs'

interface ClerkWebhookEvent {
  type: string
  data: {
    id: string
    email_addresses?: Array<{
      email_address: string
      id: string
    }>
    first_name?: string | null
    last_name?: string | null
    image_url?: string | null
    public_metadata?: {
      role?: string
    }
    // session.created fields
    user_id?: string
  }
}

function getWebhookSecret(): string {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    throw new Error('CLERK_WEBHOOK_SECRET is not configured')
  }
  return secret
}

export async function POST(request: Request) {
  const body = await request.text()
  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing svix headers' }, { status: 400 })
  }

  let event: ClerkWebhookEvent
  try {
    const wh = new Webhook(getWebhookSecret())
    event = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent
  } catch (err) {
    logger.error('Clerk webhook signature verification failed', err, {
      route: 'api/webhook/clerk',
    })
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'user.created':
      case 'user.updated': {
        const { id, email_addresses, first_name, last_name, image_url, public_metadata } = event.data
        const primaryEmail = email_addresses?.[0]?.email_address
        if (!primaryEmail) {
          logger.warn('Clerk webhook: user has no email', { userId: id, route: 'api/webhook/clerk' })
          break
        }

        const isStaff = public_metadata?.role === 'staff' || public_metadata?.role === 'admin'

        const { error } = await supabase
          .from('users')
          .upsert({
            id,
            email: primaryEmail,
            first_name: first_name ?? null,
            last_name: last_name ?? null,
            image_url: image_url ?? null,
            is_staff: isStaff,
          }, { onConflict: 'id' })

        if (error) {
          logger.error('Failed to upsert user', error, { userId: id, route: 'api/webhook/clerk' })
          return NextResponse.json({ error: 'Failed to upsert user' }, { status: 500 })
        }

        // Auto-fulfill pending invitations for this email (on user.created)
        if (event.type === 'user.created') {
          await autoFulfillInvitations(supabase, id, primaryEmail)
        }

        break
      }

      case 'user.deleted': {
        const { id } = event.data

        // Remove organization memberships
        await supabase
          .from('organization_members')
          .delete()
          .eq('user_id', id)

        // Remove user record
        const { error } = await supabase
          .from('users')
          .delete()
          .eq('id', id)

        if (error) {
          logger.error('Failed to delete user', error, { userId: id, route: 'api/webhook/clerk' })
          return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
        }

        break
      }

      case 'session.created': {
        const sessionUserId = event.data.user_id
        if (sessionUserId) {
          await supabase
            .from('users')
            .update({ last_sign_in_at: new Date().toISOString() })
            .eq('id', sessionUserId)
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Clerk webhook handler error', error, { route: 'api/webhook/clerk' })
    Sentry.captureException(error, { tags: { route: 'api/webhook/clerk' } })
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

/**
 * Auto-fulfill pending invitations when a new user signs up.
 * This handles the case where someone was invited before they had an account.
 */
async function autoFulfillInvitations(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  email: string
) {
  try {
    const { data: pendingInvitations } = await supabase
      .from('invitations')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')

    if (!pendingInvitations || pendingInvitations.length === 0) return

    for (const invitation of pendingInvitations) {
      // Skip expired invitations
      if (isInvitationExpired(invitation.expires_at)) {
        await supabase
          .from('invitations')
          .update({ status: 'expired' })
          .eq('id', invitation.id)
        continue
      }

      if (invitation.invitation_type === 'member' && invitation.organization_id) {
        // Check if already a member (shouldn't happen for new user, but be safe)
        const { data: existing } = await supabase
          .from('organization_members')
          .select('id')
          .eq('organization_id', invitation.organization_id)
          .eq('user_id', userId)
          .single()

        if (!existing) {
          const role = invitation.role as MemberRole
          await supabase.from('organization_members').insert({
            organization_id: invitation.organization_id,
            user_id: userId,
            role,
            permissions: DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.viewer,
          })

          // Audit log
          await supabase.from('audit_logs').insert({
            organization_id: invitation.organization_id,
            actor_type: 'system',
            actor_id: 'clerk-webhook',
            action: 'member.invitation_accepted',
            resource_type: 'invitation',
            resource_id: invitation.id,
            metadata: { email, role: invitation.role, auto_fulfilled: true },
          })
        }
      } else if (invitation.invitation_type === 'admin') {
        // Grant staff access
        await supabase
          .from('users')
          .update({ is_staff: true })
          .eq('id', userId)

        // Create admin_roles row
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
          metadata: { email, role: invitation.role, auto_fulfilled: true },
        })
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
    }
  } catch (err) {
    // Non-fatal — log but don't fail the webhook
    logger.error('Failed to auto-fulfill invitations', err, {
      userId,
      email,
      route: 'api/webhook/clerk',
    })
  }
}

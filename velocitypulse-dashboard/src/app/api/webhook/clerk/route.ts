import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import { createServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/logger'

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
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error('Clerk webhook handler error', error, { route: 'api/webhook/clerk' })
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

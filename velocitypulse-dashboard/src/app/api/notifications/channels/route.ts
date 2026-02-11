import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { getOrganizationForUser } from '@/lib/api/organization'
import { validateNotificationChannelConfig } from '@/lib/notifications/channel-validation'
import type { NotificationChannelType } from '@/types'

export const dynamic = 'force-dynamic'

// GET /api/notifications/channels - List all notification channels
export async function GET(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const org = await getOrganizationForUser(userId, request.headers.get('x-organization-id'))
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const supabase = createServiceClient()

    const { data: channels, error } = await supabase
      .from('notification_channels')
      .select('*')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[NotificationChannels] Error fetching:', error)
      return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
    }

    return NextResponse.json({ channels })
  } catch (error) {
    console.error('[NotificationChannels] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/notifications/channels - Create a new notification channel
export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const org = await getOrganizationForUser(userId, request.headers.get('x-organization-id'))
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    let body: { name?: string; channel_type?: NotificationChannelType; config?: unknown }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { name, channel_type, config } = body

    if (!name || !channel_type || !config) {
      return NextResponse.json(
        { error: 'name, channel_type, and config are required' },
        { status: 400 }
      )
    }

    if (!['email', 'slack', 'teams', 'webhook'].includes(channel_type)) {
      return NextResponse.json({ error: 'Invalid channel_type' }, { status: 400 })
    }

    const normalizedName = name.trim()
    if (normalizedName.length === 0 || normalizedName.length > 120) {
      return NextResponse.json({ error: 'name must be between 1 and 120 characters' }, { status: 400 })
    }

    const validatedConfig = validateNotificationChannelConfig(channel_type, config)
    if (!validatedConfig.success) {
      return NextResponse.json(validatedConfig.error, { status: 400 })
    }

    const supabase = createServiceClient()

    const { data: channel, error } = await supabase
      .from('notification_channels')
      .insert({
        organization_id: org.id,
        name: normalizedName,
        channel_type,
        config: validatedConfig.data,
        is_enabled: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[NotificationChannels] Error creating:', error)
      return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 })
    }

    // Audit log (fire-and-forget)
    supabase.from('audit_logs').insert({
      organization_id: org.id,
      actor_type: 'user',
      actor_id: userId,
      action: 'notification_channel.created',
      resource_type: 'notification_channel',
      resource_id: channel.id,
      metadata: { name: channel.name, channel_type },
    }).then(({ error: auditError }) => {
      if (auditError) console.error('[Audit] notification_channel.created failed:', auditError)
    })

    return NextResponse.json({ channel }, { status: 201 })
  } catch (error) {
    console.error('[NotificationChannels] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

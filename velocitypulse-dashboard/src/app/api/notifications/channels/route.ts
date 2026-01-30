import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { getOrganizationForUser } from '@/lib/api/organization'

export const dynamic = 'force-dynamic'

// GET /api/notifications/channels - List all notification channels
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const org = await getOrganizationForUser(userId)
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

    const org = await getOrganizationForUser(userId)
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, channel_type, config } = body

    if (!name || !channel_type || !config) {
      return NextResponse.json(
        { error: 'name, channel_type, and config are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { data: channel, error } = await supabase
      .from('notification_channels')
      .insert({
        organization_id: org.id,
        name,
        channel_type,
        config,
        is_enabled: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[NotificationChannels] Error creating:', error)
      return NextResponse.json({ error: 'Failed to create channel' }, { status: 500 })
    }

    return NextResponse.json({ channel }, { status: 201 })
  } catch (error) {
    console.error('[NotificationChannels] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

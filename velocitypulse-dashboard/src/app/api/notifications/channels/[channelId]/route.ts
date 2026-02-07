import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { getOrganizationForUser } from '@/lib/api/organization'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ channelId: string }>
}

// GET /api/notifications/channels/[channelId] - Get a single channel
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { channelId } = await params
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const org = await getOrganizationForUser(userId)
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const supabase = createServiceClient()

    const { data: channel, error } = await supabase
      .from('notification_channels')
      .select('*')
      .eq('id', channelId)
      .eq('organization_id', org.id)
      .single()

    if (error || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    return NextResponse.json({ channel })
  } catch (error) {
    console.error('[NotificationChannel] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/notifications/channels/[channelId] - Update a channel
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { channelId } = await params
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const org = await getOrganizationForUser(userId)
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, config, is_enabled } = body

    const supabase = createServiceClient()

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (config !== undefined) updateData.config = config
    if (is_enabled !== undefined) updateData.is_enabled = is_enabled

    const { data: channel, error } = await supabase
      .from('notification_channels')
      .update(updateData)
      .eq('id', channelId)
      .eq('organization_id', org.id)
      .select()
      .single()

    if (error) {
      console.error('[NotificationChannel] Error updating:', error)
      return NextResponse.json({ error: 'Failed to update channel' }, { status: 500 })
    }

    // Audit log (fire-and-forget)
    supabase.from('audit_logs').insert({
      organization_id: org.id,
      actor_type: 'user',
      actor_id: userId,
      action: 'notification_channel.updated',
      resource_type: 'notification_channel',
      resource_id: channelId,
      metadata: { name: channel.name },
    }).then(({ error: auditError }) => {
      if (auditError) console.error('[Audit] notification_channel.updated failed:', auditError)
    })

    return NextResponse.json({ channel })
  } catch (error) {
    console.error('[NotificationChannel] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/notifications/channels/[channelId] - Delete a channel
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { channelId } = await params
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const org = await getOrganizationForUser(userId)
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('notification_channels')
      .delete()
      .eq('id', channelId)
      .eq('organization_id', org.id)

    if (error) {
      console.error('[NotificationChannel] Error deleting:', error)
      return NextResponse.json({ error: 'Failed to delete channel' }, { status: 500 })
    }

    // Audit log (fire-and-forget)
    supabase.from('audit_logs').insert({
      organization_id: org.id,
      actor_type: 'user',
      actor_id: userId,
      action: 'notification_channel.deleted',
      resource_type: 'notification_channel',
      resource_id: channelId,
    }).then(({ error: auditError }) => {
      if (auditError) console.error('[Audit] notification_channel.deleted failed:', auditError)
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[NotificationChannel] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

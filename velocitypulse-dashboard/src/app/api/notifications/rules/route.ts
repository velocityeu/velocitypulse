import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { getOrganizationForUser } from '@/lib/api/organization'

export const dynamic = 'force-dynamic'

// GET /api/notifications/rules - List all notification rules
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

    const { data: rules, error } = await supabase
      .from('notification_rules')
      .select('*')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[NotificationRules] Error fetching:', error)
      return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
    }

    return NextResponse.json({ rules })
  } catch (error) {
    console.error('[NotificationRules] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/notifications/rules - Create a new notification rule
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
    const { name, description, event_type, channel_ids, filters, cooldown_minutes } = body

    if (!name || !event_type || !channel_ids || channel_ids.length === 0) {
      return NextResponse.json(
        { error: 'name, event_type, and channel_ids are required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    const { data: rule, error } = await supabase
      .from('notification_rules')
      .insert({
        organization_id: org.id,
        name,
        description,
        event_type,
        channel_ids,
        filters: filters || {},
        cooldown_minutes: cooldown_minutes || 5,
        is_enabled: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[NotificationRules] Error creating:', error)
      return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
    }

    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    console.error('[NotificationRules] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

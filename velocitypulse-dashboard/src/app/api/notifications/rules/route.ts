import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { getOrganizationForUser } from '@/lib/api/organization'
import { validateRequest, createNotificationRuleSchema } from '@/lib/validations'

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

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validation = validateRequest(createNotificationRuleSchema, rawBody)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }
    const data = validation.data

    const supabase = createServiceClient()

    const { data: rule, error } = await supabase
      .from('notification_rules')
      .insert({
        organization_id: org.id,
        name: data.name,
        description: data.description,
        event_type: data.event_type,
        channel_ids: data.channel_ids,
        filters: data.filters || {},
        cooldown_minutes: data.cooldown_minutes,
        is_enabled: data.is_enabled,
      })
      .select()
      .single()

    if (error) {
      console.error('[NotificationRules] Error creating:', error)
      return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
    }

    // Audit log (fire-and-forget)
    supabase.from('audit_logs').insert({
      organization_id: org.id,
      actor_type: 'user',
      actor_id: userId,
      action: 'notification_rule.created',
      resource_type: 'notification_rule',
      resource_id: rule.id,
      metadata: { name: rule.name, event_type: rule.event_type },
    }).then(({ error: auditError }) => {
      if (auditError) console.error('[Audit] notification_rule.created failed:', auditError)
    })

    return NextResponse.json({ rule }, { status: 201 })
  } catch (error) {
    console.error('[NotificationRules] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

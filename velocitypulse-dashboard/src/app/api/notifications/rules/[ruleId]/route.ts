import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { getOrganizationForUser } from '@/lib/api/organization'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ ruleId: string }>
}

// GET /api/notifications/rules/[ruleId] - Get a single rule
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { ruleId } = await params
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const org = await getOrganizationForUser(userId, request.headers.get('x-organization-id'))
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const supabase = createServiceClient()

    const { data: rule, error } = await supabase
      .from('notification_rules')
      .select('*')
      .eq('id', ruleId)
      .eq('organization_id', org.id)
      .single()

    if (error || !rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('[NotificationRule] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/notifications/rules/[ruleId] - Update a rule
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { ruleId } = await params
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const org = await getOrganizationForUser(userId, request.headers.get('x-organization-id'))
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const body = await request.json()
    const { name, description, event_type, channel_ids, filters, cooldown_minutes, is_enabled } = body

    const supabase = createServiceClient()

    const updateData: Record<string, unknown> = {}
    if (name !== undefined) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (event_type !== undefined) updateData.event_type = event_type
    if (channel_ids !== undefined) updateData.channel_ids = channel_ids
    if (filters !== undefined) updateData.filters = filters
    if (cooldown_minutes !== undefined) updateData.cooldown_minutes = cooldown_minutes
    if (is_enabled !== undefined) updateData.is_enabled = is_enabled

    const { data: rule, error } = await supabase
      .from('notification_rules')
      .update(updateData)
      .eq('id', ruleId)
      .eq('organization_id', org.id)
      .select()
      .single()

    if (error) {
      console.error('[NotificationRule] Error updating:', error)
      return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
    }

    // Audit log (fire-and-forget)
    supabase.from('audit_logs').insert({
      organization_id: org.id,
      actor_type: 'user',
      actor_id: userId,
      action: 'notification_rule.updated',
      resource_type: 'notification_rule',
      resource_id: ruleId,
      metadata: { name: rule.name },
    }).then(({ error: auditError }) => {
      if (auditError) console.error('[Audit] notification_rule.updated failed:', auditError)
    })

    return NextResponse.json({ rule })
  } catch (error) {
    console.error('[NotificationRule] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/notifications/rules/[ruleId] - Delete a rule
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { ruleId } = await params
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const org = await getOrganizationForUser(userId, request.headers.get('x-organization-id'))
    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const supabase = createServiceClient()

    const { error } = await supabase
      .from('notification_rules')
      .delete()
      .eq('id', ruleId)
      .eq('organization_id', org.id)

    if (error) {
      console.error('[NotificationRule] Error deleting:', error)
      return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 })
    }

    // Audit log (fire-and-forget)
    supabase.from('audit_logs').insert({
      organization_id: org.id,
      actor_type: 'user',
      actor_id: userId,
      action: 'notification_rule.deleted',
      resource_type: 'notification_rule',
      resource_id: ruleId,
    }).then(({ error: auditError }) => {
      if (auditError) console.error('[Audit] notification_rule.deleted failed:', auditError)
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[NotificationRule] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

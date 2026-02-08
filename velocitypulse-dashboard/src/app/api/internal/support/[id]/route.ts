import { NextRequest, NextResponse } from 'next/server'
import { verifyInternalAccess } from '@/lib/api/internal-auth'
import { createServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/logger'

/**
 * GET /api/internal/support/[id]
 * Get a single ticket with all comments (including internal notes)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await verifyInternalAccess()
  if (!access.authorized) return access.error!

  const { id } = await params

  try {
    const supabase = createServiceClient()

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select(`
        *,
        organizations (id, name, customer_number, slug, plan, status)
      `)
      .eq('id', id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Get ALL comments (including internal)
    const { data: comments } = await supabase
      .from('ticket_comments')
      .select('*')
      .eq('ticket_id', id)
      .order('created_at', { ascending: true })

    // Resolve author names
    const authorIds = [...new Set([
      ticket.created_by,
      ...(ticket.assigned_to ? [ticket.assigned_to] : []),
      ...(comments || []).map(c => c.author_id),
    ])]

    const authorMap: Record<string, { email: string; first_name: string | null; last_name: string | null }> = {}
    if (authorIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, first_name, last_name')
        .in('id', authorIds)

      if (users) {
        for (const u of users) {
          authorMap[u.id] = { email: u.email, first_name: u.first_name, last_name: u.last_name }
        }
      }
    }

    // Get list of admin users for assignment dropdown
    const { data: admins } = await supabase
      .from('users')
      .select('id, email, first_name, last_name')
      .eq('is_staff', true)

    return NextResponse.json({
      ticket: {
        ...ticket,
        organization: ticket.organizations,
        creator: authorMap[ticket.created_by] || null,
        assignee: ticket.assigned_to ? (authorMap[ticket.assigned_to] || null) : null,
      },
      comments: (comments || []).map(c => ({
        ...c,
        author: authorMap[c.author_id] || null,
      })),
      admins: (admins || []).map(a => ({
        id: a.id,
        email: a.email,
        name: `${a.first_name || ''} ${a.last_name || ''}`.trim() || a.email,
      })),
    })
  } catch (error) {
    logger.error('Admin ticket detail error', error, { route: 'api/internal/support/[id]' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/internal/support/[id]
 * Update ticket (status, priority, assignment)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await verifyInternalAccess()
  if (!access.authorized) return access.error!

  const { id } = await params

  try {
    const supabase = createServiceClient()
    const body = await request.json()

    const updates: Record<string, unknown> = {}

    if (body.status) {
      const valid = ['open', 'in_progress', 'resolved', 'closed']
      if (valid.includes(body.status)) updates.status = body.status
    }
    if (body.priority) {
      const valid = ['low', 'normal', 'high', 'urgent']
      if (valid.includes(body.priority)) updates.priority = body.priority
    }
    if (body.assigned_to !== undefined) {
      updates.assigned_to = body.assigned_to || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid updates' }, { status: 400 })
    }

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      logger.error('Failed to update ticket', error, { route: 'api/internal/support/[id]' })
      return NextResponse.json({ error: 'Failed to update ticket' }, { status: 500 })
    }

    return NextResponse.json({ ticket })
  } catch (error) {
    logger.error('Admin ticket update error', error, { route: 'api/internal/support/[id]' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

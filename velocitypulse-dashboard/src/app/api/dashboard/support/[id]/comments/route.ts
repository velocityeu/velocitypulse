import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/logger'

/**
 * POST /api/dashboard/support/[id]/comments
 * Add a comment to a support ticket (user-facing, never internal)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServiceClient()

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Verify ticket belongs to user's org
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id, status')
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .single()

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    if (ticket.status === 'closed') {
      return NextResponse.json({ error: 'Cannot comment on a closed ticket' }, { status: 400 })
    }

    const body = await request.json()
    const { content } = body

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    const { data: comment, error } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: id,
        author_id: userId,
        author_type: 'user',
        content: content.trim(),
        is_internal: false,
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to create ticket comment', error, { route: 'api/dashboard/support/[id]/comments' })
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
    }

    // Reopen ticket if it was resolved (user replied)
    if (ticket.status === 'resolved') {
      await supabase
        .from('support_tickets')
        .update({ status: 'open' })
        .eq('id', id)
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    logger.error('Ticket comment error', error, { route: 'api/dashboard/support/[id]/comments' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

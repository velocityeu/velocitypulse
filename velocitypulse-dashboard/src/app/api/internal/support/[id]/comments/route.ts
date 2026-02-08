import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { verifyInternalAccess } from '@/lib/api/internal-auth'
import { createServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/logger'

/**
 * POST /api/internal/support/[id]/comments
 * Add admin comment (can be internal note or public reply)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const access = await verifyInternalAccess()
  if (!access.authorized) return access.error!

  const { id } = await params
  const { userId } = await auth()

  try {
    const supabase = createServiceClient()
    const body = await request.json()
    const { content, is_internal } = body

    if (!content || !content.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // Verify ticket exists
    const { data: ticket } = await supabase
      .from('support_tickets')
      .select('id, status')
      .eq('id', id)
      .single()

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    const { data: comment, error } = await supabase
      .from('ticket_comments')
      .insert({
        ticket_id: id,
        author_id: userId,
        author_type: 'admin',
        content: content.trim(),
        is_internal: !!is_internal,
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to create admin comment', error, { route: 'api/internal/support/[id]/comments' })
      return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
    }

    // Auto-set ticket to in_progress if it was open
    if (ticket.status === 'open') {
      await supabase
        .from('support_tickets')
        .update({ status: 'in_progress' })
        .eq('id', id)
    }

    return NextResponse.json({ comment }, { status: 201 })
  } catch (error) {
    logger.error('Admin comment error', error, { route: 'api/internal/support/[id]/comments' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

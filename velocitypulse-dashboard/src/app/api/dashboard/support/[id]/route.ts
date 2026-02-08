import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/logger'

/**
 * GET /api/dashboard/support/[id]
 * Get a single support ticket with comments (non-internal only)
 */
export async function GET(
  _request: Request,
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

    // Get ticket (verify it belongs to the user's org)
    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }

    // Get comments (exclude internal admin notes)
    const { data: comments } = await supabase
      .from('ticket_comments')
      .select('*')
      .eq('ticket_id', id)
      .eq('is_internal', false)
      .order('created_at', { ascending: true })

    // Resolve author names from users table
    const authorIds = [...new Set((comments || []).map(c => c.author_id))]
    let authorMap: Record<string, { email: string; first_name: string | null; last_name: string | null }> = {}

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

    const commentsWithAuthors = (comments || []).map(c => ({
      ...c,
      author: authorMap[c.author_id] || null,
    }))

    return NextResponse.json({ ticket, comments: commentsWithAuthors })
  } catch (error) {
    logger.error('Support ticket detail error', error, { route: 'api/dashboard/support/[id]' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

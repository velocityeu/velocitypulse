import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/logger'

/**
 * GET /api/dashboard/support
 * List support tickets for the user's organization
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const { data: tickets, error } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Failed to fetch support tickets', error, { route: 'api/dashboard/support' })
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
    }

    // Get comment counts per ticket
    const ticketIds = (tickets || []).map(t => t.id)
    let commentCounts: Record<string, number> = {}
    if (ticketIds.length > 0) {
      const { data: counts } = await supabase
        .rpc('get_ticket_comment_counts', { ticket_ids: ticketIds })

      if (counts) {
        for (const c of counts) {
          commentCounts[c.ticket_id] = c.count
        }
      }
    }

    // Fallback: if RPC doesn't exist, count manually
    if (Object.keys(commentCounts).length === 0 && ticketIds.length > 0) {
      for (const tid of ticketIds) {
        const { count } = await supabase
          .from('ticket_comments')
          .select('*', { count: 'exact', head: true })
          .eq('ticket_id', tid)
          .eq('is_internal', false)
        commentCounts[tid] = count || 0
      }
    }

    const ticketsWithCounts = (tickets || []).map(t => ({
      ...t,
      comment_count: commentCounts[t.id] || 0,
    }))

    return NextResponse.json({ tickets: ticketsWithCounts })
  } catch (error) {
    logger.error('Support tickets error', error, { route: 'api/dashboard/support' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/support
 * Create a new support ticket
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    const body = await request.json()
    const { subject, description, category, priority } = body

    if (!subject || !description) {
      return NextResponse.json({ error: 'Subject and description are required' }, { status: 400 })
    }

    const validCategories = ['billing', 'subscription', 'technical', 'other']
    const validPriorities = ['low', 'normal', 'high', 'urgent']

    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        organization_id: membership.organization_id,
        created_by: userId,
        subject: subject.trim(),
        description: description.trim(),
        category: validCategories.includes(category) ? category : 'other',
        priority: validPriorities.includes(priority) ? priority : 'normal',
      })
      .select()
      .single()

    if (error) {
      logger.error('Failed to create support ticket', error, { route: 'api/dashboard/support' })
      return NextResponse.json({ error: 'Failed to create ticket' }, { status: 500 })
    }

    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    logger.error('Create support ticket error', error, { route: 'api/dashboard/support' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

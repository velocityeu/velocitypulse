import { NextRequest, NextResponse } from 'next/server'
import { verifyInternalAccess } from '@/lib/api/internal-auth'
import { createServiceClient } from '@/lib/db/client'
import { logger } from '@/lib/logger'

/**
 * GET /api/internal/support
 * List all support tickets across all organizations (admin view)
 */
export async function GET(request: NextRequest) {
  const access = await verifyInternalAccess()
  if (!access.authorized) return access.error!

  try {
    const supabase = createServiceClient()
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status')
    const priority = searchParams.get('priority')
    const category = searchParams.get('category')

    let query = supabase
      .from('support_tickets')
      .select(`
        *,
        organizations (id, name, customer_number, slug)
      `)
      .order('created_at', { ascending: false })
      .limit(200)

    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    if (priority && priority !== 'all') {
      query = query.eq('priority', priority)
    }
    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    const { data: tickets, error } = await query

    if (error) {
      logger.error('Failed to fetch admin support tickets', error, { route: 'api/internal/support' })
      return NextResponse.json({ error: 'Failed to fetch tickets' }, { status: 500 })
    }

    // Get comment counts
    const ticketIds = (tickets || []).map(t => t.id)
    const commentCounts: Record<string, number> = {}

    if (ticketIds.length > 0) {
      // Count comments per ticket
      for (const tid of ticketIds) {
        const { count } = await supabase
          .from('ticket_comments')
          .select('*', { count: 'exact', head: true })
          .eq('ticket_id', tid)
        commentCounts[tid] = count || 0
      }
    }

    // Resolve creator/assignee names
    const userIds = [...new Set([
      ...(tickets || []).map(t => t.created_by),
      ...(tickets || []).map(t => t.assigned_to).filter(Boolean),
    ])]

    const authorMap: Record<string, { email: string; first_name: string | null; last_name: string | null }> = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, email, first_name, last_name')
        .in('id', userIds)

      if (users) {
        for (const u of users) {
          authorMap[u.id] = { email: u.email, first_name: u.first_name, last_name: u.last_name }
        }
      }
    }

    const enriched = (tickets || []).map(t => ({
      ...t,
      organization: t.organizations,
      creator: authorMap[t.created_by] || null,
      assignee: t.assigned_to ? (authorMap[t.assigned_to] || null) : null,
      comment_count: commentCounts[t.id] || 0,
    }))

    // Compute summary stats
    const all = enriched
    const stats = {
      total: all.length,
      open: all.filter(t => t.status === 'open').length,
      in_progress: all.filter(t => t.status === 'in_progress').length,
      resolved: all.filter(t => t.status === 'resolved').length,
      closed: all.filter(t => t.status === 'closed').length,
      urgent: all.filter(t => t.priority === 'urgent' && t.status !== 'closed' && t.status !== 'resolved').length,
    }

    return NextResponse.json({ tickets: enriched, stats })
  } catch (error) {
    logger.error('Admin support error', error, { route: 'api/internal/support' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

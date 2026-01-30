import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { AGENT_ONLINE_THRESHOLD_MS } from '@/lib/constants'

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get user's organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const organizationId = membership.organization_id

    // Query agents for this organization with segments
    const { data: agents, error: agentsError } = await supabase
      .from('agents')
      .select(`
        *,
        network_segments(*)
      `)
      .eq('organization_id', organizationId)
      .order('name')

    if (agentsError) {
      console.error('Failed to fetch agents:', agentsError)
      return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
    }

    // Calculate online status for each agent
    const now = Date.now()
    const agentsWithStatus = (agents || []).map(agent => ({
      ...agent,
      is_online: agent.last_seen_at
        ? (now - new Date(agent.last_seen_at).getTime()) < AGENT_ONLINE_THRESHOLD_MS
        : false,
    }))

    return NextResponse.json({ agents: agentsWithStatus })
  } catch (error) {
    console.error('Dashboard agents error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

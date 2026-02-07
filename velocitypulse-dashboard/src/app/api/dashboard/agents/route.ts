import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { AGENT_ONLINE_THRESHOLD_MS, PLAN_LIMITS } from '@/lib/constants'
import { generateApiKey } from '@/lib/api/agent-auth'
import { logger } from '@/lib/logger'
import { validateRequest, createAgentSchema } from '@/lib/validations'

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
      logger.error('Failed to fetch agents', agentsError, { route: 'api/dashboard/agents' })
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
    logger.error('Dashboard agents error', error, { route: 'api/dashboard/agents' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/agents
 * Create a new agent for the user's organization
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get user's organization and membership
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Check permission
    const canManage = membership.role === 'owner' || membership.role === 'admin' ||
      (membership.permissions as { can_manage_agents?: boolean })?.can_manage_agents
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to create agents' }, { status: 403 })
    }

    const organizationId = membership.organization_id

    // Get organization to check limits and get slug for API key generation
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('plan, agent_limit, slug')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Count existing agents
    const { count: agentCount } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    const limit = org.agent_limit || PLAN_LIMITS[org.plan as keyof typeof PLAN_LIMITS]?.agents || 10
    if ((agentCount || 0) >= limit) {
      return NextResponse.json(
        { error: `Agent limit reached (${limit}). Upgrade your plan to add more agents.` },
        { status: 403 }
      )
    }

    // Parse and validate request body
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validation = validateRequest(createAgentSchema, rawBody)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }
    const body = validation.data

    // Generate API key with hash for secure storage
    const { apiKey, apiKeyHash, apiKeyPrefix } = generateApiKey(org.slug)

    // Create agent with hashed API key
    const { data: agent, error: createError } = await supabase
      .from('agents')
      .insert({
        organization_id: organizationId,
        name: body.name.trim(),
        description: body.description || null,
        api_key_hash: apiKeyHash,
        api_key_prefix: apiKeyPrefix,
        is_enabled: true,
      })
      .select()
      .single()

    if (createError) {
      logger.error('Create agent error', createError, { route: 'api/dashboard/agents' })
      return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: organizationId,
      actor_type: 'user',
      actor_id: userId,
      action: 'agent.created',
      resource_type: 'agent',
      resource_id: agent.id,
      metadata: { name: agent.name },
    })

    // Return agent with full API key (only shown once)
    return NextResponse.json({
      agent: {
        ...agent,
        api_key: apiKey, // Full key only returned on creation
      },
    }, { status: 201 })
  } catch (error) {
    logger.error('Create agent error', error, { route: 'api/dashboard/agents' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

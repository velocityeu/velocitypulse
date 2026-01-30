import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { authenticateUser, canManageAgents } from '@/lib/api/user-auth'
import { isValidCidr, validateNoOverlap } from '@/lib/utils/cidr'

export const dynamic = 'force-dynamic'

/**
 * GET /api/segments
 * List all network segments for the user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Get optional agent_id filter from query params
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agent_id')

    let query = supabase
      .from('network_segments')
      .select(`
        *,
        agent:agents (id, name, is_online:last_seen_at)
      `)
      .eq('organization_id', membership.organization_id)
      .order('created_at')

    if (agentId) {
      query = query.eq('agent_id', agentId)
    }

    const { data: segments, error } = await query

    if (error) {
      console.error('Get segments error:', error)
      return NextResponse.json(
        { error: 'Failed to get segments' },
        { status: 500 }
      )
    }

    return NextResponse.json(segments || [])
  } catch (error) {
    console.error('Get segments error:', error)
    return NextResponse.json(
      { error: 'Failed to get segments' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/segments
 * Create a new network segment
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Parse request body
    let body: {
      agent_id: string
      name: string
      description?: string
      cidr: string
      scan_interval_seconds?: number
      is_enabled?: boolean
    }

    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!body.agent_id || !body.name || !body.cidr) {
      return NextResponse.json(
        { error: 'Missing required fields: agent_id, name, cidr' },
        { status: 400 }
      )
    }

    // Validate CIDR format
    if (!isValidCidr(body.cidr)) {
      return NextResponse.json(
        { error: 'Invalid CIDR format. Expected format: x.x.x.x/nn (e.g., 192.168.1.0/24)' },
        { status: 400 }
      )
    }

    // Get agent to verify organization and existence
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, organization_id')
      .eq('id', body.agent_id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Authenticate user for this organization
    const authResult = await authenticateUser(agent.organization_id)
    if (!authResult.authorized) {
      return authResult.error
    }

    // Check permission
    if (!canManageAgents(authResult.context!)) {
      return NextResponse.json(
        { error: 'You do not have permission to manage network segments' },
        { status: 403 }
      )
    }

    // Get existing segments for overlap check
    const { data: existingSegments } = await supabase
      .from('network_segments')
      .select('id, name, cidr')
      .eq('organization_id', agent.organization_id)

    // Validate no overlap with existing segments
    const overlapCheck = validateNoOverlap(
      body.cidr,
      existingSegments || []
    )

    if (!overlapCheck.valid) {
      return NextResponse.json(
        {
          error: overlapCheck.message,
          overlapping_segment: overlapCheck.overlappingSegment,
        },
        { status: 409 } // Conflict
      )
    }

    // Create segment
    const { data: segment, error: createError } = await supabase
      .from('network_segments')
      .insert({
        organization_id: agent.organization_id,
        agent_id: body.agent_id,
        name: body.name.trim(),
        description: body.description || null,
        cidr: body.cidr,
        scan_interval_seconds: body.scan_interval_seconds || 300,
        is_enabled: body.is_enabled !== false,
      })
      .select()
      .single()

    if (createError) {
      console.error('Create segment error:', createError)
      return NextResponse.json(
        { error: 'Failed to create segment' },
        { status: 500 }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: agent.organization_id,
      actor_type: 'user',
      actor_id: authResult.context!.userId,
      action: 'segment.created',
      resource_type: 'network_segment',
      resource_id: segment.id,
      metadata: {
        name: segment.name,
        cidr: segment.cidr,
        agent_id: body.agent_id,
      },
    })

    return NextResponse.json(segment, { status: 201 })
  } catch (error) {
    console.error('Create segment error:', error)
    return NextResponse.json(
      { error: 'Failed to create segment' },
      { status: 500 }
    )
  }
}

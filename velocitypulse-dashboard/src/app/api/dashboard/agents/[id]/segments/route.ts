import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { isValidCidr, validateNoOverlap } from '@/lib/utils/cidr'

/**
 * POST /api/dashboard/agents/[id]/segments
 * Add a network segment to an agent
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

    const { id: agentId } = await params

    let body: { name: string; cidr: string; scan_interval_seconds?: number }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    if (!body.cidr?.trim()) {
      return NextResponse.json({ error: 'CIDR is required' }, { status: 400 })
    }

    // CIDR validation
    if (!isValidCidr(body.cidr.trim())) {
      return NextResponse.json(
        { error: 'Invalid CIDR format. Expected format: x.x.x.x/nn (e.g., 192.168.1.0/24)' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Auth + membership check
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const canManage = membership.role === 'owner' || membership.role === 'admin' ||
      (membership.permissions as { can_manage_agents?: boolean })?.can_manage_agents
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify agent belongs to org
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .eq('organization_id', membership.organization_id)
      .single()

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Validate no overlap with existing segments
    const { data: existingSegments, error: segmentsError } = await supabase
      .from('network_segments')
      .select('id, name, cidr')
      .eq('organization_id', membership.organization_id)

    if (segmentsError) {
      console.error('Failed to fetch existing segments:', segmentsError)
      return NextResponse.json({ error: 'Failed to validate segment overlap' }, { status: 500 })
    }

    const overlapCheck = validateNoOverlap(body.cidr.trim(), existingSegments || [])
    if (!overlapCheck.valid) {
      return NextResponse.json(
        {
          error: overlapCheck.message,
          overlapping_segment: overlapCheck.overlappingSegment,
        },
        { status: 409 }
      )
    }

    // Create segment
    const { data: segment, error: createError } = await supabase
      .from('network_segments')
      .insert({
        organization_id: membership.organization_id,
        agent_id: agentId,
        name: body.name.trim(),
        cidr: body.cidr.trim(),
        scan_interval_seconds: body.scan_interval_seconds || 300,
        is_enabled: true,
        last_scan_device_count: 0,
      })
      .select()
      .single()

    if (createError) {
      console.error('Create segment error:', createError)
      return NextResponse.json({ error: 'Failed to create segment' }, { status: 500 })
    }

    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      actor_type: 'user',
      actor_id: userId,
      action: 'segment.created',
      resource_type: 'network_segment',
      resource_id: segment.id,
      metadata: { name: body.name, cidr: body.cidr, agent_id: agentId },
    })

    return NextResponse.json({ segment }, { status: 201 })
  } catch (error) {
    console.error('Create segment error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

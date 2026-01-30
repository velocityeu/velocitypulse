import { NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/api/agent-auth'
import { createServiceClient } from '@/lib/db/client'
import { isValidCidr, validateNoOverlap } from '@/lib/utils/cidr'

export const dynamic = 'force-dynamic'

interface AutoSegmentRequest {
  cidr: string
  name: string
  interface_name: string
}

/**
 * POST /api/agent/segments/register
 * Auto-register a network segment detected by the agent
 *
 * This endpoint is used when an agent starts with no segments assigned
 * and auto-detects a local network to monitor.
 */
export async function POST(request: Request) {
  try {
    // Authenticate agent
    const agentContext = await authenticateAgent()
    if (!agentContext) {
      return NextResponse.json(
        { error: 'Invalid or disabled API key' },
        { status: 401 }
      )
    }

    // Parse request body
    let body: AutoSegmentRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    // Validate required fields
    if (!body.cidr || !body.name || !body.interface_name) {
      return NextResponse.json(
        { error: 'Missing required fields: cidr, name, interface_name' },
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

    const supabase = createServiceClient()

    // Get existing segments for overlap check
    const { data: existingSegments } = await supabase
      .from('network_segments')
      .select('id, name, cidr')
      .eq('organization_id', agentContext.organizationId)

    // Validate no overlap with existing segments
    const overlapCheck = validateNoOverlap(
      body.cidr,
      existingSegments || []
    )

    if (!overlapCheck.valid) {
      // If there's an overlap, check if it's an exact match (same segment already exists)
      const exactMatch = existingSegments?.find(
        s => s.cidr === body.cidr && s.name.includes('Auto-detected')
      )

      if (exactMatch) {
        // Return existing segment instead of creating duplicate
        return NextResponse.json({
          success: true,
          segment: exactMatch,
          message: 'Segment already exists',
        })
      }

      return NextResponse.json(
        {
          error: overlapCheck.message,
          overlapping_segment: overlapCheck.overlappingSegment,
        },
        { status: 409 } // Conflict
      )
    }

    // Create the auto-registered segment
    const { data: segment, error: createError } = await supabase
      .from('network_segments')
      .insert({
        organization_id: agentContext.organizationId,
        agent_id: agentContext.agentId,
        name: body.name.trim(),
        cidr: body.cidr,
        scan_interval_seconds: 300, // 5 minutes default
        is_enabled: true,
        is_auto_registered: true,
        interface_name: body.interface_name,
      })
      .select()
      .single()

    if (createError) {
      console.error('Failed to create auto-segment:', createError)
      return NextResponse.json(
        { error: 'Failed to register segment' },
        { status: 500 }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: agentContext.organizationId,
      actor_type: 'system',
      actor_id: `agent:${agentContext.agentId}`,
      action: 'segment.created',
      resource_type: 'network_segment',
      resource_id: segment.id,
      metadata: {
        name: segment.name,
        cidr: segment.cidr,
        interface_name: body.interface_name,
        auto_registered: true,
        agent_name: agentContext.agentName,
      },
    })

    console.log(`[AUTO-SEGMENT] Agent ${agentContext.agentName} registered segment: ${segment.name} (${segment.cidr})`)

    return NextResponse.json({
      success: true,
      segment,
    })
  } catch (error) {
    console.error('Auto-segment registration error:', error)
    return NextResponse.json(
      { error: 'Failed to register segment' },
      { status: 500 }
    )
  }
}

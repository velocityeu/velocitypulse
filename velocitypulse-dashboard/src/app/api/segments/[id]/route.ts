import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/client'
import { authenticateUser, canManageAgents } from '@/lib/api/user-auth'
import { isValidCidr, validateNoOverlap } from '@/lib/utils/cidr'

export const dynamic = 'force-dynamic'

/**
 * GET /api/segments/[id]
 * Get a specific network segment with devices count
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    // Get segment with agent info
    const { data: segment, error } = await supabase
      .from('network_segments')
      .select(`
        *,
        agent:agents (id, name, is_enabled)
      `)
      .eq('id', id)
      .single()

    if (error || !segment) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      )
    }

    // Authenticate user for this organization
    const auth = await authenticateUser(segment.organization_id)
    if (!auth.authorized) {
      return auth.error
    }

    // Get device count
    const { count: deviceCount } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true })
      .eq('network_segment_id', id)

    return NextResponse.json({
      ...segment,
      device_count: deviceCount || 0,
    })
  } catch (error) {
    console.error('Get segment error:', error)
    return NextResponse.json(
      { error: 'Failed to get segment' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/segments/[id]
 * Update segment name, description, CIDR, scan interval, or enabled status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    // Get segment to verify organization
    const { data: segment, error: segmentError } = await supabase
      .from('network_segments')
      .select('id, organization_id, name, cidr')
      .eq('id', id)
      .single()

    if (segmentError || !segment) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      )
    }

    // Authenticate user
    const auth = await authenticateUser(segment.organization_id)
    if (!auth.authorized) {
      return auth.error
    }

    // Check permission
    if (!canManageAgents(auth.context!)) {
      return NextResponse.json(
        { error: 'You do not have permission to manage network segments' },
        { status: 403 }
      )
    }

    // Parse request body
    let body: {
      name?: string
      description?: string
      cidr?: string
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

    // Validate
    if (body.name !== undefined && body.name.trim().length < 1) {
      return NextResponse.json(
        { error: 'Segment name cannot be empty' },
        { status: 400 }
      )
    }

    // Validate CIDR if updating
    if (body.cidr !== undefined) {
      if (!isValidCidr(body.cidr)) {
        return NextResponse.json(
          { error: 'Invalid CIDR format. Expected format: x.x.x.x/nn (e.g., 192.168.1.0/24)' },
          { status: 400 }
        )
      }

      // Check for overlaps with other segments (excluding this one)
      const { data: existingSegments } = await supabase
        .from('network_segments')
        .select('id, name, cidr')
        .eq('organization_id', segment.organization_id)

      const overlapCheck = validateNoOverlap(
        body.cidr,
        existingSegments || [],
        id // Exclude this segment from overlap check
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
    }

    // Validate scan interval (minimum 60 seconds)
    if (body.scan_interval_seconds !== undefined) {
      if (body.scan_interval_seconds < 60) {
        return NextResponse.json(
          { error: 'Scan interval must be at least 60 seconds' },
          { status: 400 }
        )
      }
    }

    // Build update object
    const updates: Record<string, unknown> = {}
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined) updates.description = body.description
    if (body.cidr !== undefined) updates.cidr = body.cidr
    if (body.scan_interval_seconds !== undefined) updates.scan_interval_seconds = body.scan_interval_seconds
    if (body.is_enabled !== undefined) updates.is_enabled = body.is_enabled

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update segment
    const { data: updatedSegment, error: updateError } = await supabase
      .from('network_segments')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Update segment error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update segment' },
        { status: 500 }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: segment.organization_id,
      actor_type: 'user',
      actor_id: auth.context!.userId,
      action: 'segment.updated',
      resource_type: 'network_segment',
      resource_id: id,
      metadata: {
        previous_name: segment.name,
        previous_cidr: segment.cidr,
        updates,
      },
    })

    return NextResponse.json(updatedSegment)
  } catch (error) {
    console.error('Patch segment error:', error)
    return NextResponse.json(
      { error: 'Failed to update segment' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/segments/[id]
 * Delete a network segment and all its devices (cascade)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    // Get segment
    const { data: segment, error: segmentError } = await supabase
      .from('network_segments')
      .select('id, organization_id, name, cidr')
      .eq('id', id)
      .single()

    if (segmentError || !segment) {
      return NextResponse.json(
        { error: 'Segment not found' },
        { status: 404 }
      )
    }

    // Authenticate user
    const auth = await authenticateUser(segment.organization_id)
    if (!auth.authorized) {
      return auth.error
    }

    // Check permission - only owners and admins can delete segments
    if (auth.context!.role !== 'owner' && auth.context!.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only owners and admins can delete network segments' },
        { status: 403 }
      )
    }

    // Get device count for audit
    const { count: deviceCount } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true })
      .eq('network_segment_id', id)

    // Create audit log BEFORE deletion
    await supabase.from('audit_logs').insert({
      organization_id: segment.organization_id,
      actor_type: 'user',
      actor_id: auth.context!.userId,
      action: 'segment.deleted',
      resource_type: 'network_segment',
      resource_id: id,
      metadata: {
        segment_name: segment.name,
        cidr: segment.cidr,
        devices_deleted: deviceCount || 0,
      },
    })

    // Delete segment (cascade will delete devices)
    const { error: deleteError } = await supabase
      .from('network_segments')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Delete segment error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete segment' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Segment "${segment.name}" and all associated devices have been deleted`,
      deleted: {
        segment: segment.name,
        devices: deviceCount || 0,
      },
    })
  } catch (error) {
    console.error('Delete segment error:', error)
    return NextResponse.json(
      { error: 'Failed to delete segment' },
      { status: 500 }
    )
  }
}

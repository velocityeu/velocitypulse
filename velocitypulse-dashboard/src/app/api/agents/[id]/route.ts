import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/client'
import { authenticateUser, canManageAgents } from '@/lib/api/user-auth'
import type { Agent } from '@/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/agents/[id]
 * Get a specific agent with its segments
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    // Get agent with org info
    const { data: agent, error } = await supabase
      .from('agents')
      .select(`
        *,
        network_segments (*)
      `)
      .eq('id', id)
      .single()

    if (error || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Authenticate user for this organization
    const auth = await authenticateUser(agent.organization_id)
    if (!auth.authorized) {
      return auth.error
    }

    return NextResponse.json(agent)
  } catch (error) {
    console.error('Get agent error:', error)
    return NextResponse.json(
      { error: 'Failed to get agent' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/agents/[id]
 * Update agent name, description, or enabled status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    // Get agent to verify organization
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, organization_id, name')
      .eq('id', id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Authenticate user
    const auth = await authenticateUser(agent.organization_id)
    if (!auth.authorized) {
      return auth.error
    }

    // Check permission
    if (!canManageAgents(auth.context!)) {
      return NextResponse.json(
        { error: 'You do not have permission to manage agents' },
        { status: 403 }
      )
    }

    // Parse request body
    let body: { name?: string; description?: string; is_enabled?: boolean }
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
        { error: 'Agent name cannot be empty' },
        { status: 400 }
      )
    }

    // Build update object
    const updates: Partial<Agent> = {}
    if (body.name !== undefined) updates.name = body.name.trim()
    if (body.description !== undefined) updates.description = body.description
    if (body.is_enabled !== undefined) updates.is_enabled = body.is_enabled

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Update agent
    const { data: updatedAgent, error: updateError } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Update agent error:', updateError)
      return NextResponse.json(
        { error: 'Failed to update agent' },
        { status: 500 }
      )
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: agent.organization_id,
      actor_type: 'user',
      actor_id: auth.context!.userId,
      action: 'agent.updated',
      resource_type: 'agent',
      resource_id: id,
      metadata: {
        previous_name: agent.name,
        updates,
      },
    })

    return NextResponse.json(updatedAgent)
  } catch (error) {
    console.error('Patch agent error:', error)
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/agents/[id]
 * Permanently delete an agent and all associated data (cascade)
 *
 * WARNING: This will permanently delete:
 * - The agent
 * - All network segments assigned to the agent
 * - All devices discovered by/assigned to the agent
 * - All pending commands for the agent
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    // Get agent with counts for confirmation and audit
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, organization_id, name')
      .eq('id', id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Authenticate user
    const auth = await authenticateUser(agent.organization_id)
    if (!auth.authorized) {
      return auth.error
    }

    // Check permission - only owners and admins can delete agents
    if (auth.context!.role !== 'owner' && auth.context!.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only owners and admins can delete agents' },
        { status: 403 }
      )
    }

    // Get counts for audit log
    const [segmentsResult, devicesResult, commandsResult] = await Promise.all([
      supabase
        .from('network_segments')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', id),
      supabase
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', id),
      supabase
        .from('agent_commands')
        .select('*', { count: 'exact', head: true })
        .eq('agent_id', id),
    ])

    const deletedCounts = {
      segments: segmentsResult.count || 0,
      devices: devicesResult.count || 0,
      commands: commandsResult.count || 0,
    }

    // Create audit log BEFORE deletion
    await supabase.from('audit_logs').insert({
      organization_id: agent.organization_id,
      actor_type: 'user',
      actor_id: auth.context!.userId,
      action: 'agent.deleted',
      resource_type: 'agent',
      resource_id: id,
      metadata: {
        agent_name: agent.name,
        cascade_deleted: deletedCounts,
      },
    })

    // Delete agent (cascade will delete segments, devices, commands)
    const { error: deleteError } = await supabase
      .from('agents')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Delete agent error:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete agent' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Agent "${agent.name}" and all associated data have been permanently deleted`,
      deleted: {
        agent: agent.name,
        ...deletedCounts,
      },
    })
  } catch (error) {
    console.error('Delete agent error:', error)
    return NextResponse.json(
      { error: 'Failed to delete agent' },
      { status: 500 }
    )
  }
}

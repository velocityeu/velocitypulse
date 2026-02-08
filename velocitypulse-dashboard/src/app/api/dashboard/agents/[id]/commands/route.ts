import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import type { AgentCommandType } from '@/types'

const VALID_COMMANDS: AgentCommandType[] = ['ping', 'scan_now', 'scan_segment', 'upgrade', 'restart', 'update_config']

/**
 * POST /api/dashboard/agents/[id]/commands
 * Send a command to an agent
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

    let body: { command_type: AgentCommandType; payload?: Record<string, unknown> }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.command_type || !VALID_COMMANDS.includes(body.command_type)) {
      return NextResponse.json({ error: 'Invalid command type' }, { status: 400 })
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

    // Check permission (agents require can_manage_agents)
    const canManage = membership.role === 'owner' || membership.role === 'admin' ||
      (membership.permissions as { can_manage_agents?: boolean })?.can_manage_agents
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to manage agents' }, { status: 403 })
    }

    // Verify agent belongs to user's organization
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name')
      .eq('id', agentId)
      .eq('organization_id', membership.organization_id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Insert command
    const { data: command, error: cmdError } = await supabase
      .from('agent_commands')
      .insert({
        agent_id: agentId,
        command_type: body.command_type,
        payload: body.payload || {},
        status: 'pending',
      })
      .select()
      .single()

    if (cmdError) {
      console.error('Failed to create command:', cmdError)
      return NextResponse.json({ error: 'Failed to create command' }, { status: 500 })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      actor_type: 'user',
      actor_id: userId,
      action: 'agent.updated',
      resource_type: 'agent_command',
      resource_id: command.id,
      metadata: { command_type: body.command_type, agent_name: agent.name },
    })

    return NextResponse.json({ command }, { status: 201 })
  } catch (error) {
    console.error('Create command error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

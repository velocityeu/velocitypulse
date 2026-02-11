import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'

/**
 * GET /api/dashboard/agents/[id]/commands/[commandId]
 * Fetch a single command's status and payload.
 * Used by the dashboard to poll for ping results.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; commandId: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: agentId, commandId } = await params

    const supabase = createServiceClient()

    // Verify user has access to this agent's org
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Verify agent belongs to user's organization
    const { data: agent } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .eq('organization_id', membership.organization_id)
      .single()

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Fetch the command
    const { data: command, error: cmdError } = await supabase
      .from('agent_commands')
      .select('id, command_type, status, payload, error, created_at, executed_at')
      .eq('id', commandId)
      .eq('agent_id', agentId)
      .single()

    if (cmdError || !command) {
      return NextResponse.json({ error: 'Command not found' }, { status: 404 })
    }

    return NextResponse.json({ command })
  } catch (error) {
    console.error('Fetch command error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

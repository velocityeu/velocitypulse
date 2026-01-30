import { NextRequest, NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/api/agent-auth'
import { createServiceClient } from '@/lib/db/client'
import type { AgentCommandStatus } from '@/types'

export const dynamic = 'force-dynamic'

interface CommandAckRequest {
  /** Whether the command executed successfully */
  success: boolean
  /** Result data from command execution */
  result?: Record<string, unknown>
  /** Error message if command failed */
  error?: string
}

interface CommandAckResponse {
  success: boolean
  command_id: string
  status: AgentCommandStatus
}

/**
 * POST /api/agent/commands/[commandId]/ack
 *
 * Agent acknowledges command execution.
 * Updates command status to completed or failed.
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ commandId: string }> }
) {
  try {
    // Authenticate agent
    const agentContext = await authenticateAgent()
    if (!agentContext) {
      return NextResponse.json(
        { error: 'Invalid or disabled API key' },
        { status: 401 }
      )
    }

    const { commandId } = await context.params

    if (!commandId) {
      return NextResponse.json(
        { error: 'Command ID is required' },
        { status: 400 }
      )
    }

    // Parse request body
    let body: CommandAckRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Verify command belongs to this agent
    const { data: command, error: commandError } = await supabase
      .from('agent_commands')
      .select('id, status')
      .eq('id', commandId)
      .eq('agent_id', agentContext.agentId)
      .single()

    if (commandError || !command) {
      return NextResponse.json(
        { error: 'Command not found or not assigned to this agent' },
        { status: 404 }
      )
    }

    // Check command hasn't already been acknowledged
    if (command.status !== 'pending') {
      return NextResponse.json(
        { error: `Command already ${command.status}` },
        { status: 409 }
      )
    }

    const newStatus: AgentCommandStatus = body.success ? 'completed' : 'failed'
    const now = new Date().toISOString()

    // Update command status
    const updateData: Record<string, unknown> = {
      status: newStatus,
      executed_at: now,
    }

    if (body.result) {
      updateData.payload = body.result
    }

    if (body.error) {
      updateData.error = body.error
    }

    const { error: updateError } = await supabase
      .from('agent_commands')
      .update(updateData)
      .eq('id', commandId)

    if (updateError) {
      console.error('Error updating command:', updateError)
      return NextResponse.json(
        { error: 'Failed to update command' },
        { status: 500 }
      )
    }

    const response: CommandAckResponse = {
      success: true,
      command_id: commandId,
      status: newStatus,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Command acknowledgment error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

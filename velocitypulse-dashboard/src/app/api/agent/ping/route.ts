import { NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/api/agent-auth'
import { createServiceClient } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

interface PingRequest {
  /** Timestamp when ping command was received */
  command_received_at?: string
  /** ID of the ping command being responded to */
  command_id?: string
  /** Agent's local timestamp */
  agent_timestamp: string
}

interface PingResponse {
  success: boolean
  pong: boolean
  agent_id: string
  agent_name: string
  server_timestamp: string
  /** Round-trip time in milliseconds (if command timing provided) */
  latency_ms?: number
}

/**
 * POST /api/agent/ping
 *
 * Ping/pong connectivity test endpoint.
 * Agent calls this to confirm connectivity and measure latency.
 *
 * @deprecated for command responses - v1.2.0+ agents use /api/agent/commands/[id]/ack instead.
 * Kept for standalone UI-initiated pings (no command_id) and backward compat with v1.1.0 agents.
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

    const serverTimestamp = new Date().toISOString()

    // Parse optional request body
    let body: PingRequest | null = null
    try {
      body = await request.json()
    } catch {
      // Empty body is OK for simple ping
    }

    let latencyMs: number | undefined

    // If responding to a ping command, calculate latency and acknowledge
    // This path is used by v1.1.0 agents; v1.2.0+ use /api/agent/commands/[id]/ack
    if (body?.command_id) {
      console.log(`[DEPRECATED] Agent ${agentContext.agentId} using /api/agent/ping for command ${body.command_id} - upgrade to v1.2.0+`)

      const supabase = createServiceClient()

      // Get the command to calculate latency
      const { data: command } = await supabase
        .from('agent_commands')
        .select('created_at, status')
        .eq('id', body.command_id)
        .eq('agent_id', agentContext.agentId)
        .single()

      if (command && (command.status === 'pending' || command.status === 'acknowledged')) {
        // Calculate round-trip latency from command creation to now
        const commandCreated = new Date(command.created_at).getTime()
        const now = Date.now()
        latencyMs = now - commandCreated

        // Acknowledge the command
        await supabase
          .from('agent_commands')
          .update({
            status: 'completed',
            executed_at: serverTimestamp,
            payload: {
              pong: true,
              latency_ms: latencyMs,
              round_trip_ms: latencyMs,
              agent_timestamp: body.agent_timestamp,
              server_timestamp: serverTimestamp,
            },
          })
          .eq('id', body.command_id)
      }
    }

    const response: PingResponse = {
      success: true,
      pong: true,
      agent_id: agentContext.agentId,
      agent_name: agentContext.agentName,
      server_timestamp: serverTimestamp,
      ...(latencyMs !== undefined && { latency_ms: latencyMs }),
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Ping error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

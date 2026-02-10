import { NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/api/agent-auth'
import { createServiceClient } from '@/lib/db/client'
import { LATEST_AGENT_VERSION, AGENT_DOWNLOAD_URL, ENFORCE_AGENT_UPDATES } from '@/lib/constants'
import { logger } from '@/lib/logger'
import { validateRequest, heartbeatRequestSchema } from '@/lib/validations'
import { checkAgentRateLimit, checkOrgMonthlyLimit, incrementUsage } from '@/lib/api/rate-limit'
import { rateLimited } from '@/lib/api/errors'
import type { AgentHeartbeatResponse, NetworkSegment, AgentCommand } from '@/types'

/**
 * Compare two semantic version strings
 * @returns true if latest is newer than current
 */
function isNewerVersion(latest: string, current: string): boolean {
  const parseVersion = (v: string): number[] => {
    return v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)
  }

  const partsLatest = parseVersion(latest)
  const partsCurrent = parseVersion(current)

  const maxLen = Math.max(partsLatest.length, partsCurrent.length)
  while (partsLatest.length < maxLen) partsLatest.push(0)
  while (partsCurrent.length < maxLen) partsCurrent.push(0)

  for (let i = 0; i < maxLen; i++) {
    if (partsLatest[i] > partsCurrent[i]) return true
    if (partsLatest[i] < partsCurrent[i]) return false
  }

  return false
}

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Authenticate agent (includes organization context)
    const agentContext = await authenticateAgent()
    if (!agentContext) {
      return NextResponse.json(
        { error: 'Invalid or disabled API key' },
        { status: 401 }
      )
    }

    // Rate limit checks
    const hourlyCheck = await checkAgentRateLimit(agentContext.agentId, 'heartbeat')
    if (!hourlyCheck.allowed) {
      return rateLimited(hourlyCheck.retryAfter)
    }

    const supabase = createServiceClient()

    const { data: orgData } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', agentContext.organizationId)
      .single()

    const plan = (orgData?.plan || 'trial') as 'trial' | 'starter' | 'unlimited'
    const monthlyCheck = await checkOrgMonthlyLimit(agentContext.organizationId, plan)
    if (!monthlyCheck.allowed) {
      return rateLimited(3600)
    }

    // Parse and validate request body
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const validation = validateRequest(heartbeatRequestSchema, rawBody)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }
    const body = validation.data

    // Update agent info
    await supabase
      .from('agents')
      .update({
        version: body.version || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', agentContext.agentId)

    // Get network segments assigned to this agent (scoped to organization)
    const { data: segments, error: segmentsError } = await supabase
      .from('network_segments')
      .select('*')
      .eq('agent_id', agentContext.agentId)
      .eq('organization_id', agentContext.organizationId)
      .eq('is_enabled', true)
      .order('created_at')

    if (segmentsError) {
      logger.error('Error fetching segments', segmentsError, { route: 'api/agent/heartbeat' })
      return NextResponse.json(
        { error: 'Failed to fetch network segments' },
        { status: 500 }
      )
    }

    // Include Supabase credentials for realtime subscription
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    // Check if agent version is outdated
    const agentVersion = body.version || '0.0.0'
    const upgradeAvailable = isNewerVersion(LATEST_AGENT_VERSION, agentVersion)

    // Auto-queue upgrade for outdated agents when enforcement is enabled
    if (ENFORCE_AGENT_UPDATES && upgradeAvailable) {
      try {
        const { data: pendingUpgradeCommands } = await supabase
          .from('agent_commands')
          .select('id')
          .eq('agent_id', agentContext.agentId)
          .eq('command_type', 'upgrade')
          .eq('status', 'pending')
          .limit(1)

        if (!pendingUpgradeCommands || pendingUpgradeCommands.length === 0) {
          logger.info(`[AUTO-UPGRADE] Queuing upgrade for agent ${agentContext.agentName} (${agentVersion} -> ${LATEST_AGENT_VERSION})`)

          await supabase.from('agent_commands').insert({
            agent_id: agentContext.agentId,
            command_type: 'upgrade',
            payload: {
              target_version: LATEST_AGENT_VERSION,
              download_url: AGENT_DOWNLOAD_URL,
              auto_queued: true,
            },
            status: 'pending',
          })
        }
      } catch (autoUpgradeError) {
        logger.error('[AUTO-UPGRADE] Failed to queue upgrade', autoUpgradeError, { route: 'api/agent/heartbeat' })
      }
    }

    // Fetch pending commands for this agent
    let pendingCommands: AgentCommand[] = []
    try {
      const { data: commands } = await supabase
        .from('agent_commands')
        .select('*')
        .eq('agent_id', agentContext.agentId)
        .eq('status', 'pending')
        .order('created_at')

      pendingCommands = (commands || []) as AgentCommand[]
    } catch (commandsError) {
      logger.error('[HEARTBEAT] Failed to fetch pending commands', commandsError, { route: 'api/agent/heartbeat' })
    }

    // Increment usage counters
    await incrementUsage(agentContext.organizationId, agentContext.agentId, 'heartbeat')

    const response: AgentHeartbeatResponse = {
      success: true,
      agent_id: agentContext.agentId,
      agent_name: agentContext.agentName,
      organization_id: agentContext.organizationId,
      server_time: new Date().toISOString(),
      segments: (segments || []) as NetworkSegment[],
      supabase_url: supabaseUrl,
      supabase_anon_key: supabaseAnonKey,
      latest_agent_version: LATEST_AGENT_VERSION,
      agent_download_url: AGENT_DOWNLOAD_URL,
      upgrade_available: upgradeAvailable,
      pending_commands: pendingCommands,
    }

    return NextResponse.json(response)
  } catch (error) {
    logger.error('Heartbeat error', error, { route: 'api/agent/heartbeat' })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

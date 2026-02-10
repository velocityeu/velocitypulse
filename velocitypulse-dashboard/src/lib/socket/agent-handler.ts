import type { Socket, Server } from 'socket.io'
import { logger } from '@/lib/logger'
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  AgentAuthenticatePayload,
  AgentHeartbeatPayload,
  AgentStatusReportPayload,
  AgentDiscoveryReportPayload,
  AgentCommandAckPayload,
  ServerAuthenticatedPayload,
  ServerErrorPayload,
} from './types'

// Lazy-load Supabase client to avoid issues during import
let supabaseClient: ReturnType<typeof import('@/lib/db/client').createServiceClient> | null = null
async function getSupabase() {
  if (!supabaseClient) {
    const { createServiceClient } = await import('@/lib/db/client')
    supabaseClient = createServiceClient()
  }
  return supabaseClient
}

// Constants
const LATEST_AGENT_VERSION = process.env.LATEST_AGENT_VERSION || '1.0.0'
const AGENT_DOWNLOAD_URL = process.env.AGENT_DOWNLOAD_URL || 'https://github.com/velocityeu/velocitypulse-agent/releases/latest'

/**
 * Extract client IP from socket connection
 */
function getClientIp(socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>): string {
  const forwarded = socket.handshake.headers['x-forwarded-for']
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim()
  }
  return socket.handshake.address || 'unknown'
}

// Connected agents map for tracking
const connectedAgents = new Map<string, Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>>()

/**
 * Authenticate an agent via API key
 */
async function authenticateAgentByKey(apiKey: string): Promise<{
  agentId: string
  agentName: string
  organizationId: string
} | null> {
  try {
    const { verifyAgentApiKey } = await import('@/lib/api/agent-key')
    return await verifyAgentApiKey(apiKey)
  } catch (error) {
    logger.error('[Socket] Auth error', error)
    return null
  }
}

/**
 * Compare semantic versions
 */
function isNewerVersion(latest: string, current: string): boolean {
  const parseVersion = (v: string): number[] =>
    v.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0)

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

/**
 * Handle agent connection and events
 */
export function handleAgentConnection(
  socket: Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>
) {
  logger.info(`[Socket] Agent connected: ${socket.id}`)

  // Initialize socket data
  socket.data.authenticated = false

  // Handle authentication
  socket.on('authenticate', async (payload: AgentAuthenticatePayload, callback) => {
    logger.info(`[Socket] Auth attempt from ${socket.id}`)

    const authResult = await authenticateAgentByKey(payload.apiKey)

    if (!authResult) {
      const error: ServerErrorPayload = {
        code: 'AUTH_FAILED',
        message: 'Invalid or disabled API key',
      }
      callback(error)
      socket.disconnect(true)
      return
    }

    // Store auth data
    socket.data.agentId = authResult.agentId
    socket.data.agentName = authResult.agentName
    socket.data.organizationId = authResult.organizationId
    socket.data.authenticated = true

    // Track connected agent
    connectedAgents.set(authResult.agentId, socket)

    // Join organization room for broadcasts
    socket.join(`org:${authResult.organizationId}`)
    socket.join(`agent:${authResult.agentId}`)

    // Update last_seen and version
    const supabase = await getSupabase()
    await supabase
      .from('agents')
      .update({
        last_seen_at: new Date().toISOString(),
        version: payload.version,
        last_ip_address: getClientIp(socket),
      })
      .eq('id', authResult.agentId)

    // Get segments for this agent
    const { data: segments } = await supabase
      .from('network_segments')
      .select('id, name, cidr, scan_interval_seconds, is_enabled')
      .eq('agent_id', authResult.agentId)
      .eq('is_enabled', true)

    const upgradeAvailable = isNewerVersion(LATEST_AGENT_VERSION, payload.version)

    const response: ServerAuthenticatedPayload = {
      agent_id: authResult.agentId,
      agent_name: authResult.agentName,
      organization_id: authResult.organizationId,
      segments: segments || [],
      latest_agent_version: LATEST_AGENT_VERSION,
      agent_download_url: AGENT_DOWNLOAD_URL,
      upgrade_available: upgradeAvailable,
    }

    callback(response)
    logger.info(`[Socket] Agent authenticated: ${authResult.agentName} (${authResult.agentId})`)
  })

  // Handle heartbeat
  socket.on('heartbeat', async (payload: AgentHeartbeatPayload) => {
    if (!socket.data.authenticated || !socket.data.agentId) {
      socket.emit('error', { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' })
      return
    }

    const supabase = await getSupabase()
    await supabase
      .from('agents')
      .update({
        last_seen_at: new Date().toISOString(),
        version: payload.version,
        last_ip_address: getClientIp(socket),
      })
      .eq('id', socket.data.agentId)

    // Record ping for analytics
    await supabase
      .from('agent_pings')
      .insert({ agent_id: socket.data.agentId })
  })

  // Handle status reports
  socket.on('status:report', async (payload: AgentStatusReportPayload) => {
    if (!socket.data.authenticated || !socket.data.organizationId) {
      socket.emit('error', { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' })
      return
    }

    const supabase = await getSupabase()

    for (const report of payload.reports) {
      // Find device by ID or IP
      let deviceQuery = supabase
        .from('devices')
        .select('id')
        .eq('organization_id', socket.data.organizationId)

      if (report.device_id) {
        deviceQuery = deviceQuery.eq('id', report.device_id)
      } else {
        deviceQuery = deviceQuery.eq('ip_address', report.ip_address)
      }

      const { data: device } = await deviceQuery.limit(1).single()

      if (device) {
        await supabase
          .from('devices')
          .update({
            status: report.status,
            response_time_ms: report.response_time_ms,
            last_check: report.checked_at,
            last_online: report.status === 'online' ? report.checked_at : undefined,
          })
          .eq('id', device.id)
      }
    }
  })

  // Handle discovery reports
  socket.on('discovery:report', async (payload: AgentDiscoveryReportPayload) => {
    if (!socket.data.authenticated || !socket.data.organizationId || !socket.data.agentId) {
      socket.emit('error', { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' })
      return
    }

    const supabase = await getSupabase()

    for (const device of payload.devices) {
      // Check if device exists
      const { data: existing } = await supabase
        .from('devices')
        .select('id')
        .eq('organization_id', socket.data.organizationId)
        .eq('ip_address', device.ip_address)
        .limit(1)
        .single()

      if (existing) {
        // Update existing
        await supabase
          .from('devices')
          .update({
            mac_address: device.mac_address,
            hostname: device.hostname,
            manufacturer: device.manufacturer,
            device_type: device.device_type || 'unknown',
            last_seen_at: payload.scan_timestamp,
          })
          .eq('id', existing.id)
      } else {
        // Create new
        await supabase.from('devices').insert({
          organization_id: socket.data.organizationId,
          agent_id: socket.data.agentId,
          network_segment_id: payload.segment_id,
          name: device.hostname || device.ip_address,
          ip_address: device.ip_address,
          mac_address: device.mac_address,
          hostname: device.hostname,
          manufacturer: device.manufacturer,
          device_type: device.device_type || 'unknown',
          status: 'unknown',
          check_type: 'ping',
          discovered_by: `agent_${device.discovery_method}`,
          first_seen_at: payload.scan_timestamp,
          last_seen_at: payload.scan_timestamp,
          is_monitored: true,
        })
      }
    }

    // Update segment scan stats
    await supabase
      .from('network_segments')
      .update({
        last_scan_at: payload.scan_timestamp,
        last_scan_device_count: payload.devices.length,
      })
      .eq('id', payload.segment_id)
  })

  // Handle command acknowledgement
  socket.on('command:ack', async (payload: AgentCommandAckPayload) => {
    if (!socket.data.authenticated) {
      socket.emit('error', { code: 'NOT_AUTHENTICATED', message: 'Not authenticated' })
      return
    }

    const supabase = await getSupabase()
    await supabase
      .from('agent_commands')
      .update({
        status: payload.status,
        executed_at: payload.executed_at,
        error: payload.error,
      })
      .eq('id', payload.command_id)
  })

  // Handle pong (response to ping)
  socket.on('pong', () => {
    // Agent is responsive, no action needed
    logger.info(`[Socket] Pong from ${socket.data.agentName || socket.id}`)
  })

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    logger.info(`[Socket] Agent disconnected: ${socket.data.agentName || socket.id} (${reason})`)
    if (socket.data.agentId) {
      connectedAgents.delete(socket.data.agentId)
    }
  })
}

/**
 * Send a command to a specific agent
 */
export function sendCommandToAgent(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  agentId: string,
  command: { command_id: string; command_type: string; payload?: Record<string, unknown> }
) {
  const socket = connectedAgents.get(agentId)
  if (socket && socket.connected) {
    socket.emit('command', {
      command_id: command.command_id,
      command_type: command.command_type as 'scan_now' | 'scan_segment' | 'update_config' | 'restart' | 'upgrade' | 'ping',
      payload: command.payload,
    })
    return true
  }
  return false
}

/**
 * Notify an agent that its segments have been updated
 */
export async function notifySegmentsUpdated(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  agentId: string
) {
  const socket = connectedAgents.get(agentId)
  if (!socket || !socket.connected) return false

  const supabase = await getSupabase()
  const { data: segments } = await supabase
    .from('network_segments')
    .select('id, name, cidr, scan_interval_seconds, is_enabled')
    .eq('agent_id', agentId)
    .eq('is_enabled', true)

  socket.emit('segments:updated', { segments: segments || [] })
  return true
}

/**
 * Get count of connected agents
 */
export function getConnectedAgentCount(): number {
  return connectedAgents.size
}

/**
 * Check if an agent is connected
 */
export function isAgentConnected(agentId: string): boolean {
  const socket = connectedAgents.get(agentId)
  return socket?.connected ?? false
}

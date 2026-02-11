/**
 * Socket.IO Event Types for Agent-Dashboard Communication
 */

// ==============================================
// Agent → Server Events
// ==============================================

export interface AgentAuthenticatePayload {
  apiKey: string
  version: string
  hostname: string
  platform?: 'linux' | 'darwin' | 'win32'
  arch?: string
}

export interface AgentHeartbeatPayload {
  version: string
  hostname: string
  uptime_seconds: number
  platform?: 'linux' | 'darwin' | 'win32'
  arch?: string
}

export interface AgentStatusReportPayload {
  reports: Array<{
    device_id?: string
    ip_address: string
    status: 'online' | 'offline' | 'degraded' | 'unknown'
    response_time_ms: number | null
    check_type: 'ping' | 'http' | 'tcp' | 'ssl' | 'dns'
    checked_at: string
    error?: string
  }>
}

export interface AgentDiscoveryReportPayload {
  segment_id: string
  scan_timestamp: string
  devices: Array<{
    ip_address: string
    mac_address?: string
    hostname?: string
    manufacturer?: string
    device_type?: string
    discovery_method: 'arp' | 'mdns' | 'ssdp' | 'snmp'
  }>
}

export interface AgentCommandAckPayload {
  command_id: string
  status: 'completed' | 'failed'
  error?: string
  executed_at: string
}

// ==============================================
// Server → Agent Events
// ==============================================

export interface ServerAuthenticatedPayload {
  agent_id: string
  agent_name: string
  organization_id: string
  segments: Array<{
    id: string
    name: string
    cidr: string
    scan_interval_seconds: number
    is_enabled: boolean
  }>
  latest_agent_version?: string
  agent_download_url?: string
  upgrade_available?: boolean
}

export interface ServerSegmentsUpdatedPayload {
  segments: Array<{
    id: string
    name: string
    cidr: string
    scan_interval_seconds: number
    is_enabled: boolean
  }>
}

export interface ServerCommandPayload {
  command_id: string
  command_type: 'scan_now' | 'scan_segment' | 'update_config' | 'restart' | 'upgrade' | 'ping'
  payload?: Record<string, unknown>
}

export interface ServerErrorPayload {
  code: string
  message: string
}

// ==============================================
// Event Maps for Type Safety
// ==============================================

export interface ClientToServerEvents {
  authenticate: (payload: AgentAuthenticatePayload, callback: (response: ServerAuthenticatedPayload | ServerErrorPayload) => void) => void
  heartbeat: (payload: AgentHeartbeatPayload) => void
  'status:report': (payload: AgentStatusReportPayload) => void
  'discovery:report': (payload: AgentDiscoveryReportPayload) => void
  'command:ack': (payload: AgentCommandAckPayload) => void
  pong: () => void
}

export interface ServerToClientEvents {
  authenticated: (payload: ServerAuthenticatedPayload) => void
  'segments:updated': (payload: ServerSegmentsUpdatedPayload) => void
  command: (payload: ServerCommandPayload) => void
  ping: () => void
  error: (payload: ServerErrorPayload) => void
}

export interface InterServerEvents {
  [event: string]: never
}

export interface SocketData {
  agentId?: string
  agentName?: string
  organizationId?: string
  authenticated: boolean
}

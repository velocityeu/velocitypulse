// ==============================================
// VelocityPulse Multi-Tenant Types
// ==============================================

// Status types
export type DeviceStatus = 'online' | 'offline' | 'degraded' | 'unknown'
export type CheckType = 'ping' | 'http' | 'tcp' | 'ssl' | 'dns'
export type DeviceType = 'server' | 'workstation' | 'network' | 'printer' | 'iot' | 'unknown'
export type DiscoveryMethod = 'manual' | 'agent_scan' | 'agent_arp' | 'agent_mdns' | 'agent_ssdp' | 'agent_snmp'
export type ViewMode = 'grid' | 'list' | 'compact'
export type SortField = 'name' | 'ip_address' | 'status' | 'last_check' | 'response_time_ms'
export type SortDirection = 'asc' | 'desc'

// ==============================================
// User Types (Clerk profile cache in Supabase)
// ==============================================

export interface User {
  id: string              // Clerk user_id
  email: string
  first_name: string | null
  last_name: string | null
  image_url: string | null
  is_staff: boolean
  last_sign_in_at: string | null
  created_at: string
  updated_at: string
}

// ==============================================
// Admin Role Types (SaaS internal)
// ==============================================

export type AdminRole = 'super_admin' | 'billing_admin' | 'support_admin' | 'viewer'

export interface AdminRoleRecord {
  user_id: string
  role: AdminRole
  is_active: boolean
  invited_by: string | null
  created_at: string
  updated_at: string
  // Joined from users table
  user?: User
}

export interface AdminAuditLog {
  id: string
  actor_id: string
  actor_email: string | null
  action: string
  resource_type: string | null
  resource_id: string | null
  organization_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

// ==============================================
// Multi-Tenant: Organization Types
// ==============================================

export type OrganizationPlan = 'trial' | 'starter' | 'unlimited'
export type OrganizationStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled'
export type MemberRole = 'owner' | 'admin' | 'editor' | 'viewer'

export interface Organization {
  id: string
  name: string
  slug: string
  customer_number: string // VEU-XXXXX format
  stripe_customer_id?: string
  stripe_subscription_id?: string
  plan: OrganizationPlan
  status: OrganizationStatus
  device_limit: number
  agent_limit: number
  user_limit: number
  trial_ends_at?: string
  suspended_at?: string
  cancelled_at?: string
  // White-label branding (unlimited tier)
  branding_display_name?: string
  branding_logo_url?: string
  branding_primary_color?: string
  // SSO/SAML (unlimited tier)
  sso_enabled?: boolean
  sso_domain?: string
  sso_provider?: string
  // Referral tracking
  referral_code?: string
  referred_by?: string
  created_at: string
  updated_at: string
}

export interface OrganizationMember {
  id: string
  organization_id: string
  user_id: string // Clerk user ID
  role: MemberRole
  permissions: MemberPermissions
  created_at: string
  updated_at: string
  // Joined
  organization?: Organization
}

export interface MemberPermissions {
  can_manage_billing: boolean
  can_manage_agents: boolean
  can_manage_devices: boolean
  can_manage_members: boolean
  can_view_audit_logs: boolean
}

// ==============================================
// Agent Types (Multi-Tenant)
// ==============================================

export interface Agent {
  id: string
  organization_id: string // FK to organization
  name: string
  description?: string
  api_key_prefix: string
  is_enabled: boolean
  last_seen_at?: string
  last_ip_address?: string
  version?: string
  created_at: string
  updated_at: string
  is_online?: boolean // Server-computed
  // Joined
  organization?: Organization
}

export interface AgentWithKey extends Agent {
  api_key?: string // Only returned when creating
}

export interface AgentWithSegments extends Agent {
  network_segments: NetworkSegment[]
}

// ==============================================
// Network Segment Types (Multi-Tenant)
// ==============================================

export type SegmentType = 'local_scan' | 'remote_monitor'

export interface NetworkSegment {
  id: string
  organization_id: string // FK to organization
  agent_id: string
  name: string
  description?: string
  cidr: string
  scan_interval_seconds: number
  is_enabled: boolean
  last_scan_at?: string
  last_scan_device_count: number
  segment_type: SegmentType
  created_at: string
  updated_at: string
  is_auto_registered?: boolean
  interface_name?: string
  // Joined
  agent?: Agent
}

// ==============================================
// Device Types (Multi-Tenant)
// ==============================================

export interface Category {
  id: string
  organization_id: string // FK to organization
  name: string
  slug: string
  description?: string
  icon: string
  color: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Device {
  id: string
  organization_id: string // FK to organization
  category_id: string | null
  name: string
  description?: string
  ip_address?: string
  url?: string
  port?: number | null
  check_type: CheckType
  icon?: string
  thumbnail_url?: string
  status: DeviceStatus
  last_check?: string
  last_online?: string
  response_time_ms?: number | null
  is_enabled: boolean
  sort_order: number
  created_at: string
  updated_at: string
  // Agent fields
  agent_id?: string | null
  discovered_by: DiscoveryMethod
  mac_address?: string
  hostname?: string
  network_segment_id?: string | null
  first_seen_at?: string
  last_seen_at?: string
  is_monitored: boolean
  // Enhanced discovery
  manufacturer?: string
  os_hints?: string[]
  device_type?: DeviceType
  open_ports?: number[]
  services?: string[]
  netbios_name?: string
  snmp_info?: {
    sysName?: string
    sysDescr?: string
    sysContact?: string
    sysLocation?: string
  }
  upnp_info?: {
    friendlyName?: string
    deviceType?: string
    manufacturer?: string
  }
  last_full_scan_at?: string
  // Remote monitoring fields
  ssl_expiry_at?: string
  ssl_expiry_warn_days?: number
  ssl_issuer?: string
  ssl_subject?: string
  dns_expected_ip?: string
  check_interval_seconds?: number
  monitoring_mode?: 'auto' | 'manual'
  // Joined
  category?: Category
  agent?: Agent
  network_segment?: NetworkSegment
}

// ==============================================
// Subscription Types
// ==============================================

export interface Subscription {
  id: string
  organization_id: string
  stripe_subscription_id: string
  plan: OrganizationPlan
  status: 'active' | 'past_due' | 'cancelled' | 'incomplete'
  current_period_start: string
  current_period_end: string
  amount_cents: number
  created_at: string
  updated_at: string
}

// ==============================================
// Invitation Types
// ==============================================

export type InvitationType = 'member' | 'admin'
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export interface Invitation {
  id: string
  token: string
  email: string
  invitation_type: InvitationType
  organization_id: string | null
  role: string
  status: InvitationStatus
  invited_by: string
  accepted_by: string | null
  accepted_at: string | null
  expires_at: string
  created_at: string
  updated_at: string
  // Joined
  organization?: { name: string }
}

// ==============================================
// Audit Log Types
// ==============================================

export type AuditAction =
  | 'organization.created'
  | 'organization.updated'
  | 'organization.suspended'
  | 'organization.reactivated'
  | 'organization.cancelled'
  | 'organization.trial_expired'
  | 'organization.trial_warning_sent'
  | 'organization.data_purged'
  | 'member.invited'
  | 'member.added_directly'
  | 'member.invitation_sent'
  | 'member.invitation_accepted'
  | 'member.invitation_revoked'
  | 'member.invitation_resent'
  | 'member.removed'
  | 'member.role_changed'
  | 'agent.created'
  | 'agent.updated'
  | 'agent.deleted'
  | 'agent.api_key_rotated'
  | 'segment.created'
  | 'segment.updated'
  | 'segment.deleted'
  | 'category.created'
  | 'category.updated'
  | 'category.deleted'
  | 'category.reordered'
  | 'device.created'
  | 'device.updated'
  | 'device.deleted'
  | 'notification_channel.created'
  | 'notification_channel.updated'
  | 'notification_channel.deleted'
  | 'notification_rule.created'
  | 'notification_rule.updated'
  | 'notification_rule.deleted'
  | 'subscription.created'
  | 'subscription.cancelled'
  | 'subscription.payment_failed'
  | 'checkout.started'

export interface AuditLog {
  id: string
  organization_id: string
  actor_type: 'user' | 'system' | 'webhook'
  actor_id?: string // Clerk user ID or system identifier
  action: AuditAction
  resource_type: string
  resource_id?: string
  metadata?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  created_at: string
}

// ==============================================
// Agent Command Types
// ==============================================

export type AgentCommandType = 'scan_now' | 'scan_segment' | 'update_config' | 'restart' | 'upgrade' | 'ping'
export type AgentCommandStatus = 'pending' | 'acknowledged' | 'completed' | 'failed'

export interface AgentCommand {
  id: string
  agent_id: string
  command_type: AgentCommandType
  payload?: Record<string, unknown>
  status: AgentCommandStatus
  created_at: string
  executed_at?: string
  error?: string
}

// ==============================================
// Status Summary Types
// ==============================================

export interface StatusSummary {
  total: number
  online: number
  offline: number
  degraded: number
  unknown: number
}

// ==============================================
// Device Segment Group (for display)
// ==============================================

export interface DeviceSegmentGroup {
  segment: NetworkSegment | null
  devices: Device[]
}

// ==============================================
// Agent API Request/Response Types
// ==============================================

export interface AgentHeartbeatRequest {
  version: string
  hostname: string
  uptime_seconds?: number
}

export interface AgentHeartbeatResponse {
  success: boolean
  agent_id: string
  agent_name: string
  organization_id: string
  server_time: string
  segments: NetworkSegment[]
  supabase_url?: string
  supabase_anon_key?: string
  latest_agent_version?: string
  agent_download_url?: string
  upgrade_available?: boolean
  pending_commands?: AgentCommand[]
}

export interface AgentDiscoveryRequest {
  segment_id: string
  scan_timestamp: string
  devices: DiscoveredDevice[]
}

export interface DiscoveredDevice {
  ip_address: string
  mac_address?: string
  hostname?: string
  manufacturer?: string
  os_hints?: string[]
  device_type?: DeviceType
  open_ports?: number[]
  services?: string[]
  netbios_name?: string
  snmp_info?: {
    sysName?: string
    sysDescr?: string
    sysContact?: string
    sysLocation?: string
  }
  upnp_info?: {
    friendlyName?: string
    deviceType?: string
    manufacturer?: string
  }
  discovery_method: 'arp' | 'mdns' | 'ssdp' | 'snmp'
}

export interface AgentDiscoveryResponse {
  success: boolean
  created: number
  updated: number
  unchanged: number
}

export interface DeviceStatusReport {
  device_id?: string
  ip_address: string
  status: DeviceStatus
  response_time_ms: number | null
  check_type: CheckType
  checked_at: string
  error?: string
  // SSL metadata from agent
  ssl_expiry_at?: string
  ssl_issuer?: string
  ssl_subject?: string
}

export interface AgentStatusRequest {
  reports: DeviceStatusReport[]
}

export interface AgentStatusResponse {
  success: boolean
  processed: number
  errors: string[]
}

// ==============================================
// Agent Context (for authenticated requests)
// ==============================================

export interface AgentContext {
  agentId: string
  agentName: string
  organizationId: string
}

// ==============================================
// Notification Types
// ==============================================

export type NotificationChannelType = 'email' | 'slack' | 'teams' | 'webhook'
export type NotificationEventType =
  | 'device.offline'
  | 'device.online'
  | 'device.degraded'
  | 'agent.offline'
  | 'agent.online'
  | 'scan.complete'

export interface NotificationChannel {
  id: string
  organization_id: string
  name: string
  channel_type: NotificationChannelType
  config: NotificationChannelConfig
  is_enabled: boolean
  created_at: string
  updated_at: string
}

export type NotificationChannelConfig =
  | EmailChannelConfig
  | SlackChannelConfig
  | TeamsChannelConfig
  | WebhookChannelConfig

export interface EmailChannelConfig {
  type: 'email'
  recipients: string[] // email addresses
}

export interface SlackChannelConfig {
  type: 'slack'
  webhook_url: string
  channel_name?: string // for display purposes
}

export interface TeamsChannelConfig {
  type: 'teams'
  webhook_url: string
  channel_name?: string
}

export interface WebhookChannelConfig {
  type: 'webhook'
  url: string
  method: 'POST' | 'GET'
  headers?: Record<string, string>
}

export interface NotificationRule {
  id: string
  organization_id: string
  name: string
  description?: string
  event_type: NotificationEventType
  channel_ids: string[] // which channels to notify
  filters?: NotificationRuleFilters
  is_enabled: boolean
  cooldown_minutes: number // prevent spam, default 5
  created_at: string
  updated_at: string
}

export interface NotificationRuleFilters {
  category_ids?: string[] // only for specific categories
  device_ids?: string[] // only for specific devices
  agent_ids?: string[] // only for specific agents
  segment_ids?: string[] // only for specific segments
}

export interface NotificationHistory {
  id: string
  organization_id: string
  rule_id: string
  channel_id: string
  event_type: NotificationEventType
  event_data: Record<string, unknown>
  status: 'pending' | 'sent' | 'failed'
  error?: string
  sent_at?: string
  created_at: string
}

// ==============================================
// Analytics Types
// ==============================================

export interface DeviceStatusHistoryRecord {
  id: string
  device_id: string
  organization_id: string
  status: DeviceStatus
  response_time_ms: number | null
  check_type: CheckType
  checked_at: string
}

export type AnalyticsTimeRange = '24h' | '7d' | '30d'

export interface DeviceUptimeStats {
  device_id: string
  device_name: string
  uptime_percentage: number
  avg_response_time_ms: number | null
  total_checks: number
}

export interface AnalyticsResponse {
  history: DeviceStatusHistoryRecord[]
  uptime: DeviceUptimeStats[]
  range: AnalyticsTimeRange
}

// ==============================================
// Support / Helpdesk Types
// ==============================================

export type TicketCategory = 'billing' | 'subscription' | 'technical' | 'other'
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export interface SupportTicket {
  id: string
  ticket_number: string
  organization_id: string
  created_by: string
  assigned_to: string | null
  subject: string
  description: string
  category: TicketCategory
  priority: TicketPriority
  status: TicketStatus
  created_at: string
  updated_at: string
  // Joined
  organization?: { id?: string; name: string; customer_number: string; slug?: string; plan?: string; status?: string }
  creator?: { email: string; first_name: string | null; last_name: string | null }
  assignee?: { email: string; first_name: string | null; last_name: string | null }
  comment_count?: number
}

export interface TicketComment {
  id: string
  ticket_id: string
  author_id: string
  author_type: 'user' | 'admin'
  content: string
  is_internal: boolean
  created_at: string
  // Joined
  author?: { email: string; first_name: string | null; last_name: string | null }
}

// ==============================================
// Plan Limits - Use PLAN_LIMITS from @/lib/constants
// ==============================================

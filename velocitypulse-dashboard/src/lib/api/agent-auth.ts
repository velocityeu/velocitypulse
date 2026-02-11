import { createServiceClient } from '@/lib/db/client'
import { headers } from 'next/headers'
import crypto from 'crypto'
import type { AgentContext } from '@/types'
import { API_KEY_PREFIX } from '@/lib/constants'
import { verifyAgentApiKey } from '@/lib/api/agent-key'
import { logger } from '@/lib/logger'
import { triggerAgentNotification } from '@/lib/notifications'

const AGENT_ONLINE_THRESHOLD_MS = 5 * 60 * 1000

/**
 * Authenticates an agent via API key in Authorization header, X-Agent-Key, or X-API-Key header
 *
 * API Key format: vp_{org_prefix}_{random_24_chars}
 * Example: vp_acme1234_xK7mN9pQ2rStUvWxYz345678
 *
 * Supports header formats:
 * - Authorization: Bearer <api_key>
 * - X-Agent-Key: <api_key>
 * - X-API-Key: <api_key>
 *
 * Returns agent context if valid (including organization), null if invalid
 */
export async function authenticateAgent(): Promise<AgentContext | null> {
  const headersList = await headers()

  // Extract API key from headers
  let apiKey: string | null = null

  // Check X-Agent-Key first (documented format)
  const xAgentKey = headersList.get('x-agent-key')
  if (xAgentKey) {
    apiKey = xAgentKey
  }

  // Fall back to X-API-Key (legacy/doc mismatch)
  if (!apiKey) {
    const xApiKey = headersList.get('x-api-key')
    if (xApiKey) {
      apiKey = xApiKey
    }
  }

  // Fall back to Authorization: Bearer
  if (!apiKey) {
    const authHeader = headersList.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      apiKey = authHeader.slice(7)
    }
  }

  if (!apiKey) {
    return null
  }

  const agentContext = await verifyAgentApiKey(apiKey)
  if (!agentContext) {
    return null
  }

  // Update last_seen timestamp and IP
  const clientIp = headersList.get('x-forwarded-for')?.split(',')[0] ||
                   headersList.get('x-real-ip') ||
                   'unknown'

  const supabase = createServiceClient()
  const { data: existingAgent } = await supabase
    .from('agents')
    .select('id, name, last_seen_at')
    .eq('id', agentContext.agentId)
    .maybeSingle<{
      id: string
      name: string
      last_seen_at: string | null
    }>()

  const now = new Date()
  const wasOnline = existingAgent?.last_seen_at
    ? (now.getTime() - new Date(existingAgent.last_seen_at).getTime()) < AGENT_ONLINE_THRESHOLD_MS
    : false

  await supabase
    .from('agents')
    .update({
      last_seen_at: now.toISOString(),
      last_ip_address: clientIp,
    })
    .eq('id', agentContext.agentId)

  if (!wasOnline) {
    triggerAgentNotification(
      agentContext.organizationId,
      agentContext.agentId,
      existingAgent?.name || agentContext.agentName,
      'agent.online',
      {
        ip_address: clientIp,
        last_seen_at: existingAgent?.last_seen_at || null,
      }
    ).catch((notifyError) => {
      logger.error('Failed to emit agent.online notification', notifyError, {
        route: 'lib/api/agent-auth',
        agentId: agentContext.agentId,
      })
    })

    await supabase
      .from('agent_notification_state')
      .upsert({
        agent_id: agentContext.agentId,
        organization_id: agentContext.organizationId,
        last_notified_state: 'online',
        last_transition_at: now.toISOString(),
      })
  }

  return agentContext
}

/**
 * Generates a new API key for an agent
 *
 * Format: vp_{org_prefix}_{random_24_chars}
 * - org_prefix: First 8 chars of org slug (padded if needed)
 * - random: 24 random alphanumeric chars
 *
 * Returns the full key (shown once) and hash/prefix for storage
 */
export function generateApiKey(orgSlug: string): {
  apiKey: string
  apiKeyHash: string
  apiKeyPrefix: string
} {
  // Get org prefix (first 8 chars, padded)
  const orgPrefix = orgSlug
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8)
    .padEnd(8, '0')

  // Generate 24-char random part
  const randomBytes = crypto.randomBytes(18)
  const randomPart = randomBytes.toString('base64url').slice(0, 24)

  const apiKey = `${API_KEY_PREFIX}${orgPrefix}_${randomPart}`

  // Hash for storage
  const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex')

  // Prefix for lookup (vp_XXXXXXXX)
  const apiKeyPrefix = apiKey.slice(0, 12)

  return {
    apiKey,
    apiKeyHash,
    apiKeyPrefix,
  }
}

/**
 * Rotate an agent's API key
 * Returns new key (shown once), stores new hash
 * Old key remains valid for 24 hours
 */
export async function rotateApiKey(
  agentId: string,
  orgSlug: string
): Promise<{ apiKey: string } | null> {
  const supabase = createServiceClient()

  // Get current agent to store old key hash
  const { data: agent } = await supabase
    .from('agents')
    .select('api_key_hash')
    .eq('id', agentId)
    .single()

  if (!agent) {
    return null
  }

  // Generate new key
  const { apiKey, apiKeyHash, apiKeyPrefix } = generateApiKey(orgSlug)

  // Update agent with new key
  // Store old hash temporarily for grace period
  const { error } = await supabase
    .from('agents')
    .update({
      api_key_hash: apiKeyHash,
      api_key_prefix: apiKeyPrefix,
      previous_api_key_hash: agent.api_key_hash,
      previous_api_key_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId)

  if (error) {
    console.error('Failed to rotate API key:', error)
    return null
  }

  return { apiKey }
}

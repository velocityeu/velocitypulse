import crypto from 'crypto'
import { createServiceClient } from '@/lib/db/client'
import type { AgentContext } from '@/types'
import { API_KEY_PREFIX } from '@/lib/constants'

interface AgentKeyRow {
  id: string
  name: string
  is_enabled: boolean
  organization_id: string
  api_key_hash: string | null
  previous_api_key_hash: string | null
  previous_api_key_expires_at: string | null
}

function isValidApiKey(apiKey: string): boolean {
  return apiKey.startsWith(API_KEY_PREFIX) && apiKey.length >= 20
}

function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex')
}

async function fetchAgentByKeyHash(
  supabase: ReturnType<typeof createServiceClient>,
  keyHash: string,
  prefix?: string
): Promise<AgentKeyRow | null> {
  const selector = 'id, name, is_enabled, organization_id, api_key_hash, previous_api_key_hash, previous_api_key_expires_at'

  if (prefix) {
    const { data } = await supabase
      .from('agents')
      .select(selector)
      .eq('api_key_prefix', prefix)
      .or(`api_key_hash.eq.${keyHash},previous_api_key_hash.eq.${keyHash}`)
      .single()
    if (data) return data as AgentKeyRow
  }

  const { data } = await supabase
    .from('agents')
    .select(selector)
    .or(`api_key_hash.eq.${keyHash},previous_api_key_hash.eq.${keyHash}`)
    .single()

  return (data as AgentKeyRow) || null
}

export async function verifyAgentApiKey(apiKey: string): Promise<AgentContext | null> {
  if (!apiKey || !isValidApiKey(apiKey)) {
    return null
  }

  const prefix = apiKey.slice(0, 12)
  const keyHash = hashApiKey(apiKey)
  const supabase = createServiceClient()

  const agent = await fetchAgentByKeyHash(supabase, keyHash, prefix)
  if (!agent || !agent.is_enabled) {
    return null
  }

  const isPreviousKey =
    agent.previous_api_key_hash && agent.previous_api_key_hash === keyHash

  if (isPreviousKey) {
    if (!agent.previous_api_key_expires_at) {
      return null
    }
    const expiresAt = new Date(agent.previous_api_key_expires_at).getTime()
    if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
      return null
    }
  } else if (agent.api_key_hash !== keyHash) {
    return null
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, status')
    .eq('id', agent.organization_id)
    .single()

  if (orgError || !org) {
    return null
  }

  if (org.status === 'suspended' || org.status === 'cancelled') {
    return null
  }

  return {
    agentId: agent.id,
    agentName: agent.name,
    organizationId: agent.organization_id,
  }
}

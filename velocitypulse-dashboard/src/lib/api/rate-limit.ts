import { createServiceClient } from '@/lib/db/client'
import { RATE_LIMITS, PLAN_LIMITS } from '@/lib/constants'

type EndpointKey = 'heartbeat' | 'discovery' | 'status'

const ENDPOINT_LIMITS: Record<EndpointKey, number> = {
  heartbeat: RATE_LIMITS.agentHeartbeat,
  discovery: RATE_LIMITS.deviceUpdates,
  status: RATE_LIMITS.deviceUpdates,
}

/**
 * Check if an agent has exceeded the hourly rate limit for a given endpoint.
 * Returns { allowed: true } or { allowed: false, retryAfter: seconds }.
 */
export async function checkAgentRateLimit(
  agentId: string,
  endpoint: EndpointKey
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const limit = ENDPOINT_LIMITS[endpoint]
  if (!limit) return { allowed: true }

  const supabase = createServiceClient()
  const hourBucket = new Date()
  hourBucket.setMinutes(0, 0, 0)

  const { data } = await supabase
    .from('api_usage_hourly')
    .select('call_count')
    .eq('agent_id', agentId)
    .eq('hour_bucket', hourBucket.toISOString())
    .eq('endpoint', endpoint)
    .single()

  const currentCount = data?.call_count ?? 0
  if (currentCount >= limit) {
    const minutesLeft = 60 - new Date().getMinutes()
    return { allowed: false, retryAfter: minutesLeft * 60 }
  }

  return { allowed: true }
}

/**
 * Check if an organization has exceeded its monthly API call quota.
 * Returns { allowed: true } or { allowed: false }.
 */
export async function checkOrgMonthlyLimit(
  orgId: string,
  plan: keyof typeof PLAN_LIMITS
): Promise<{ allowed: boolean; current?: number; limit?: number }> {
  const monthlyLimit = PLAN_LIMITS[plan]?.apiCallsPerMonth ?? -1
  if (monthlyLimit === -1) return { allowed: true }

  const supabase = createServiceClient()
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const { data } = await supabase
    .from('api_usage_monthly')
    .select('call_count')
    .eq('organization_id', orgId)
    .eq('year_month', yearMonth)
    .single()

  const currentCount = data?.call_count ?? 0
  if (currentCount >= monthlyLimit) {
    return { allowed: false, current: currentCount, limit: monthlyLimit }
  }

  return { allowed: true, current: currentCount, limit: monthlyLimit }
}

/**
 * Increment usage counters after a successful API call.
 * Calls the atomic Postgres upsert functions.
 */
export async function incrementUsage(
  orgId: string,
  agentId?: string,
  endpoint?: EndpointKey
): Promise<void> {
  const supabase = createServiceClient()
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  // Always increment monthly org usage
  await supabase.rpc('increment_monthly_usage', { org_id: orgId, ym: yearMonth })

  // Optionally increment hourly agent usage
  if (agentId && endpoint) {
    await supabase.rpc('increment_hourly_usage', {
      a_id: agentId,
      org_id: orgId,
      ep: endpoint,
    })
  }
}

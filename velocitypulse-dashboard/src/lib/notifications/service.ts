import { createServiceClient } from '@/lib/db/client'
import type {
  NotificationChannel,
  NotificationRule,
} from '@/types'
import type { NotificationEvent, NotificationResult } from './types'
import { sendEmailNotification } from './senders/email'
import { sendSlackNotification } from './senders/slack'
import { sendTeamsNotification } from './senders/teams'
import { sendWebhookNotification } from './senders/webhook'

const NOTIFICATION_MAX_ATTEMPTS = 3
const NOTIFICATION_QUEUE_MAX_ATTEMPTS = 5
const NOTIFICATION_QUEUE_BASE_DELAY_SECONDS = 120

interface NotificationRetryQueueRow {
  id: string
  organization_id: string
  rule_id: string | null
  channel_id: string | null
  event_type: NotificationEvent['type']
  event_data: Record<string, unknown>
  attempt_count: number
  max_attempts: number
  status: 'queued' | 'processing' | 'sent' | 'dead_letter'
}

interface NotificationRetryQueueResult {
  processed: number
  sent: number
  requeued: number
  dead_lettered: number
  errors: number
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Main notification service
 * Handles triggering notifications when events occur
 */
export class NotificationService {
  private supabase = createServiceClient()

  /**
   * Trigger notifications for an event
   */
  async trigger(event: NotificationEvent): Promise<NotificationResult[]> {
    const results: NotificationResult[] = []

    try {
      // Find matching rules for this event type
      const rules = await this.findMatchingRules(event)

      if (rules.length === 0) {
        return results
      }

      // Process each rule
      for (const rule of rules) {
        const ruleResults = await this.processRule(rule, event)
        results.push(...ruleResults)
      }
    } catch (error) {
      console.error('[NotificationService] Error triggering notifications:', error)
    }

    return results
  }

  /**
   * Find notification rules that match this event
   */
  private async findMatchingRules(event: NotificationEvent): Promise<NotificationRule[]> {
    const { data: rules, error } = await this.supabase
      .from('notification_rules')
      .select('*')
      .eq('organization_id', event.organizationId)
      .eq('event_type', event.type)
      .eq('is_enabled', true)

    if (error) {
      console.error('[NotificationService] Error fetching rules:', error)
      return []
    }

    // Filter by rule filters (category, device, agent, segment)
    return (rules || []).filter((rule) => this.matchesFilters(rule, event))
  }

  /**
   * Check if event matches rule filters
   */
  private matchesFilters(rule: NotificationRule, event: NotificationEvent): boolean {
    const filters = rule.filters as NotificationRule['filters']

    if (!filters) return true

    // Check device filter
    if (filters.device_ids?.length && event.resourceType === 'device') {
      if (!filters.device_ids.includes(event.resourceId)) {
        return false
      }
    }

    // Check agent filter
    if (filters.agent_ids?.length && event.resourceType === 'agent') {
      if (!filters.agent_ids.includes(event.resourceId)) {
        return false
      }
    }

    // Check category filter (for devices)
    if (filters.category_ids?.length && event.data.category_id) {
      if (!filters.category_ids.includes(event.data.category_id as string)) {
        return false
      }
    }

    // Check segment filter
    if (filters.segment_ids?.length && event.data.segment_id) {
      if (!filters.segment_ids.includes(event.data.segment_id as string)) {
        return false
      }
    }

    return true
  }

  /**
   * Process a single rule and send to all its channels
   */
  private async processRule(
    rule: NotificationRule,
    event: NotificationEvent
  ): Promise<NotificationResult[]> {
    const results: NotificationResult[] = []

    // Check cooldown
    const inCooldown = await this.checkCooldown(rule, event)
    if (inCooldown) {
      console.log(`[NotificationService] Rule ${rule.id} in cooldown for ${event.resourceId}`)
      return results
    }

    // Get channels for this rule
    const channels = await this.getChannels(rule.channel_ids)

    for (const channel of channels) {
      const result = await this.sendNotification(channel, rule, event)
      results.push(result)

      // Log to history
      await this.logNotification(event, rule, channel, result)
      if (!result.success) {
        await this.enqueueNotificationRetry(rule, channel, event, result.error)
      }
    }

    // Update cooldown
    if (results.some((r) => r.success)) {
      await this.updateCooldown(rule, event)
    }

    return results
  }

  /**
   * Check if we're in cooldown period for this rule/resource
   */
  private async checkCooldown(rule: NotificationRule, event: NotificationEvent): Promise<boolean> {
    const { data } = await this.supabase.rpc('check_notification_cooldown', {
      p_rule_id: rule.id,
      p_resource_type: event.resourceType,
      p_resource_id: event.resourceId,
      p_cooldown_minutes: rule.cooldown_minutes,
    })

    return data === false
  }

  /**
   * Update cooldown timestamp
   */
  private async updateCooldown(rule: NotificationRule, event: NotificationEvent): Promise<void> {
    await this.supabase.from('notification_cooldowns').upsert(
      {
        organization_id: event.organizationId,
        rule_id: rule.id,
        resource_type: event.resourceType,
        resource_id: event.resourceId,
        last_notified_at: new Date().toISOString(),
      },
      {
        onConflict: 'rule_id,resource_type,resource_id',
      }
    )
  }

  /**
   * Get channels by IDs
   */
  private async getChannels(channelIds: string[]): Promise<NotificationChannel[]> {
    if (channelIds.length === 0) return []

    const { data: channels, error } = await this.supabase
      .from('notification_channels')
      .select('*')
      .in('id', channelIds)
      .eq('is_enabled', true)

    if (error) {
      console.error('[NotificationService] Error fetching channels:', error)
      return []
    }

    return channels || []
  }

  /**
   * Send notification to a specific channel
   */
  private async sendNotification(
    channel: NotificationChannel,
    rule: NotificationRule,
    event: NotificationEvent
  ): Promise<NotificationResult> {
    const payload = { event, rule, channel }

    let lastResult: NotificationResult = {
      success: false,
      channelId: channel.id,
      error: 'Notification delivery failed',
    }

    for (let attempt = 1; attempt <= NOTIFICATION_MAX_ATTEMPTS; attempt++) {
      try {
        switch (channel.channel_type) {
          case 'email':
            lastResult = await sendEmailNotification(payload)
            break
          case 'slack':
            lastResult = await sendSlackNotification(payload)
            break
          case 'teams':
            lastResult = await sendTeamsNotification(payload)
            break
          case 'webhook':
            lastResult = await sendWebhookNotification(payload)
            break
          default:
            return {
              success: false,
              channelId: channel.id,
              error: `Unknown channel type: ${channel.channel_type}`,
            }
        }
      } catch (error) {
        lastResult = {
          success: false,
          channelId: channel.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        }
      }

      if (lastResult.success) {
        return lastResult
      }

      if (attempt < NOTIFICATION_MAX_ATTEMPTS) {
        await sleep(200 * attempt)
      }
    }

    return {
      ...lastResult,
      error: `${lastResult.error || 'Delivery failed'} (after ${NOTIFICATION_MAX_ATTEMPTS} attempts)`,
    }
  }

  /**
   * Log notification to history
   */
  private async logNotification(
    event: NotificationEvent,
    rule: NotificationRule,
    channel: NotificationChannel,
    result: NotificationResult
  ): Promise<void> {
    await this.supabase.from('notification_history').insert({
      organization_id: event.organizationId,
      rule_id: rule.id,
      channel_id: channel.id,
      event_type: event.type,
      event_data: {
        resource_type: event.resourceType,
        resource_id: event.resourceId,
        resource_name: event.resourceName,
        ...event.data,
      },
      status: result.success ? 'sent' : 'failed',
      error: result.error,
      sent_at: result.success ? new Date().toISOString() : null,
    })
  }

  private async enqueueNotificationRetry(
    rule: NotificationRule,
    channel: NotificationChannel,
    event: NotificationEvent,
    errorMessage?: string
  ): Promise<void> {
    const firstRetryAt = new Date(Date.now() + NOTIFICATION_QUEUE_BASE_DELAY_SECONDS * 1000).toISOString()
    const { error } = await this.supabase
      .from('notification_retry_queue')
      .insert({
        organization_id: event.organizationId,
        rule_id: rule.id,
        channel_id: channel.id,
        event_type: event.type,
        event_data: {
          resource_type: event.resourceType,
          resource_id: event.resourceId,
          resource_name: event.resourceName,
          ...event.data,
        },
        attempt_count: 0,
        max_attempts: NOTIFICATION_QUEUE_MAX_ATTEMPTS,
        next_attempt_at: firstRetryAt,
        status: 'queued',
        last_error: errorMessage || null,
      })

    if (error) {
      console.error('[NotificationService] Failed to enqueue notification retry:', error)
    }
  }

  private parseRetryEvent(row: NotificationRetryQueueRow): NotificationEvent | null {
    const resourceType = row.event_data.resource_type
    const resourceId = row.event_data.resource_id
    const resourceName = row.event_data.resource_name

    if (
      typeof resourceType !== 'string' ||
      typeof resourceId !== 'string' ||
      typeof resourceName !== 'string'
    ) {
      return null
    }

    if (!['device', 'agent', 'segment'].includes(resourceType)) {
      return null
    }

    const eventData = { ...row.event_data }
    delete eventData.resource_type
    delete eventData.resource_id
    delete eventData.resource_name

    return {
      type: row.event_type,
      organizationId: row.organization_id,
      resourceType: resourceType as NotificationEvent['resourceType'],
      resourceId,
      resourceName,
      data: eventData,
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * Process queued notification retries and move exhausted records to dead-letter.
   */
  async processRetryQueue(limit = 50): Promise<NotificationRetryQueueResult> {
    const result: NotificationRetryQueueResult = {
      processed: 0,
      sent: 0,
      requeued: 0,
      dead_lettered: 0,
      errors: 0,
    }

    const nowIso = new Date().toISOString()
    const { data: queuedRows, error: fetchError } = await this.supabase
      .from('notification_retry_queue')
      .select('id, organization_id, rule_id, channel_id, event_type, event_data, attempt_count, max_attempts, status')
      .eq('status', 'queued')
      .lte('next_attempt_at', nowIso)
      .order('next_attempt_at', { ascending: true })
      .limit(limit)

    if (fetchError) {
      console.error('[NotificationService] Failed to fetch retry queue:', fetchError)
      result.errors++
      return result
    }

    for (const row of (queuedRows || []) as NotificationRetryQueueRow[]) {
      const { data: claimedRow, error: claimError } = await this.supabase
        .from('notification_retry_queue')
        .update({
          status: 'processing',
          locked_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('status', 'queued')
        .select('id, organization_id, rule_id, channel_id, event_type, event_data, attempt_count, max_attempts, status')
        .maybeSingle<NotificationRetryQueueRow>()

      if (claimError) {
        console.error('[NotificationService] Failed to claim retry queue record:', claimError)
        result.errors++
        continue
      }

      if (!claimedRow) {
        continue
      }

      result.processed++

      const event = this.parseRetryEvent(claimedRow)
      if (!event || !claimedRow.rule_id || !claimedRow.channel_id) {
        await this.supabase
          .from('notification_retry_queue')
          .update({
            status: 'dead_letter',
            processed_at: new Date().toISOString(),
            locked_at: null,
            last_error: 'Invalid retry payload: missing event/rule/channel references',
          })
          .eq('id', claimedRow.id)
        result.dead_lettered++
        continue
      }

      const { data: rule } = await this.supabase
        .from('notification_rules')
        .select('*')
        .eq('id', claimedRow.rule_id)
        .maybeSingle<NotificationRule>()

      const { data: channel } = await this.supabase
        .from('notification_channels')
        .select('*')
        .eq('id', claimedRow.channel_id)
        .eq('is_enabled', true)
        .maybeSingle<NotificationChannel>()

      if (!rule || !channel) {
        await this.supabase
          .from('notification_retry_queue')
          .update({
            status: 'dead_letter',
            processed_at: new Date().toISOString(),
            locked_at: null,
            last_error: 'Retry target rule/channel no longer exists or is disabled',
          })
          .eq('id', claimedRow.id)
        result.dead_lettered++
        continue
      }

      const sendResult = await this.sendNotification(channel, rule, event)
      await this.logNotification(event, rule, channel, sendResult)

      const nextAttemptCount = claimedRow.attempt_count + 1
      if (sendResult.success) {
        await this.supabase
          .from('notification_retry_queue')
          .update({
            status: 'sent',
            attempt_count: nextAttemptCount,
            processed_at: new Date().toISOString(),
            locked_at: null,
            last_error: null,
          })
          .eq('id', claimedRow.id)
        result.sent++
        continue
      }

      const isFinalAttempt = nextAttemptCount >= claimedRow.max_attempts
      if (isFinalAttempt) {
        await this.supabase
          .from('notification_retry_queue')
          .update({
            status: 'dead_letter',
            attempt_count: nextAttemptCount,
            processed_at: new Date().toISOString(),
            locked_at: null,
            last_error: sendResult.error || 'Retry delivery failed',
          })
          .eq('id', claimedRow.id)
        result.dead_lettered++
        continue
      }

      const backoffSeconds = Math.min(
        60 * 60,
        NOTIFICATION_QUEUE_BASE_DELAY_SECONDS * 2 ** claimedRow.attempt_count
      )
      const nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000).toISOString()

      await this.supabase
        .from('notification_retry_queue')
        .update({
          status: 'queued',
          attempt_count: nextAttemptCount,
          next_attempt_at: nextAttemptAt,
          locked_at: null,
          last_error: sendResult.error || 'Retry delivery failed',
        })
        .eq('id', claimedRow.id)
      result.requeued++
    }

    return result
  }
}

// Singleton instance
let notificationService: NotificationService | null = null

export function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = new NotificationService()
  }
  return notificationService
}

/**
 * Helper function to trigger device status notifications
 */
export async function triggerDeviceNotification(
  organizationId: string,
  deviceId: string,
  deviceName: string,
  eventType: 'device.offline' | 'device.online' | 'device.degraded',
  data: Record<string, unknown> = {}
): Promise<void> {
  const service = getNotificationService()

  await service.trigger({
    type: eventType,
    organizationId,
    resourceType: 'device',
    resourceId: deviceId,
    resourceName: deviceName,
    data,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Helper function to trigger agent status notifications
 */
export async function triggerAgentNotification(
  organizationId: string,
  agentId: string,
  agentName: string,
  eventType: 'agent.offline' | 'agent.online',
  data: Record<string, unknown> = {}
): Promise<void> {
  const service = getNotificationService()

  await service.trigger({
    type: eventType,
    organizationId,
    resourceType: 'agent',
    resourceId: agentId,
    resourceName: agentName,
    data,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Helper function to trigger scan completion notifications
 */
export async function triggerScanCompleteNotification(
  organizationId: string,
  segmentId: string,
  segmentName: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const service = getNotificationService()

  await service.trigger({
    type: 'scan.complete',
    organizationId,
    resourceType: 'segment',
    resourceId: segmentId,
    resourceName: segmentName,
    data,
    timestamp: new Date().toISOString(),
  })
}

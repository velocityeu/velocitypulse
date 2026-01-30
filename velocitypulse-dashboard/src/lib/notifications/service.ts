import { createServiceClient } from '@/lib/db/client'
import type {
  NotificationChannel,
  NotificationRule,
  NotificationEventType,
  NotificationHistory,
} from '@/types'
import type { NotificationEvent, NotificationResult } from './types'
import { sendEmailNotification } from './senders/email'
import { sendSlackNotification } from './senders/slack'
import { sendTeamsNotification } from './senders/teams'
import { sendWebhookNotification } from './senders/webhook'

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

    try {
      switch (channel.channel_type) {
        case 'email':
          return await sendEmailNotification(payload)
        case 'slack':
          return await sendSlackNotification(payload)
        case 'teams':
          return await sendTeamsNotification(payload)
        case 'webhook':
          return await sendWebhookNotification(payload)
        default:
          return {
            success: false,
            channelId: channel.id,
            error: `Unknown channel type: ${channel.channel_type}`,
          }
      }
    } catch (error) {
      return {
        success: false,
        channelId: channel.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
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

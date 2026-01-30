import type { NotificationPayload, NotificationResult } from '../types'
import type { WebhookChannelConfig } from '@/types'

/**
 * Send notification via generic webhook
 * Sends JSON payload to configured URL
 */
export async function sendWebhookNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  const config = payload.channel.config as WebhookChannelConfig

  if (!config.url) {
    return {
      success: false,
      channelId: payload.channel.id,
      error: 'Webhook URL not configured',
    }
  }

  const { event } = payload
  const webhookPayload = {
    event_type: event.type,
    timestamp: event.timestamp,
    resource: {
      type: event.resourceType,
      id: event.resourceId,
      name: event.resourceName,
    },
    data: event.data,
    metadata: {
      rule_id: payload.rule.id,
      rule_name: payload.rule.name,
      channel_id: payload.channel.id,
      channel_name: payload.channel.name,
    },
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'VelocityPulse-Webhook/1.0',
      ...(config.headers || {}),
    }

    const response = await fetch(config.url, {
      method: config.method || 'POST',
      headers,
      body: config.method === 'GET' ? undefined : JSON.stringify(webhookPayload),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Webhook error (${response.status}): ${error.substring(0, 200)}`)
    }

    return {
      success: true,
      channelId: payload.channel.id,
    }
  } catch (error) {
    return {
      success: false,
      channelId: payload.channel.id,
      error: error instanceof Error ? error.message : 'Failed to send webhook',
    }
  }
}

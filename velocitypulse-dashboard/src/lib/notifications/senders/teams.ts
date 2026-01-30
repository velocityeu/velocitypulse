import type { NotificationPayload, NotificationResult } from '../types'
import type { TeamsChannelConfig } from '@/types'

/**
 * Send notification via Microsoft Teams webhook
 * Uses Adaptive Cards format
 */
export async function sendTeamsNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  const config = payload.channel.config as TeamsChannelConfig

  if (!config.webhook_url) {
    return {
      success: false,
      channelId: payload.channel.id,
      error: 'Teams webhook URL not configured',
    }
  }

  const teamsMessage = buildTeamsMessage(payload)

  try {
    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(teamsMessage),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Teams webhook error: ${error}`)
    }

    return {
      success: true,
      channelId: payload.channel.id,
    }
  } catch (error) {
    return {
      success: false,
      channelId: payload.channel.id,
      error: error instanceof Error ? error.message : 'Failed to send Teams notification',
    }
  }
}

function buildTeamsMessage(payload: NotificationPayload) {
  const { event } = payload
  const color = getTeamsColor(event.type)
  const title = getTeamsTitle(event.type, event.resourceName)

  // Adaptive Card format for Teams
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        contentUrl: null,
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'Container',
              style: color === '#dc2626' ? 'attention' : color === '#16a34a' ? 'good' : 'warning',
              items: [
                {
                  type: 'TextBlock',
                  text: title,
                  weight: 'Bolder',
                  size: 'Medium',
                  wrap: true,
                },
              ],
            },
            {
              type: 'FactSet',
              facts: [
                {
                  title: 'Resource',
                  value: event.resourceName,
                },
                {
                  title: 'Type',
                  value: event.resourceType,
                },
                ...(event.data.ip_address
                  ? [
                      {
                        title: 'IP Address',
                        value: event.data.ip_address as string,
                      },
                    ]
                  : []),
                {
                  title: 'Time',
                  value: new Date(event.timestamp).toLocaleString(),
                },
              ],
            },
            {
              type: 'TextBlock',
              text: 'Sent by [VelocityPulse](https://velocitypulse.io)',
              size: 'Small',
              isSubtle: true,
              wrap: true,
            },
          ],
        },
      },
    ],
  }
}

function getTeamsColor(eventType: string): string {
  switch (eventType) {
    case 'device.offline':
    case 'agent.offline':
      return '#dc2626' // red
    case 'device.online':
    case 'agent.online':
      return '#16a34a' // green
    case 'device.degraded':
      return '#d97706' // amber
    default:
      return '#2563eb' // blue
  }
}

function getTeamsTitle(eventType: string, resourceName: string): string {
  switch (eventType) {
    case 'device.offline':
      return `🔴 Device Offline: ${resourceName}`
    case 'device.online':
      return `🟢 Device Online: ${resourceName}`
    case 'device.degraded':
      return `🟡 Device Degraded: ${resourceName}`
    case 'agent.offline':
      return `🔴 Agent Offline: ${resourceName}`
    case 'agent.online':
      return `🟢 Agent Online: ${resourceName}`
    case 'scan.complete':
      return '🔍 Network Scan Complete'
    default:
      return '🔔 VelocityPulse Notification'
  }
}

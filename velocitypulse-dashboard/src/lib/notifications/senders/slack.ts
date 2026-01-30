import type { NotificationPayload, NotificationResult } from '../types'
import type { SlackChannelConfig } from '@/types'

/**
 * Send notification via Slack webhook
 */
export async function sendSlackNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  const config = payload.channel.config as SlackChannelConfig

  if (!config.webhook_url) {
    return {
      success: false,
      channelId: payload.channel.id,
      error: 'Slack webhook URL not configured',
    }
  }

  const { event } = payload
  const slackMessage = buildSlackMessage(payload)

  try {
    const response = await fetch(config.webhook_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(slackMessage),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Slack webhook error: ${error}`)
    }

    return {
      success: true,
      channelId: payload.channel.id,
    }
  } catch (error) {
    return {
      success: false,
      channelId: payload.channel.id,
      error: error instanceof Error ? error.message : 'Failed to send Slack notification',
    }
  }
}

function buildSlackMessage(payload: NotificationPayload) {
  const { event } = payload
  const color = getSlackColor(event.type)
  const emoji = getSlackEmoji(event.type)
  const title = getSlackTitle(event.type, event.resourceName)

  return {
    attachments: [
      {
        color,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `${emoji} ${title}`,
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Resource:*\n${event.resourceName}`,
              },
              {
                type: 'mrkdwn',
                text: `*Type:*\n${event.resourceType}`,
              },
              ...(event.data.ip_address
                ? [
                    {
                      type: 'mrkdwn',
                      text: `*IP Address:*\n\`${event.data.ip_address}\``,
                    },
                  ]
                : []),
              {
                type: 'mrkdwn',
                text: `*Time:*\n<!date^${Math.floor(new Date(event.timestamp).getTime() / 1000)}^{date_short_pretty} at {time}|${event.timestamp}>`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'Sent by <https://velocitypulse.io|VelocityPulse>',
              },
            ],
          },
        ],
      },
    ],
  }
}

function getSlackColor(eventType: string): string {
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

function getSlackEmoji(eventType: string): string {
  switch (eventType) {
    case 'device.offline':
    case 'agent.offline':
      return ':red_circle:'
    case 'device.online':
    case 'agent.online':
      return ':large_green_circle:'
    case 'device.degraded':
      return ':large_yellow_circle:'
    case 'scan.complete':
      return ':mag:'
    default:
      return ':bell:'
  }
}

function getSlackTitle(eventType: string, resourceName: string): string {
  switch (eventType) {
    case 'device.offline':
      return `Device Offline: ${resourceName}`
    case 'device.online':
      return `Device Online: ${resourceName}`
    case 'device.degraded':
      return `Device Degraded: ${resourceName}`
    case 'agent.offline':
      return `Agent Offline: ${resourceName}`
    case 'agent.online':
      return `Agent Online: ${resourceName}`
    case 'scan.complete':
      return 'Network Scan Complete'
    default:
      return 'VelocityPulse Notification'
  }
}

import type { NotificationPayload, NotificationResult } from '../types'
import type { EmailChannelConfig } from '@/types'

/**
 * Send notification via email
 * Uses Resend API (configure RESEND_API_KEY env var)
 */
export async function sendEmailNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  const config = payload.channel.config as EmailChannelConfig

  if (!config.recipients || config.recipients.length === 0) {
    return {
      success: false,
      channelId: payload.channel.id,
      error: 'No email recipients configured',
    }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[EmailNotification] RESEND_API_KEY not configured')
    return {
      success: false,
      channelId: payload.channel.id,
      error: 'Email service not configured',
    }
  }

  const { event } = payload
  const subject = getEmailSubject(event.type, event.resourceName)
  const html = getEmailHtml(payload)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'VelocityPulse <alerts@velocitypulse.io>',
        to: config.recipients,
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Resend API error: ${error}`)
    }

    return {
      success: true,
      channelId: payload.channel.id,
    }
  } catch (error) {
    return {
      success: false,
      channelId: payload.channel.id,
      error: error instanceof Error ? error.message : 'Failed to send email',
    }
  }
}

function getEmailSubject(eventType: string, resourceName: string): string {
  switch (eventType) {
    case 'device.offline':
      return `[Alert] Device Offline: ${resourceName}`
    case 'device.online':
      return `[Resolved] Device Online: ${resourceName}`
    case 'device.degraded':
      return `[Warning] Device Degraded: ${resourceName}`
    case 'agent.offline':
      return `[Alert] Agent Offline: ${resourceName}`
    case 'agent.online':
      return `[Resolved] Agent Online: ${resourceName}`
    case 'scan.complete':
      return `[Info] Network Scan Complete`
    default:
      return `[VelocityPulse] Notification`
  }
}

function getEmailHtml(payload: NotificationPayload): string {
  const { event } = payload
  const statusColor = getStatusColor(event.type)
  const statusText = getStatusText(event.type)

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    <div style="background-color: ${statusColor}; padding: 20px; color: white;">
      <h1 style="margin: 0; font-size: 20px;">${statusText}</h1>
    </div>
    <div style="padding: 20px;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Resource:</td>
          <td style="padding: 8px 0; font-weight: 500;">${event.resourceName}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Type:</td>
          <td style="padding: 8px 0;">${event.resourceType}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Time:</td>
          <td style="padding: 8px 0;">${new Date(event.timestamp).toLocaleString()}</td>
        </tr>
        ${event.data.ip_address ? `
        <tr>
          <td style="padding: 8px 0; color: #666;">IP Address:</td>
          <td style="padding: 8px 0; font-family: monospace;">${event.data.ip_address}</td>
        </tr>
        ` : ''}
      </table>
    </div>
    <div style="padding: 15px 20px; background-color: #f9f9f9; border-top: 1px solid #eee; font-size: 12px; color: #666;">
      Sent by <a href="https://velocitypulse.io" style="color: #2563eb; text-decoration: none;">VelocityPulse</a>
    </div>
  </div>
</body>
</html>
  `
}

function getStatusColor(eventType: string): string {
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

function getStatusText(eventType: string): string {
  switch (eventType) {
    case 'device.offline':
      return 'Device Offline'
    case 'device.online':
      return 'Device Back Online'
    case 'device.degraded':
      return 'Device Performance Degraded'
    case 'agent.offline':
      return 'Agent Offline'
    case 'agent.online':
      return 'Agent Back Online'
    case 'scan.complete':
      return 'Network Scan Complete'
    default:
      return 'Notification'
  }
}

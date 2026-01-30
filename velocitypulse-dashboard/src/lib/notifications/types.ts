import type {
  NotificationChannel,
  NotificationRule,
  NotificationEventType,
  NotificationChannelConfig,
} from '@/types'

export interface NotificationEvent {
  type: NotificationEventType
  organizationId: string
  resourceType: 'device' | 'agent'
  resourceId: string
  resourceName: string
  data: Record<string, unknown>
  timestamp: string
}

export interface NotificationPayload {
  event: NotificationEvent
  rule: NotificationRule
  channel: NotificationChannel
}

export interface NotificationResult {
  success: boolean
  channelId: string
  error?: string
}

export interface NotificationSender {
  send(payload: NotificationPayload): Promise<NotificationResult>
}

export function getChannelConfig<T extends NotificationChannelConfig>(
  channel: NotificationChannel
): T {
  return channel.config as T
}

import { z } from 'zod'
import type {
  EmailChannelConfig,
  NotificationChannelConfig,
  NotificationChannelType,
  SlackChannelConfig,
  TeamsChannelConfig,
  WebhookChannelConfig,
} from '@/types'

const emailConfigSchema = z.object({
  recipients: z.array(z.string().email('Invalid recipient email')).min(1, 'At least one recipient is required'),
})

const slackConfigSchema = z.object({
  webhook_url: z.string().url('Invalid Slack webhook URL'),
  channel_name: z.string().min(1).max(120).optional(),
})

const teamsConfigSchema = z.object({
  webhook_url: z.string().url('Invalid Teams webhook URL'),
  channel_name: z.string().min(1).max(120).optional(),
})

const webhookConfigSchema = z.object({
  url: z.string().url('Invalid webhook URL'),
  method: z.enum(['POST', 'GET']).default('POST'),
  headers: z.record(z.string(), z.string()).optional(),
})

function formatValidationError(error: z.ZodError) {
  return {
    error: 'Validation failed',
    code: 'VALIDATION_ERROR' as const,
    details: error.issues.map(issue => ({
      field: issue.path.join('.'),
      message: issue.message,
    })),
  }
}

export function validateNotificationChannelConfig(
  channelType: NotificationChannelType,
  config: unknown
): { success: true; data: NotificationChannelConfig } | { success: false; error: ReturnType<typeof formatValidationError> } {
  if (channelType === 'email') {
    const result = emailConfigSchema.safeParse(config)
    if (!result.success) return { success: false, error: formatValidationError(result.error) }

    const normalized: EmailChannelConfig = {
      type: 'email',
      recipients: result.data.recipients,
    }
    return { success: true, data: normalized }
  }

  if (channelType === 'slack') {
    const result = slackConfigSchema.safeParse(config)
    if (!result.success) return { success: false, error: formatValidationError(result.error) }

    const normalized: SlackChannelConfig = {
      type: 'slack',
      webhook_url: result.data.webhook_url,
      channel_name: result.data.channel_name,
    }
    return { success: true, data: normalized }
  }

  if (channelType === 'teams') {
    const result = teamsConfigSchema.safeParse(config)
    if (!result.success) return { success: false, error: formatValidationError(result.error) }

    const normalized: TeamsChannelConfig = {
      type: 'teams',
      webhook_url: result.data.webhook_url,
      channel_name: result.data.channel_name,
    }
    return { success: true, data: normalized }
  }

  const result = webhookConfigSchema.safeParse(config)
  if (!result.success) return { success: false, error: formatValidationError(result.error) }

  const normalized: WebhookChannelConfig = {
    type: 'webhook',
    url: result.data.url,
    method: result.data.method,
    headers: result.data.headers,
  }
  return { success: true, data: normalized }
}

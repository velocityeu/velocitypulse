import { z } from 'zod'

// Agent creation
export const createAgentSchema = z.object({
  name: z.string().min(1, 'Agent name is required').max(100),
  description: z.string().max(500).optional(),
})

// Device creation
export const createDeviceSchema = z.object({
  name: z.string().min(1, 'Device name is required').max(200),
  ip_address: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, 'Invalid IP address').optional(),
  url: z.string().url().optional(),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  check_type: z.enum(['ping', 'http', 'tcp']).default('ping'),
  category_id: z.string().uuid().nullable().optional(),
  description: z.string().max(500).optional(),
})

// Category creation
export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(500).optional(),
  icon: z.string().default('box'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').default('#6B7280'),
})

// Heartbeat request
export const heartbeatRequestSchema = z.object({
  version: z.string().optional(),
  hostname: z.string().optional(),
  uptime_seconds: z.number().optional(),
})

// Status report
export const statusReportSchema = z.object({
  reports: z.array(z.object({
    device_id: z.string().optional(),
    ip_address: z.string().optional(),
    status: z.enum(['online', 'offline', 'degraded', 'unknown']),
    response_time_ms: z.number().nullable(),
    check_type: z.enum(['ping', 'http', 'tcp']).default('ping'),
    checked_at: z.string(),
    error: z.string().optional(),
  })).min(1, 'At least one report is required'),
})

// Notification rule
export const createNotificationRuleSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  event_type: z.enum(['device.offline', 'device.online', 'device.degraded', 'agent.offline', 'agent.online', 'scan.complete']),
  channel_ids: z.array(z.string().uuid()).min(1, 'At least one channel is required'),
  filters: z.object({
    category_ids: z.array(z.string().uuid()).optional(),
    device_ids: z.array(z.string().uuid()).optional(),
    agent_ids: z.array(z.string().uuid()).optional(),
    segment_ids: z.array(z.string().uuid()).optional(),
  }).optional(),
  is_enabled: z.boolean().default(true),
  cooldown_minutes: z.number().int().min(0).max(1440).default(5),
})

// Onboarding
export const onboardingSchema = z.object({
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters').max(200),
  referralCode: z.string().max(50).optional(),
})

// Validation helper
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: ReturnType<typeof formatValidationError> } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, error: formatValidationError(result.error) }
}

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

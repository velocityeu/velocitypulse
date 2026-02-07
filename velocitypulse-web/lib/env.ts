import { z } from 'zod'

// Server-side environment variables schema
const serverEnvSchema = z.object({
  // Stripe (required for payments)
  STRIPE_SECRET_KEY: z
    .string()
    .min(1, 'STRIPE_SECRET_KEY is required')
    .startsWith('sk_', 'STRIPE_SECRET_KEY must start with sk_'),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(1, 'STRIPE_WEBHOOK_SECRET is required')
    .startsWith('whsec_', 'STRIPE_WEBHOOK_SECRET must start with whsec_'),
  STRIPE_PRICE_STARTER: z
    .string()
    .min(1, 'STRIPE_PRICE_STARTER is required')
    .startsWith('price_', 'STRIPE_PRICE_STARTER must start with price_'),
  STRIPE_PRICE_UNLIMITED: z
    .string()
    .min(1, 'STRIPE_PRICE_UNLIMITED is required')
    .startsWith('price_', 'STRIPE_PRICE_UNLIMITED must start with price_'),

  // Resend (optional - for form submission emails)
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().optional(),
  RESEND_TEAM_EMAIL: z.string().optional(),

  // Supabase (optional - for storing form submissions)
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  // Zoho (optional - placeholder for future integration)
  ZOHO_ACCESS_TOKEN: z.string().optional(),
  ZOHO_ORG_ID: z.string().optional(),
})

// Client-side environment variables schema
const clientEnvSchema = z.object({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is required')
    .startsWith('pk_', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY must start with pk_'),
})

// Type definitions
export type ServerEnv = z.infer<typeof serverEnvSchema>
export type ClientEnv = z.infer<typeof clientEnvSchema>

// Validated environment objects
let serverEnvCache: ServerEnv | null = null
let clientEnvCache: ClientEnv | null = null

/**
 * Get validated server-side environment variables.
 * Throws an error if required variables are missing.
 * Call this in API routes or server components.
 */
export function getServerEnv(): ServerEnv {
  if (serverEnvCache) return serverEnvCache

  const result = serverEnvSchema.safeParse({
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_STARTER: process.env.STRIPE_PRICE_STARTER,
    STRIPE_PRICE_UNLIMITED: process.env.STRIPE_PRICE_UNLIMITED,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    RESEND_TEAM_EMAIL: process.env.RESEND_TEAM_EMAIL,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ZOHO_ACCESS_TOKEN: process.env.ZOHO_ACCESS_TOKEN,
    ZOHO_ORG_ID: process.env.ZOHO_ORG_ID,
  })

  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    throw new Error(
      `Missing or invalid environment variables:\n${missing}\n\n` +
        'Please check your .env.local file or deployment configuration.'
    )
  }

  serverEnvCache = result.data
  return serverEnvCache
}

/**
 * Get validated client-side environment variables.
 * Throws an error if required variables are missing.
 * Safe to call in client components.
 */
export function getClientEnv(): ClientEnv {
  if (clientEnvCache) return clientEnvCache

  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  })

  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    throw new Error(
      `Missing or invalid client environment variables:\n${missing}\n\n` +
        'Please check your .env.local file or deployment configuration.'
    )
  }

  clientEnvCache = result.data
  return clientEnvCache
}

/**
 * Check if Zoho integration is configured.
 * Returns false if Zoho credentials are not set.
 */
export function isZohoConfigured(): boolean {
  return !!(process.env.ZOHO_ACCESS_TOKEN && process.env.ZOHO_ORG_ID)
}

/**
 * Check if Resend email is configured.
 */
export function isResendConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

/**
 * Check if Supabase is configured for the marketing site.
 */
export function isSupabaseConfigured(): boolean {
  return !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/**
 * Check if we're in development mode.
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development'
}

/**
 * Check if we're in production mode.
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

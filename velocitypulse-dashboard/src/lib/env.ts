import { z } from 'zod'

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1).url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().min(1).startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).startsWith('whsec_'),
  RESEND_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
})

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1).url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>
export type ClientEnv = z.infer<typeof clientEnvSchema>

let serverEnvCache: ServerEnv | null = null
let clientEnvCache: ClientEnv | null = null

export function getServerEnv(): ServerEnv {
  if (serverEnvCache) return serverEnvCache
  const result = serverEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    SENTRY_DSN: process.env.SENTRY_DSN,
  })
  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Missing or invalid environment variables:\n${missing}`)
  }
  serverEnvCache = result.data
  return serverEnvCache
}

export function getClientEnv(): ClientEnv {
  if (clientEnvCache) return clientEnvCache
  const result = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
  if (!result.success) {
    const missing = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Missing or invalid client environment variables:\n${missing}`)
  }
  clientEnvCache = result.data
  return clientEnvCache
}

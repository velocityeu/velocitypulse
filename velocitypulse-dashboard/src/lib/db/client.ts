import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getClientEnv, getServerEnv } from '@/lib/env'

// Singleton for server-side admin operations
let adminClient: SupabaseClient | null = null

/**
 * Get Supabase admin client for server-side operations
 * Uses service role key to bypass RLS - for admin/internal APIs only
 */
export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient

  const env = getServerEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  adminClient = createClient(supabaseUrl, serviceRoleKey)
  return adminClient
}

// Export singleton for convenience in API routes
export const supabase = {
  from: (table: string) => getAdminClient().from(table),
}

// Singleton for browser-side client
let browserClient: SupabaseClient | null = null

/**
 * Create Supabase client for client-side usage
 * Uses anon key with RLS enforced
 * Returns a singleton to avoid multiple GoTrueClient instances
 */
export function createBrowserClient() {
  if (browserClient) return browserClient

  const env = getClientEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  browserClient = createClient(supabaseUrl, supabaseAnonKey)
  return browserClient
}

/**
 * Create Supabase client for server-side usage with service role
 * Delegates to getAdminClient() singleton to avoid creating multiple clients
 */
export function createServiceClient(): SupabaseClient {
  return getAdminClient()
}

/**
 * Create Supabase client scoped to an organization
 * Sets the organization context for RLS policies
 */
export function createOrgScopedClient(organizationId: string) {
  const env = getClientEnv()
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        'x-organization-id': organizationId,
      },
    },
  })

  return client
}

import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton for server-side admin operations
let adminClient: SupabaseClient | null = null

/**
 * Get Supabase admin client for server-side operations
 * Uses service role key to bypass RLS - for admin/internal APIs only
 *
 * In production: throws if credentials are missing
 * In development: returns placeholder client with warning (will fail on actual DB calls)
 */
export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const isProduction = process.env.NODE_ENV === 'production'

  if (!supabaseUrl || !serviceRoleKey) {
    if (isProduction) {
      throw new Error(
        'Supabase credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.'
      )
    }

    // Development only: return a placeholder that will fail gracefully
    console.warn(
      '[Supabase] Admin client not configured - using placeholder. DB operations will fail.'
    )
    return createClient(
      'https://placeholder.supabase.co',
      'placeholder-key'
    )
  }

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables not configured')
  }

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables not configured')
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        'x-organization-id': organizationId,
      },
    },
  })

  return client
}

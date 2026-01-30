import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Singleton for server-side admin operations
let adminClient: SupabaseClient | null = null

/**
 * Get Supabase admin client for server-side operations
 * Uses service role key to bypass RLS - for admin/internal APIs only
 */
export function getAdminClient(): SupabaseClient {
  if (adminClient) return adminClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // In development without credentials, return a mock-like client that won't throw
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('Supabase admin client not configured - using placeholder')
    // Return a placeholder that will be caught by error handling
    return createClient(
      supabaseUrl || 'https://placeholder.supabase.co',
      serviceRoleKey || 'placeholder-key'
    )
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey)
  return adminClient
}

// Export singleton for convenience in API routes
export const supabase = {
  from: (table: string) => getAdminClient().from(table),
}

/**
 * Create Supabase client for client-side usage
 * Uses anon key with RLS enforced
 */
export function createBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase environment variables not configured')
  }

  return createClient(supabaseUrl, supabaseAnonKey)
}

/**
 * Create Supabase client for server-side usage with service role
 * Bypasses RLS - use carefully
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role not configured')
  }

  return createClient(supabaseUrl, serviceRoleKey)
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

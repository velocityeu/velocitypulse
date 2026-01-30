import { createServiceClient } from '@/lib/db/client'

export interface Organization {
  id: string
  name: string
  slug: string
  plan: string
  trial_ends_at: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}

/**
 * Get the organization for a user by their Clerk user ID
 * Returns the first organization the user is a member of
 */
export async function getOrganizationForUser(userId: string): Promise<Organization | null> {
  const supabase = createServiceClient()

  // Get user's organization membership
  const { data: membership, error: memberError } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (memberError || !membership) {
    return null
  }

  // Get the organization details
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', membership.organization_id)
    .single()

  if (orgError || !org) {
    return null
  }

  return org as Organization
}

/**
 * Get the organization ID for a user (lighter weight query)
 */
export async function getOrganizationIdForUser(userId: string): Promise<string | null> {
  const supabase = createServiceClient()

  const { data: membership, error } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (error || !membership) {
    return null
  }

  return membership.organization_id
}

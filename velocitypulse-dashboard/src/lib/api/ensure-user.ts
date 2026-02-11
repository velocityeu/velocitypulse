import { currentUser } from '@clerk/nextjs/server'
import { getAdminClient } from '@/lib/db/client'
import type { User } from '@/types'

/**
 * Ensure a user record exists in the DB for the given userId.
 * - First checks the `users` table (fast path, no Clerk API call)
 * - If missing (webhook race condition), falls back to Clerk's currentUser()
 *   to seed the record on the fly
 *
 * This is the ONLY place currentUser() should be called after the refactor.
 */
export async function ensureUserInDb(userId: string): Promise<User | null> {
  const supabase = getAdminClient()

  // Fast path: user already in DB
  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (existing) return existing as User

  // Slow path: webhook hasn't fired yet — seed from Clerk
  try {
    const clerkUser = await currentUser()
    if (!clerkUser) return null

    const email = clerkUser.emailAddresses[0]?.emailAddress
    if (!email) return null

    const isStaff =
      (clerkUser.publicMetadata as { role?: string })?.role === 'staff' ||
      (clerkUser.publicMetadata as { role?: string })?.role === 'admin'

    const { data: newUser, error } = await supabase
      .from('users')
      .upsert(
        {
          id: clerkUser.id,
          email,
          first_name: clerkUser.firstName ?? null,
          last_name: clerkUser.lastName ?? null,
          image_url: clerkUser.imageUrl ?? null,
          is_staff: isStaff,
        },
        { onConflict: 'id' }
      )
      .select()
      .single()

    if (error) {
      console.error('ensureUserInDb: failed to upsert user', error)
      return null
    }

    return newUser as User
  } catch (err) {
    console.error('ensureUserInDb: Clerk fallback failed', err)
    return null
  }
}

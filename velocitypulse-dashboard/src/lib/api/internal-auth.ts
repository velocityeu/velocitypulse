import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/client'

/**
 * Verify the current user has internal/staff access.
 * Staff status is stored in the Supabase `users.is_staff` column,
 * synced from Clerk publicMetadata via the Clerk webhook.
 *
 * Development bypass requires ALLOW_DEV_BYPASS=true to be explicitly set.
 */
export async function verifyInternalAccess(): Promise<{
  authorized: boolean
  userId?: string
  email?: string
  error?: NextResponse
}> {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const allowDevBypass = process.env.ALLOW_DEV_BYPASS === 'true'

  try {
    const { userId } = await auth()

    if (!userId) {
      if (isDevelopment && allowDevBypass) {
        console.warn('[Internal Auth] Dev bypass: allowing unauthenticated access')
        return {
          authorized: true,
          userId: 'dev-user',
          email: 'dev@velocitypulse.io',
        }
      }

      return {
        authorized: false,
        error: NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        ),
      }
    }

    // Check staff status from Supabase users table
    const supabase = createServiceClient()
    const { data: user } = await supabase
      .from('users')
      .select('email, is_staff')
      .eq('id', userId)
      .single()

    const isStaff = user?.is_staff === true

    if (!isStaff && isDevelopment && allowDevBypass) {
      console.warn(`[Internal Auth] Dev bypass: granting staff access to user ${userId}`)
      return {
        authorized: true,
        userId,
        email: user?.email,
      }
    }

    if (!isStaff) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        ),
      }
    }

    return {
      authorized: true,
      userId,
      email: user?.email,
    }
  } catch (error) {
    console.error('Internal auth error:', error)

    if (isDevelopment && allowDevBypass) {
      console.warn('[Internal Auth] Dev bypass: allowing access despite auth error')
      return {
        authorized: true,
        userId: 'dev-user',
        email: 'dev@velocitypulse.io',
      }
    }

    return {
      authorized: false,
      error: NextResponse.json(
        { error: 'Authentication error' },
        { status: 500 }
      ),
    }
  }
}

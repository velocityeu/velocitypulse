import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Verify the current user has internal/staff access
 * Staff users are identified by:
 * 1. Being in the 'staff' organization in Clerk
 * 2. Having publicMetadata.role === 'staff' or 'admin'
 *
 * Development bypass requires ALLOW_DEV_BYPASS=true to be explicitly set
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
      // In development with explicit bypass, allow anonymous access
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

    const user = await currentUser()

    if (!user) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: 'User not found' },
          { status: 401 }
        ),
      }
    }

    // Check for staff role in public metadata
    const metadata = user.publicMetadata as { role?: string } | undefined
    const isStaff = metadata?.role === 'staff' || metadata?.role === 'admin'

    // In development with explicit bypass, allow non-staff users
    if (!isStaff && isDevelopment && allowDevBypass) {
      console.warn(`[Internal Auth] Dev bypass: granting staff access to user ${user.id}`)
      return {
        authorized: true,
        userId: user.id,
        email: user.emailAddresses[0]?.emailAddress,
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
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress,
    }
  } catch (error) {
    console.error('Internal auth error:', error)

    // In development with explicit bypass, allow access even if auth fails
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

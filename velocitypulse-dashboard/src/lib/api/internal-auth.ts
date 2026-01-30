import { auth, currentUser } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

/**
 * Verify the current user has internal/staff access
 * Staff users are identified by:
 * 1. Being in the 'staff' organization in Clerk
 * 2. Having publicMetadata.role === 'staff' or 'admin'
 */
export async function verifyInternalAccess(): Promise<{
  authorized: boolean
  userId?: string
  email?: string
  error?: NextResponse
}> {
  try {
    const { userId } = await auth()

    if (!userId) {
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

    // For development, allow access if no role is set (will be restricted in production)
    const isDevelopment = process.env.NODE_ENV === 'development'

    if (!isStaff && !isDevelopment) {
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

    // In development, allow access even if Clerk is not configured
    if (process.env.NODE_ENV === 'development') {
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

import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/client'
import type { AdminRole } from '@/types'

interface InternalAccessResult {
  authorized: boolean
  userId?: string
  email?: string
  adminRole?: AdminRole
  error?: NextResponse
}

/**
 * Verify the current user has internal/staff access.
 * Staff status is stored in the Supabase `users.is_staff` column,
 * synced from Clerk publicMetadata via the Clerk webhook.
 * Admin role is resolved from the `admin_roles` table (defaults to super_admin for staff without a row).
 *
 * Development bypass requires ALLOW_DEV_BYPASS=true to be explicitly set.
 */
export async function verifyInternalAccess(): Promise<InternalAccessResult> {
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
          adminRole: 'super_admin',
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
        adminRole: 'super_admin',
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

    // Resolve admin role from admin_roles table
    // Staff users without an admin_roles row default to super_admin (backward compat)
    const { data: adminRoleRow } = await supabase
      .from('admin_roles')
      .select('role, is_active')
      .eq('user_id', userId)
      .single()

    let adminRole: AdminRole = 'super_admin'
    if (adminRoleRow) {
      if (!adminRoleRow.is_active) {
        return {
          authorized: false,
          error: NextResponse.json(
            { error: 'Admin access has been disabled' },
            { status: 403 }
          ),
        }
      }
      adminRole = adminRoleRow.role as AdminRole
    }

    return {
      authorized: true,
      userId,
      email: user?.email,
      adminRole,
    }
  } catch (error) {
    console.error('Internal auth error:', error)

    if (isDevelopment && allowDevBypass) {
      console.warn('[Internal Auth] Dev bypass: allowing access despite auth error')
      return {
        authorized: true,
        userId: 'dev-user',
        email: 'dev@velocitypulse.io',
        adminRole: 'super_admin',
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

/**
 * Check if the admin has the required role level.
 * Role hierarchy: super_admin > billing_admin > support_admin > viewer
 */
export function hasAdminRole(
  currentRole: AdminRole | undefined,
  requiredRole: AdminRole
): boolean {
  const roleHierarchy: Record<AdminRole, number> = {
    super_admin: 4,
    billing_admin: 3,
    support_admin: 2,
    viewer: 1,
  }
  if (!currentRole) return false
  return roleHierarchy[currentRole] >= roleHierarchy[requiredRole]
}

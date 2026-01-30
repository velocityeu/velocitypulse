import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { NextResponse } from 'next/server'
import type { MemberPermissions, MemberRole } from '@/types'

export interface UserContext {
  userId: string
  email?: string
  organizationId: string
  role: MemberRole
  permissions: MemberPermissions
}

export interface AuthResult {
  authorized: boolean
  context?: UserContext
  error?: NextResponse
}

/**
 * Authenticate a user and verify they belong to the specified organization
 * Returns user context with role and permissions
 */
export async function authenticateUser(
  organizationId: string
): Promise<AuthResult> {
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
    const supabase = createServiceClient()

    // Get user's membership in this organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('role, permissions')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .single()

    if (memberError || !membership) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: 'Not a member of this organization' },
          { status: 403 }
        ),
      }
    }

    // Check organization is active
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('status')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        ),
      }
    }

    if (org.status === 'suspended' || org.status === 'cancelled') {
      return {
        authorized: false,
        error: NextResponse.json(
          { error: 'Organization is suspended or cancelled' },
          { status: 403 }
        ),
      }
    }

    return {
      authorized: true,
      context: {
        userId,
        email: user?.emailAddresses[0]?.emailAddress,
        organizationId,
        role: membership.role as MemberRole,
        permissions: membership.permissions as MemberPermissions,
      },
    }
  } catch (error) {
    console.error('User auth error:', error)
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
 * Check if user has permission to manage agents
 */
export function canManageAgents(context: UserContext): boolean {
  return (
    context.role === 'owner' ||
    context.role === 'admin' ||
    context.permissions.can_manage_agents === true
  )
}

/**
 * Check if user has permission to manage devices
 */
export function canManageDevices(context: UserContext): boolean {
  return (
    context.role === 'owner' ||
    context.role === 'admin' ||
    context.role === 'editor' ||
    context.permissions.can_manage_devices === true
  )
}

/**
 * Check if user has permission to manage members
 */
export function canManageMembers(context: UserContext): boolean {
  return (
    context.role === 'owner' ||
    context.role === 'admin' ||
    context.permissions.can_manage_members === true
  )
}

/**
 * Check if user has permission to manage billing
 */
export function canManageBilling(context: UserContext): boolean {
  return (
    context.role === 'owner' ||
    context.role === 'admin' ||
    context.permissions.can_manage_billing === true
  )
}

/**
 * Check if user has permission to view audit logs
 */
export function canViewAuditLogs(context: UserContext): boolean {
  return (
    context.role === 'owner' ||
    context.role === 'admin' ||
    context.permissions.can_view_audit_logs === true
  )
}

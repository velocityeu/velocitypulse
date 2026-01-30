import { NextRequest, NextResponse } from 'next/server'
import { auth, clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS } from '@/lib/constants'
import type { MemberRole, MemberPermissions } from '@/types'

// Default permissions by role
const DEFAULT_PERMISSIONS: Record<MemberRole, MemberPermissions> = {
  owner: {
    can_manage_billing: true,
    can_manage_agents: true,
    can_manage_devices: true,
    can_manage_members: true,
    can_view_audit_logs: true,
  },
  admin: {
    can_manage_billing: false,
    can_manage_agents: true,
    can_manage_devices: true,
    can_manage_members: true,
    can_view_audit_logs: true,
  },
  editor: {
    can_manage_billing: false,
    can_manage_agents: false,
    can_manage_devices: true,
    can_manage_members: false,
    can_view_audit_logs: false,
  },
  viewer: {
    can_manage_billing: false,
    can_manage_agents: false,
    can_manage_devices: false,
    can_manage_members: false,
    can_view_audit_logs: false,
  },
}

/**
 * GET /api/dashboard/members
 * Get all members of the organization
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get user's organization
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Get all members of the organization
    const { data: members, error: membersError } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', membership.organization_id)
      .order('created_at')

    if (membersError) {
      console.error('Failed to fetch members:', membersError)
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
    }

    // Get Clerk user details for each member
    const clerk = await clerkClient()
    const membersWithUserData = await Promise.all(
      (members || []).map(async (member) => {
        try {
          const user = await clerk.users.getUser(member.user_id)
          return {
            ...member,
            user: {
              id: user.id,
              email: user.emailAddresses[0]?.emailAddress || '',
              firstName: user.firstName,
              lastName: user.lastName,
              fullName: [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unknown',
              imageUrl: user.imageUrl,
            },
          }
        } catch {
          // User might have been deleted from Clerk
          return {
            ...member,
            user: {
              id: member.user_id,
              email: 'Unknown',
              firstName: null,
              lastName: null,
              fullName: 'Unknown User',
              imageUrl: null,
            },
          }
        }
      })
    )

    return NextResponse.json({ members: membersWithUserData })
  } catch (error) {
    console.error('Get members error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/members
 * Invite a new member to the organization
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get user's organization and membership
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Check permission
    const canManage = membership.role === 'owner' || membership.role === 'admin' ||
      (membership.permissions as MemberPermissions)?.can_manage_members
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to invite members' }, { status: 403 })
    }

    const organizationId = membership.organization_id

    // Get organization to check limits
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('plan, user_limit')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Count existing members
    const { count: memberCount } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    const limit = org.user_limit || PLAN_LIMITS[org.plan as keyof typeof PLAN_LIMITS]?.users || 5
    if ((memberCount || 0) >= limit) {
      return NextResponse.json(
        { error: `User limit reached (${limit}). Upgrade your plan to add more users.` },
        { status: 403 }
      )
    }

    // Parse request body
    let body: {
      email: string
      role?: MemberRole
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.email || !body.email.includes('@')) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    const role: MemberRole = body.role || 'viewer'
    if (!['admin', 'editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Check if user exists in Clerk
    const clerk = await clerkClient()
    const users = await clerk.users.getUserList({ emailAddress: [body.email.toLowerCase()] })

    if (users.data.length === 0) {
      // User doesn't exist - would need to create invitation
      // For now, return error suggesting they sign up first
      return NextResponse.json(
        { error: 'User not found. They must create an account first.' },
        { status: 404 }
      )
    }

    const invitedUser = users.data[0]

    // Check if already a member
    const { data: existingMember } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', invitedUser.id)
      .single()

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this organization' }, { status: 409 })
    }

    // Create member
    const { data: member, error: createError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: organizationId,
        user_id: invitedUser.id,
        role,
        permissions: DEFAULT_PERMISSIONS[role],
      })
      .select()
      .single()

    if (createError) {
      console.error('Create member error:', createError)
      return NextResponse.json({ error: 'Failed to add member' }, { status: 500 })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: organizationId,
      actor_type: 'user',
      actor_id: userId,
      action: 'member.invited',
      resource_type: 'organization_member',
      resource_id: member.id,
      metadata: { email: body.email, role },
    })

    // Return member with user data
    return NextResponse.json({
      member: {
        ...member,
        user: {
          id: invitedUser.id,
          email: invitedUser.emailAddresses[0]?.emailAddress || '',
          firstName: invitedUser.firstName,
          lastName: invitedUser.lastName,
          fullName: [invitedUser.firstName, invitedUser.lastName].filter(Boolean).join(' ') || 'Unknown',
          imageUrl: invitedUser.imageUrl,
        },
      },
    }, { status: 201 })
  } catch (error) {
    console.error('Invite member error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

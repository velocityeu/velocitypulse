import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { verifyInternalAccess, hasAdminRole } from '@/lib/api/internal-auth'
import type { AdminRole } from '@/types'

/**
 * GET /api/internal/admins
 * List all admin users with their roles
 */
export async function GET() {
  const authResult = await verifyInternalAccess()
  if (!authResult.authorized) return authResult.error!

  const supabase = createServiceClient()

  // Get all staff users from users table
  const { data: staffUsers, error: staffError } = await supabase
    .from('users')
    .select('id, email, first_name, last_name, image_url, is_staff, last_sign_in_at, created_at')
    .eq('is_staff', true)
    .order('created_at')

  if (staffError) {
    console.error('Failed to fetch staff users:', staffError)
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
  }

  // Get admin roles for these users
  const userIds = (staffUsers || []).map(u => u.id)
  const { data: adminRoles } = await supabase
    .from('admin_roles')
    .select('*')
    .in('user_id', userIds.length > 0 ? userIds : ['__none__'])

  const roleMap = new Map(
    (adminRoles || []).map(r => [r.user_id, r])
  )

  const admins = (staffUsers || []).map(user => {
    const roleRecord = roleMap.get(user.id)
    return {
      user_id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      full_name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unknown',
      image_url: user.image_url,
      role: roleRecord?.role || 'super_admin', // Default for staff without explicit role
      is_active: roleRecord?.is_active ?? true,
      invited_by: roleRecord?.invited_by || null,
      last_sign_in_at: user.last_sign_in_at,
      created_at: roleRecord?.created_at || user.created_at,
    }
  })

  return NextResponse.json({ admins })
}

/**
 * POST /api/internal/admins
 * Invite a new admin user
 */
export async function POST(request: NextRequest) {
  const authResult = await verifyInternalAccess()
  if (!authResult.authorized) return authResult.error!

  // Only super_admin can invite new admins
  if (!hasAdminRole(authResult.adminRole, 'super_admin')) {
    return NextResponse.json({ error: 'Only super admins can invite new admins' }, { status: 403 })
  }

  let body: { email: string; role: AdminRole }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.email || !body.email.includes('@')) {
    return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
  }

  const validRoles: AdminRole[] = ['super_admin', 'billing_admin', 'support_admin', 'viewer']
  if (!validRoles.includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Look up user in Clerk
  const clerk = await clerkClient()
  const users = await clerk.users.getUserList({ emailAddress: [body.email.toLowerCase()] })

  if (users.data.length === 0) {
    return NextResponse.json(
      { error: 'User not found. They must have a VelocityPulse account first.' },
      { status: 404 }
    )
  }

  const targetUser = users.data[0]
  const supabase = createServiceClient()

  // Check if already staff
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, is_staff')
    .eq('id', targetUser.id)
    .single()

  if (existingUser?.is_staff) {
    return NextResponse.json({ error: 'User is already an admin' }, { status: 409 })
  }

  // Set is_staff = true
  if (existingUser) {
    await supabase
      .from('users')
      .update({ is_staff: true })
      .eq('id', targetUser.id)
  } else {
    // User doesn't exist in users table yet - create
    await supabase.from('users').insert({
      id: targetUser.id,
      email: targetUser.emailAddresses[0]?.emailAddress || body.email,
      first_name: targetUser.firstName,
      last_name: targetUser.lastName,
      image_url: targetUser.imageUrl,
      is_staff: true,
    })
  }

  // Create admin_roles row
  const { error: roleError } = await supabase
    .from('admin_roles')
    .insert({
      user_id: targetUser.id,
      role: body.role,
      is_active: true,
      invited_by: authResult.userId,
    })

  if (roleError) {
    console.error('Failed to create admin role:', roleError)
    return NextResponse.json({ error: 'Failed to create admin role' }, { status: 500 })
  }

  // Admin audit log
  await supabase.from('admin_audit_logs').insert({
    actor_id: authResult.userId!,
    actor_email: authResult.email,
    action: 'admin.invited',
    resource_type: 'admin_role',
    resource_id: targetUser.id,
    metadata: { email: body.email, role: body.role },
  })

  return NextResponse.json({
    admin: {
      user_id: targetUser.id,
      email: targetUser.emailAddresses[0]?.emailAddress || body.email,
      first_name: targetUser.firstName,
      last_name: targetUser.lastName,
      full_name: [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || 'Unknown',
      image_url: targetUser.imageUrl,
      role: body.role,
      is_active: true,
      invited_by: authResult.userId,
      last_sign_in_at: null,
      created_at: new Date().toISOString(),
    },
  }, { status: 201 })
}

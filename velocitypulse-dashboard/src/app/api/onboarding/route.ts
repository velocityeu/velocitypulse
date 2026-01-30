import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS, TRIAL_DURATION_DAYS, CUSTOMER_NUMBER_PREFIX } from '@/lib/constants'

// Generate a unique customer number (VEU-XXXXX format)
function generateCustomerNumber(): string {
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `${CUSTOMER_NUMBER_PREFIX}${randomPart}`
}

// Generate a URL-safe slug from organization name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50) + '-' + Math.random().toString(36).substring(2, 6)
}

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await currentUser()
    const body = await request.json()
    const { organizationName } = body

    if (!organizationName || organizationName.trim().length < 2) {
      return NextResponse.json(
        { error: 'Organization name must be at least 2 characters' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // Check if user already has an organization
    const { data: existingMembership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (existingMembership) {
      // Return existing organization
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', existingMembership.organization_id)
        .single()

      return NextResponse.json({
        organization: existingOrg,
        isNew: false,
      })
    }

    // Create new organization
    const name = organizationName.trim()
    const slug = generateSlug(name)
    const customerNumber = generateCustomerNumber()
    const trialEndsAt = new Date()
    trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS)

    const { data: newOrg, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name,
        slug,
        customer_number: customerNumber,
        plan: 'trial',
        status: 'trial',
        device_limit: PLAN_LIMITS.trial.devices,
        agent_limit: PLAN_LIMITS.trial.agents,
        user_limit: PLAN_LIMITS.trial.users,
        trial_ends_at: trialEndsAt.toISOString(),
      })
      .select()
      .single()

    if (orgError) {
      console.error('Failed to create organization:', orgError)
      return NextResponse.json(
        { error: 'Failed to create organization' },
        { status: 500 }
      )
    }

    // Add user as owner
    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: newOrg.id,
        user_id: userId,
        role: 'owner',
        permissions: {
          can_manage_billing: true,
          can_manage_agents: true,
          can_manage_devices: true,
          can_manage_members: true,
          can_view_audit_logs: true,
        },
      })

    if (memberError) {
      console.error('Failed to add member:', memberError)
      // Clean up the org we just created
      await supabase.from('organizations').delete().eq('id', newOrg.id)
      return NextResponse.json(
        { error: 'Failed to set up organization membership' },
        { status: 500 }
      )
    }

    // Create default categories
    const defaultCategories = [
      { name: 'Servers', slug: 'servers', icon: 'server', color: '#3B82F6' },
      { name: 'Network', slug: 'network', icon: 'network', color: '#10B981' },
      { name: 'Workstations', slug: 'workstations', icon: 'monitor', color: '#8B5CF6' },
      { name: 'Printers', slug: 'printers', icon: 'printer', color: '#F59E0B' },
      { name: 'Other', slug: 'other', icon: 'box', color: '#6B7280' },
    ]

    await supabase.from('categories').insert(
      defaultCategories.map((cat, index) => ({
        organization_id: newOrg.id,
        ...cat,
        sort_order: index,
      }))
    )

    // Create audit log
    await supabase.from('audit_logs').insert({
      organization_id: newOrg.id,
      actor_type: 'user',
      actor_id: userId,
      action: 'organization.created',
      resource_type: 'organization',
      resource_id: newOrg.id,
      metadata: {
        name,
        email: user?.emailAddresses[0]?.emailAddress,
      },
    })

    return NextResponse.json({
      organization: newOrg,
      isNew: true,
    })
  } catch (error) {
    console.error('Onboarding error:', error)
    return NextResponse.json(
      { error: 'Failed to complete onboarding' },
      { status: 500 }
    )
  }
}

// GET: Check if user has an organization
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()

    // Get user's organization
    const { data: membership } = await supabase
      .from('organization_members')
      .select(`
        role,
        permissions,
        organizations (
          id,
          name,
          slug,
          customer_number,
          plan,
          status,
          device_limit,
          agent_limit,
          user_limit,
          trial_ends_at,
          stripe_customer_id
        )
      `)
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ hasOrganization: false })
    }

    return NextResponse.json({
      hasOrganization: true,
      organization: membership.organizations,
      role: membership.role,
      permissions: membership.permissions,
    })
  } catch (error) {
    console.error('Get organization error:', error)
    return NextResponse.json(
      { error: 'Failed to get organization' },
      { status: 500 }
    )
  }
}

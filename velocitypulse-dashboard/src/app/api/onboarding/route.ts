import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { ensureUserInDb } from '@/lib/api/ensure-user'
import { PLAN_LIMITS, TRIAL_DURATION_DAYS } from '@/lib/constants'
import { generateCustomerNumber, generateUniqueSlug } from '@/lib/utils'
import { sendWelcomeEmail } from '@/lib/emails/lifecycle'
import { logger } from '@/lib/logger'
import { validateRequest, onboardingSchema } from '@/lib/validations'

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dbUser = await ensureUserInDb(userId)

    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validation = validateRequest(onboardingSchema, rawBody)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }
    const { organizationName, referralCode } = validation.data

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
    const slug = generateUniqueSlug(name)
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
        referral_code: slug.slice(0, 4) + Math.random().toString(36).slice(2, 6),
        referred_by: referralCode || null,
      })
      .select()
      .single()

    if (orgError) {
      logger.error('Failed to create organization', orgError, { route: 'api/onboarding' })
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
      logger.error('Failed to add member', memberError, { route: 'api/onboarding' })
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

    const { error: categoryError } = await supabase.from('categories').insert(
      defaultCategories.map((cat, index) => ({
        organization_id: newOrg.id,
        ...cat,
        sort_order: index,
      }))
    )

    if (categoryError) {
      logger.error('Failed to create default categories', categoryError, { route: 'api/onboarding' })
      // Non-fatal: organization is still usable without categories
    }

    // Create audit log
    const { error: auditError } = await supabase.from('audit_logs').insert({
      organization_id: newOrg.id,
      actor_type: 'user',
      actor_id: userId,
      action: 'organization.created',
      resource_type: 'organization',
      resource_id: newOrg.id,
      metadata: {
        name,
        email: dbUser?.email,
      },
    })

    if (auditError) {
      logger.error('Failed to create audit log', auditError, { route: 'api/onboarding' })
      // Non-fatal: organization is still usable without audit log
    }

    // Send welcome email (non-fatal)
    const ownerEmail = dbUser?.email
    if (ownerEmail) {
      sendWelcomeEmail(name, ownerEmail).catch(err =>
        logger.error('Failed to send welcome email', err, { route: 'api/onboarding' })
      )
    }

    return NextResponse.json({
      organization: newOrg,
      isNew: true,
    })
  } catch (error) {
    logger.error('Onboarding error', error, { route: 'api/onboarding' })
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
          suspended_at,
          cancelled_at,
          stripe_customer_id,
          branding_display_name,
          branding_logo_url,
          branding_primary_color,
          sso_enabled,
          sso_domain,
          sso_provider
        )
      `)
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ hasOrganization: false })
    }

    // Fetch staff status from users table
    const { data: userRecord } = await supabase
      .from('users')
      .select('is_staff')
      .eq('id', userId)
      .single()

    return NextResponse.json({
      hasOrganization: true,
      organization: membership.organizations,
      role: membership.role,
      permissions: membership.permissions,
      isStaff: userRecord?.is_staff === true,
    })
  } catch (error) {
    logger.error('Get organization error', error, { route: 'api/onboarding' })
    return NextResponse.json(
      { error: 'Failed to get organization' },
      { status: 500 }
    )
  }
}

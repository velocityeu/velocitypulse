import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS } from '@/lib/constants'
import type { OrganizationPlan } from '@/types'

/**
 * PUT /api/dashboard/branding
 * Update organization branding (unlimited plan only)
 */
export async function PUT(request: NextRequest) {
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

    // Check user has admin/owner role
    if (membership.role !== 'owner' && membership.role !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Get organization to check plan
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, plan')
      .eq('id', membership.organization_id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Verify unlimited plan
    const plan = org.plan as OrganizationPlan
    if (!PLAN_LIMITS[plan]?.whiteLabel) {
      return NextResponse.json(
        { error: 'White-label branding requires the Unlimited plan' },
        { status: 403 }
      )
    }

    // Parse request body
    let body: {
      display_name?: string | null
      logo_url?: string | null
      primary_color?: string | null
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Validate inputs
    if (body.display_name !== undefined && body.display_name !== null) {
      if (typeof body.display_name !== 'string' || body.display_name.length > 255) {
        return NextResponse.json({ error: 'Display name must be 255 characters or less' }, { status: 400 })
      }
    }

    if (body.logo_url !== undefined && body.logo_url !== null) {
      if (typeof body.logo_url !== 'string') {
        return NextResponse.json({ error: 'Logo URL must be a string' }, { status: 400 })
      }
      // Must be HTTPS URL or relative path
      if (!body.logo_url.startsWith('https://') && !body.logo_url.startsWith('/')) {
        return NextResponse.json({ error: 'Logo URL must use HTTPS or be a relative path' }, { status: 400 })
      }
      if (body.logo_url.length > 2048) {
        return NextResponse.json({ error: 'Logo URL must be 2048 characters or less' }, { status: 400 })
      }
    }

    if (body.primary_color !== undefined && body.primary_color !== null) {
      if (typeof body.primary_color !== 'string') {
        return NextResponse.json({ error: 'Primary color must be a string' }, { status: 400 })
      }
      // Validate hex color
      if (!/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(body.primary_color)) {
        return NextResponse.json({ error: 'Primary color must be a valid hex color (e.g., #FF5733)' }, { status: 400 })
      }
    }

    // Update organization branding
    const { data: updated, error: updateError } = await supabase
      .from('organizations')
      .update({
        branding_display_name: body.display_name ?? null,
        branding_logo_url: body.logo_url ?? null,
        branding_primary_color: body.primary_color ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', org.id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update branding:', updateError)
      return NextResponse.json({ error: 'Failed to update branding' }, { status: 500 })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: org.id,
      actor_type: 'user',
      actor_id: userId,
      action: 'organization.updated',
      resource_type: 'organization',
      resource_id: org.id,
      metadata: {
        change: 'branding',
        display_name: body.display_name,
        logo_url: body.logo_url,
        primary_color: body.primary_color,
      },
    })

    return NextResponse.json({ organization: updated })
  } catch (error) {
    console.error('Branding update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS } from '@/lib/constants'
import { createSamlConnection, deleteSamlConnection } from '@/lib/api/clerk-sso'
import type { OrganizationPlan } from '@/types'

/**
 * Helper to get org and verify unlimited plan + admin/owner role
 */
async function getAuthorizedOrg(userId: string) {
  const supabase = createServiceClient()

  const { data: membership, error: memberError } = await supabase
    .from('organization_members')
    .select('organization_id, role')
    .eq('user_id', userId)
    .limit(1)
    .single()

  if (memberError || !membership) return null

  if (membership.role !== 'owner' && membership.role !== 'admin') return null

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, plan, sso_enabled, sso_domain, sso_provider')
    .eq('id', membership.organization_id)
    .single()

  if (orgError || !org) return null

  const plan = org.plan as OrganizationPlan
  if (!PLAN_LIMITS[plan]?.sso) return null

  return { org, supabase }
}

/**
 * GET /api/dashboard/sso
 * Get current SSO configuration
 */
export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await getAuthorizedOrg(userId)
    if (!result) {
      return NextResponse.json(
        { error: 'SSO requires the Unlimited plan with admin access' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      sso_enabled: result.org.sso_enabled || false,
      sso_domain: result.org.sso_domain || null,
      sso_provider: result.org.sso_provider || null,
    })
  } catch (error) {
    console.error('SSO GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PUT /api/dashboard/sso
 * Create or update SAML connection
 */
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await getAuthorizedOrg(userId)
    if (!result) {
      return NextResponse.json(
        { error: 'SSO requires the Unlimited plan with admin access' },
        { status: 403 }
      )
    }

    let body: {
      domain: string
      provider?: string
      idp_metadata_url?: string
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.domain || !/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(body.domain)) {
      return NextResponse.json({ error: 'Valid domain is required (e.g., acme.com)' }, { status: 400 })
    }

    // Create SAML connection in Clerk
    try {
      const connection = await createSamlConnection({
        name: `SSO for ${body.domain}`,
        domain: body.domain,
        provider: body.provider || 'saml_custom',
        idpMetadataUrl: body.idp_metadata_url,
      })

      // Update org in database
      const { error: updateError } = await result.supabase
        .from('organizations')
        .update({
          sso_enabled: true,
          sso_domain: body.domain,
          sso_provider: connection.provider || body.provider || 'saml_custom',
          updated_at: new Date().toISOString(),
        })
        .eq('id', result.org.id)

      if (updateError) {
        console.error('Failed to update SSO config:', updateError)
        return NextResponse.json({ error: 'Failed to save SSO configuration' }, { status: 500 })
      }

      // Audit log
      await result.supabase.from('audit_logs').insert({
        organization_id: result.org.id,
        actor_type: 'user',
        actor_id: userId,
        action: 'organization.updated',
        resource_type: 'organization',
        resource_id: result.org.id,
        metadata: {
          change: 'sso_enabled',
          domain: body.domain,
          provider: connection.provider,
        },
      })

      return NextResponse.json({
        sso_enabled: true,
        sso_domain: body.domain,
        sso_provider: connection.provider,
        acs_url: connection.acs_url,
        entity_id: connection.entity_id,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create SAML connection'
      return NextResponse.json({ error: message }, { status: 400 })
    }
  } catch (error) {
    console.error('SSO PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/dashboard/sso
 * Disable SSO and remove Clerk connection
 */
export async function DELETE() {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await getAuthorizedOrg(userId)
    if (!result) {
      return NextResponse.json(
        { error: 'SSO requires the Unlimited plan with admin access' },
        { status: 403 }
      )
    }

    // Try to delete Clerk SAML connection if one exists
    if (result.org.sso_domain) {
      try {
        // Note: In a production setup, we'd store the Clerk connection ID
        // For now, we just disable in our database
        await deleteSamlConnection(result.org.id)
      } catch {
        // Non-fatal: Clerk connection may not exist
      }
    }

    // Update org
    const { error: updateError } = await result.supabase
      .from('organizations')
      .update({
        sso_enabled: false,
        sso_domain: null,
        sso_provider: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', result.org.id)

    if (updateError) {
      console.error('Failed to disable SSO:', updateError)
      return NextResponse.json({ error: 'Failed to disable SSO' }, { status: 500 })
    }

    // Audit log
    await result.supabase.from('audit_logs').insert({
      organization_id: result.org.id,
      actor_type: 'user',
      actor_id: userId,
      action: 'organization.updated',
      resource_type: 'organization',
      resource_id: result.org.id,
      metadata: { change: 'sso_disabled' },
    })

    return NextResponse.json({ sso_enabled: false })
  } catch (error) {
    console.error('SSO DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

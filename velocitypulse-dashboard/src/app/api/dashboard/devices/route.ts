import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS } from '@/lib/constants'
import { logger } from '@/lib/logger'
import { validateRequest, createDeviceSchema } from '@/lib/validations'

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
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (memberError || !membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    const organizationId = membership.organization_id

    // Query devices for this organization with relationships
    const { data: devices, error: devicesError } = await supabase
      .from('devices')
      .select(`
        *,
        category:categories(*),
        network_segment:network_segments(*),
        agent:agents(id, name, last_seen_at)
      `)
      .eq('organization_id', organizationId)
      .order('sort_order')

    if (devicesError) {
      logger.error('Failed to fetch devices', devicesError, { route: 'api/dashboard/devices' })
      return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 })
    }

    return NextResponse.json({ devices: devices || [] })
  } catch (error) {
    logger.error('Dashboard devices error', error, { route: 'api/dashboard/devices' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/dashboard/devices
 * Create a new device for the user's organization
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
    const canManage = membership.role === 'owner' || membership.role === 'admin' || membership.role === 'editor' ||
      (membership.permissions as { can_manage_devices?: boolean })?.can_manage_devices
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to create devices' }, { status: 403 })
    }

    const organizationId = membership.organization_id

    // Get organization to check limits
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('plan, device_limit')
      .eq('id', organizationId)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Count existing devices
    const { count: deviceCount } = await supabase
      .from('devices')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    const limit = org.device_limit || PLAN_LIMITS[org.plan as keyof typeof PLAN_LIMITS]?.devices || 50
    if ((deviceCount || 0) >= limit) {
      return NextResponse.json(
        { error: `Device limit reached (${limit}). Upgrade your plan to add more devices.` },
        { status: 403 }
      )
    }

    // Parse and validate request body
    let rawBody: Record<string, unknown>
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const validation = validateRequest(createDeviceSchema, rawBody)
    if (!validation.success) {
      return NextResponse.json(validation.error, { status: 400 })
    }
    const body = validation.data

    // Get max sort_order
    const { data: maxDevice } = await supabase
      .from('devices')
      .select('sort_order')
      .eq('organization_id', organizationId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSortOrder = (maxDevice?.sort_order || 0) + 1

    // Create device
    const { data: device, error: createError } = await supabase
      .from('devices')
      .insert({
        organization_id: organizationId,
        name: body.name.trim(),
        ip_address: body.ip_address || null,
        mac_address: (rawBody.mac_address as string) || null,
        hostname: (rawBody.hostname as string) || null,
        category_id: body.category_id || null,
        network_segment_id: (rawBody.network_segment_id as string) || null,
        description: body.description || null,
        check_type: body.check_type || 'ping',
        url: body.url || null,
        port: body.port || null,
        status: 'unknown',
        is_enabled: true,
        is_monitored: true,
        discovered_by: 'manual',
        sort_order: nextSortOrder,
        monitoring_mode: body.monitoring_mode || 'manual',
        check_interval_seconds: body.check_interval_seconds || 60,
        ssl_expiry_warn_days: body.ssl_expiry_warn_days || null,
        dns_expected_ip: body.dns_expected_ip || null,
      })
      .select(`
        *,
        category:categories(*),
        network_segment:network_segments(*)
      `)
      .single()

    if (createError) {
      logger.error('Create device error', createError, { route: 'api/dashboard/devices' })
      return NextResponse.json({ error: 'Failed to create device' }, { status: 500 })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: organizationId,
      actor_type: 'user',
      actor_id: userId,
      action: 'device.created',
      resource_type: 'device',
      resource_id: device.id,
      metadata: { name: device.name },
    })

    return NextResponse.json({ device }, { status: 201 })
  } catch (error) {
    logger.error('Create device error', error, { route: 'api/dashboard/devices' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { PLAN_LIMITS } from '@/lib/constants'

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
      console.error('Failed to fetch devices:', devicesError)
      return NextResponse.json({ error: 'Failed to fetch devices' }, { status: 500 })
    }

    return NextResponse.json({ devices: devices || [] })
  } catch (error) {
    console.error('Dashboard devices error:', error)
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

    // Parse request body
    let body: {
      name: string
      ip_address?: string
      mac_address?: string
      hostname?: string
      category_id?: string
      network_segment_id?: string
      description?: string
      check_type?: 'ping' | 'http' | 'tcp'
      url?: string
      port?: number
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.name || body.name.trim().length < 1) {
      return NextResponse.json({ error: 'Device name is required' }, { status: 400 })
    }

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
        mac_address: body.mac_address || null,
        hostname: body.hostname || null,
        category_id: body.category_id || null,
        network_segment_id: body.network_segment_id || null,
        description: body.description || null,
        check_type: body.check_type || 'ping',
        url: body.url || null,
        port: body.port || null,
        status: 'unknown',
        is_enabled: true,
        is_monitored: true,
        discovered_by: 'manual',
        sort_order: nextSortOrder,
      })
      .select(`
        *,
        category:categories(*),
        network_segment:network_segments(*)
      `)
      .single()

    if (createError) {
      console.error('Create device error:', createError)
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
    console.error('Create device error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

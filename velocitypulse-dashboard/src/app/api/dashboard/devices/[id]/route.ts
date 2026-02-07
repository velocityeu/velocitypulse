import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/dashboard/devices/[id]
 * Get a single device by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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

    // Get device with relationships
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select(`
        *,
        category:categories(*),
        network_segment:network_segments(*),
        agent:agents(id, name, last_seen_at)
      `)
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .single()

    if (deviceError || !device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    return NextResponse.json({ device })
  } catch (error) {
    console.error('Get device error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/dashboard/devices/[id]
 * Update a device
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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
      return NextResponse.json({ error: 'You do not have permission to update devices' }, { status: 403 })
    }

    // Verify device belongs to organization
    const { data: existingDevice, error: existingError } = await supabase
      .from('devices')
      .select('id')
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .single()

    if (existingError || !existingDevice) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // Parse request body
    let body: {
      name?: string
      ip_address?: string | null
      mac_address?: string | null
      hostname?: string | null
      category_id?: string | null
      network_segment_id?: string | null
      description?: string | null
      check_type?: 'ping' | 'http' | 'tcp'
      url?: string | null
      port?: number | null
      is_enabled?: boolean
      is_monitored?: boolean
    }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    // Build update object
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

    if (body.name !== undefined) updates.name = body.name?.trim() || null
    if (body.ip_address !== undefined) updates.ip_address = body.ip_address || null
    if (body.mac_address !== undefined) updates.mac_address = body.mac_address || null
    if (body.hostname !== undefined) updates.hostname = body.hostname || null
    if (body.category_id !== undefined) updates.category_id = body.category_id || null
    if (body.network_segment_id !== undefined) updates.network_segment_id = body.network_segment_id || null
    if (body.description !== undefined) updates.description = body.description || null
    if (body.check_type !== undefined) updates.check_type = body.check_type
    if (body.url !== undefined) updates.url = body.url || null
    if (body.port !== undefined) updates.port = body.port || null
    if (body.is_enabled !== undefined) updates.is_enabled = body.is_enabled
    if (body.is_monitored !== undefined) updates.is_monitored = body.is_monitored

    // Update device
    const { data: device, error: updateError } = await supabase
      .from('devices')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        category:categories(*),
        network_segment:network_segments(*)
      `)
      .single()

    if (updateError) {
      console.error('Update device error:', updateError)
      return NextResponse.json({ error: 'Failed to update device' }, { status: 500 })
    }

    // Audit log (fire-and-forget)
    supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      actor_type: 'user',
      actor_id: userId,
      action: 'device.updated',
      resource_type: 'device',
      resource_id: id,
      metadata: { name: device.name },
    }).then(({ error: auditError }) => {
      if (auditError) console.error('[Audit] device.updated failed:', auditError)
    })

    return NextResponse.json({ device })
  } catch (error) {
    console.error('Update device error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/dashboard/devices/[id]
 * Delete a device
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
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
      (membership.permissions as { can_manage_devices?: boolean })?.can_manage_devices
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to delete devices' }, { status: 403 })
    }

    // Get device name for audit log
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, name')
      .eq('id', id)
      .eq('organization_id', membership.organization_id)
      .single()

    if (deviceError || !device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 })
    }

    // Delete device
    const { error: deleteError } = await supabase
      .from('devices')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Delete device error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete device' }, { status: 500 })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      actor_type: 'user',
      actor_id: userId,
      action: 'device.deleted',
      resource_type: 'device',
      resource_id: id,
      metadata: { name: device.name },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete device error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

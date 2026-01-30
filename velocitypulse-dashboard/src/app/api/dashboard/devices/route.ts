import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'

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
        agent:agents(id, name, is_online)
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

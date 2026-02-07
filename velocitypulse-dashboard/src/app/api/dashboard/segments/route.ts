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

    // Query network segments for this organization
    const { data: segments, error: segmentsError } = await supabase
      .from('network_segments')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name')

    if (segmentsError) {
      console.error('Failed to fetch segments:', segmentsError)
      return NextResponse.json({ error: 'Failed to fetch segments' }, { status: 500 })
    }

    const response = NextResponse.json({ segments: segments || [] })
    response.headers.set('Cache-Control', 'private, max-age=30')
    return response
  } catch (error) {
    console.error('Dashboard segments error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

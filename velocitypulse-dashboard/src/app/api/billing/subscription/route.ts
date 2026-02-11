import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'

export async function GET(request?: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServiceClient()
    const requestedOrgId = request?.headers.get('x-organization-id')?.trim()

    // Get user's org
    let membershipQuery = supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
    if (requestedOrgId) {
      membershipQuery = membershipQuery.eq('organization_id', requestedOrgId)
    }
    const { data: membership } = await membershipQuery
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Get active subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('plan, status, current_period_end, amount_cents')
      .eq('organization_id', membership.organization_id)
      .in('status', ['active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!subscription) {
      const response = NextResponse.json({ subscription: null })
      response.headers.set('Cache-Control', 'private, max-age=300')
      return response
    }

    const response = NextResponse.json({ subscription })
    response.headers.set('Cache-Control', 'private, max-age=300')
    return response
  } catch (error) {
    console.error('Subscription fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch subscription' },
      { status: 500 }
    )
  }
}

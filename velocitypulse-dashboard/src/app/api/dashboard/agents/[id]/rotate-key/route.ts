import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { rotateApiKey } from '@/lib/api/agent-auth'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: agentId } = await params

    const supabase = createServiceClient()

    // Get user's membership and permissions
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id, role, permissions')
      .eq('user_id', userId)
      .limit(1)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'No organization found' }, { status: 404 })
    }

    // Check permission
    const permissions = (membership.permissions as string[]) || []
    const canManage = membership.role === 'owner' || membership.role === 'admin' || permissions.includes('can_manage_agents')
    if (!canManage) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    // Verify agent belongs to the user's organization
    const { data: agent } = await supabase
      .from('agents')
      .select('id, name')
      .eq('id', agentId)
      .eq('organization_id', membership.organization_id)
      .single()

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Get org slug for key generation
    const { data: org } = await supabase
      .from('organizations')
      .select('slug')
      .eq('id', membership.organization_id)
      .single()

    if (!org?.slug) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Rotate the key using existing utility
    const result = await rotateApiKey(agentId, org.slug)
    if (!result) {
      return NextResponse.json({ error: 'Failed to rotate API key' }, { status: 500 })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: membership.organization_id,
      actor_type: 'user',
      actor_id: userId,
      action: 'agent.api_key_rotated',
      resource_type: 'agent',
      resource_id: agentId,
      metadata: { agent_name: agent.name },
    })

    return NextResponse.json({
      api_key: result.apiKey,
      message: 'Previous key remains valid for 24 hours.',
    })
  } catch (error) {
    logger.error('API key rotation error', error, { route: 'api/dashboard/agents/[id]/rotate-key' })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

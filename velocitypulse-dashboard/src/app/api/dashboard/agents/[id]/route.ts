import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'

/**
 * DELETE /api/dashboard/agents/[id]
 * Delete an agent and all its related data
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: agentId } = await params

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 })
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
    const canManage = membership.role === 'owner' || membership.role === 'admin' ||
      (membership.permissions as { can_manage_agents?: boolean })?.can_manage_agents
    if (!canManage) {
      return NextResponse.json({ error: 'You do not have permission to delete agents' }, { status: 403 })
    }

    const organizationId = membership.organization_id

    // Verify agent belongs to user's organization
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, name')
      .eq('id', agentId)
      .eq('organization_id', organizationId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Delete the agent (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('agents')
      .delete()
      .eq('id', agentId)
      .eq('organization_id', organizationId)

    if (deleteError) {
      console.error('Delete agent error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete agent' }, { status: 500 })
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      organization_id: organizationId,
      actor_type: 'user',
      actor_id: userId,
      action: 'agent.deleted',
      resource_type: 'agent',
      resource_id: agentId,
      metadata: { name: agent.name },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete agent error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

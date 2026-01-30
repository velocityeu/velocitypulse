import { NextRequest, NextResponse } from 'next/server'
import { verifyInternalAccess } from '@/lib/api/internal-auth'
import { supabase } from '@/lib/db/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { authorized, error } = await verifyInternalAccess()
  if (!authorized) return error

  try {
    const { id } = await params

    // Get organization
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single()

    if (orgError || !org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Get counts and detailed data
    const [members, devices, agentsResult, segmentsResult, auditLogs] = await Promise.all([
      supabase
        .from('organization_members')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', id),
      supabase
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', id),
      supabase
        .from('agents')
        .select('*')
        .eq('organization_id', id)
        .order('created_at'),
      supabase
        .from('network_segments')
        .select('*')
        .eq('organization_id', id)
        .order('created_at'),
      supabase
        .from('audit_logs')
        .select('*')
        .eq('organization_id', id)
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // Get device counts per agent
    const agentsWithCounts = await Promise.all(
      (agentsResult.data || []).map(async (agent) => {
        const { count: deviceCount } = await supabase
          .from('devices')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', agent.id)

        const { count: segmentCount } = await supabase
          .from('network_segments')
          .select('*', { count: 'exact', head: true })
          .eq('agent_id', agent.id)

        // Calculate is_online from last_seen_at
        const isOnline = agent.last_seen_at
          ? new Date(agent.last_seen_at) > new Date(Date.now() - 5 * 60 * 1000)
          : false

        return {
          ...agent,
          device_count: deviceCount || 0,
          segment_count: segmentCount || 0,
          is_online: isOnline,
        }
      })
    )

    // Get device counts per segment
    const segmentsWithCounts = await Promise.all(
      (segmentsResult.data || []).map(async (segment) => {
        const { count: deviceCount } = await supabase
          .from('devices')
          .select('*', { count: 'exact', head: true })
          .eq('network_segment_id', segment.id)

        return {
          ...segment,
          device_count: deviceCount || 0,
        }
      })
    )

    return NextResponse.json({
      ...org,
      member_count: members.count || 0,
      device_count: devices.count || 0,
      agent_count: agentsResult.data?.length || 0,
      agents: agentsWithCounts,
      segments: segmentsWithCounts,
      recent_audit_logs: auditLogs.data || [],
    })
  } catch (error) {
    console.error('Failed to fetch organization:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    )
  }
}

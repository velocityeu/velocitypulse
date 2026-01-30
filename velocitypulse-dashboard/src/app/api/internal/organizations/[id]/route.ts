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

    // Get counts
    const [members, devices, agents] = await Promise.all([
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
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', id),
    ])

    // Get recent audit logs
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('organization_id', id)
      .order('created_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      ...org,
      member_count: members.count || 0,
      device_count: devices.count || 0,
      agent_count: agents.count || 0,
      recent_audit_logs: auditLogs || [],
    })
  } catch (error) {
    console.error('Failed to fetch organization:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organization' },
      { status: 500 }
    )
  }
}

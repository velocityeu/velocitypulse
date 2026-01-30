import { NextResponse } from 'next/server'
import { authenticateAgent } from '@/lib/api/agent-auth'
import { createServiceClient } from '@/lib/db/client'
import type { AgentStatusRequest, AgentStatusResponse } from '@/types'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    // Authenticate agent
    const agentContext = await authenticateAgent()
    if (!agentContext) {
      return NextResponse.json(
        { error: 'Invalid or disabled API key' },
        { status: 401 }
      )
    }

    // Parse request body
    let body: AgentStatusRequest
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    if (!body.reports || !Array.isArray(body.reports)) {
      return NextResponse.json(
        { error: 'reports array is required' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const errors: string[] = []
    let processed = 0

    // Process each status report
    for (const report of body.reports) {
      try {
        // Find device by ID or IP address (scoped to organization)
        let deviceQuery = supabase
          .from('devices')
          .select('id')
          .eq('organization_id', agentContext.organizationId)

        if (report.device_id) {
          deviceQuery = deviceQuery.eq('id', report.device_id)
        } else if (report.ip_address) {
          deviceQuery = deviceQuery.eq('ip_address', report.ip_address)
        } else {
          errors.push('Report missing device_id or ip_address')
          continue
        }

        const { data: device, error: deviceError } = await deviceQuery.single()

        if (deviceError || !device) {
          errors.push(`Device not found: ${report.device_id || report.ip_address}`)
          continue
        }

        // Update device status
        const { error: updateError } = await supabase
          .from('devices')
          .update({
            status: report.status,
            response_time_ms: report.response_time_ms,
            last_check: report.checked_at,
            last_online: report.status === 'online' ? report.checked_at : undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', device.id)
          .eq('organization_id', agentContext.organizationId)

        if (updateError) {
          errors.push(`Failed to update device ${device.id}: ${updateError.message}`)
          continue
        }

        processed++
      } catch (error) {
        errors.push(`Error processing report: ${error}`)
      }
    }

    const response: AgentStatusResponse = {
      success: errors.length === 0,
      processed,
      errors,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Status update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

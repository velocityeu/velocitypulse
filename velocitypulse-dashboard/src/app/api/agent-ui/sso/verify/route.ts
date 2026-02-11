import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/db/client'
import { verifyAgentApiKey } from '@/lib/api/agent-key'

function hashState(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function getApiKey(request: NextRequest): string | null {
  const xAgentKey = request.headers.get('x-agent-key')
  if (xAgentKey) return xAgentKey

  const xApiKey = request.headers.get('x-api-key')
  if (xApiKey) return xApiKey

  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

export async function POST(request: NextRequest) {
  const apiKey = getApiKey(request)
  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  const agentContext = await verifyAgentApiKey(apiKey)
  if (!agentContext) {
    return NextResponse.json({ error: 'Invalid or disabled API key' }, { status: 401 })
  }

  let body: { grant_id?: string; state?: string; agent_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const grantId = body.grant_id?.trim() || ''
  const state = body.state?.trim() || ''
  const agentId = body.agent_id?.trim() || ''
  if (!grantId || !state || !agentId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (agentId !== agentContext.agentId) {
    return NextResponse.json({ error: 'Agent mismatch' }, { status: 403 })
  }

  const nowIso = new Date().toISOString()
  const supabase = createServiceClient()

  const { data: grant, error: grantError } = await supabase
    .from('agent_ui_sso_grants')
    .update({ used_at: nowIso })
    .eq('id', grantId)
    .eq('agent_id', agentContext.agentId)
    .eq('organization_id', agentContext.organizationId)
    .eq('state_hash', hashState(state))
    .is('used_at', null)
    .gt('expires_at', nowIso)
    .select('id, organization_id, user_id, role, expires_at')
    .single<{ id: string; organization_id: string; user_id: string; role: string; expires_at: string }>()

  if (grantError || !grant) {
    return NextResponse.json({ error: 'Invalid, expired, or already used grant' }, { status: 401 })
  }

  return NextResponse.json({
    ok: true,
    organization_id: grant.organization_id,
    user_id: grant.user_id,
    role: grant.role,
    expires_at: grant.expires_at,
  })
}

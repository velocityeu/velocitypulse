import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import crypto from 'crypto'
import { createServiceClient } from '@/lib/db/client'

function isAllowedRedirectUri(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'http:') return false
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  } catch {
    return false
  }
}

function hashState(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export async function GET(request: NextRequest) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const agentId = searchParams.get('agent_id')?.trim() || ''
  const state = searchParams.get('state')?.trim() || ''
  const redirectUri = searchParams.get('redirect_uri')?.trim() || ''
  const next = searchParams.get('next')?.trim() || '/'

  if (!agentId || !state || !redirectUri) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
  }

  if (state.length < 16 || state.length > 256) {
    return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 })
  }

  if (!isAllowedRedirectUri(redirectUri)) {
    return NextResponse.json({ error: 'Invalid redirect_uri (loopback only)' }, { status: 400 })
  }

  const supabase = createServiceClient()

  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, organization_id, is_enabled')
    .eq('id', agentId)
    .single<{ id: string; organization_id: string; is_enabled: boolean }>()

  if (agentError || !agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  if (!agent.is_enabled) {
    return NextResponse.json({ error: 'Agent is disabled' }, { status: 403 })
  }

  const { data: membership, error: membershipError } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', agent.organization_id)
    .eq('user_id', userId)
    .single<{ role: 'owner' | 'admin' | 'editor' | 'viewer' }>()

  if (membershipError || !membership) {
    return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 })
  }

  if (membership.role !== 'owner' && membership.role !== 'admin') {
    return NextResponse.json({ error: 'Only owner/admin can authorize agent UI access' }, { status: 403 })
  }

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
  const { data: grant, error: grantError } = await supabase
    .from('agent_ui_sso_grants')
    .insert({
      agent_id: agent.id,
      organization_id: agent.organization_id,
      user_id: userId,
      role: membership.role,
      state_hash: hashState(state),
      expires_at: expiresAt,
    })
    .select('id')
    .single<{ id: string }>()

  if (grantError || !grant) {
    return NextResponse.json({ error: 'Failed to create SSO grant' }, { status: 500 })
  }

  const callback = new URL(redirectUri)
  callback.searchParams.set('grant_id', grant.id)
  callback.searchParams.set('state', state)
  callback.searchParams.set('next', next)
  return NextResponse.redirect(callback.toString(), { status: 302 })
}

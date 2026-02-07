import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/api/agent-auth', () => ({
  generateApiKey: vi.fn().mockReturnValue({
    apiKey: 'vp_testorg1_abcdefghijklmnopqrstuv',
    apiKeyHash: 'hash123',
    apiKeyPrefix: 'vp_testorg1',
  }),
}))

vi.mock('@/lib/constants', () => ({
  AGENT_ONLINE_THRESHOLD_MS: 300000,
  PLAN_LIMITS: {
    trial: { devices: 100, agents: 10, users: 5 },
    starter: { devices: 100, agents: 10, users: 10 },
    unlimited: { devices: 5000, agents: 100, users: 50 },
  },
}))

import { GET, POST } from './route'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/db/client'
import { NextRequest } from 'next/server'

function createMockChain(resolveValue: { data: unknown; error: unknown; count?: number | null } = { data: null, error: null }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single = vi.fn().mockResolvedValue(resolveValue)
  chain.then = vi.fn((resolve) => resolve(resolveValue))
  return chain
}

describe('GET /api/dashboard/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never)

    const response = await GET()
    expect(response.status).toBe(401)

    const json = await response.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns agents list for authenticated user', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never)

    const membershipChain = createMockChain({
      data: { organization_id: 'org-1' },
      error: null,
    })

    const agents = [
      { id: 'a-1', name: 'Agent 1', last_seen_at: new Date().toISOString(), network_segments: [] },
      { id: 'a-2', name: 'Agent 2', last_seen_at: null, network_segments: [] },
    ]
    const agentsChain = createMockChain({ data: agents, error: null })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'organization_members') return membershipChain
        if (table === 'agents') return agentsChain
        return createMockChain()
      }),
    } as never)

    const response = await GET()
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.agents).toHaveLength(2)
    expect(json.agents[0].is_online).toBe(true)
    expect(json.agents[1].is_online).toBe(false)
  })

  it('returns 404 when user has no organization', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never)

    const membershipChain = createMockChain({
      data: null,
      error: { message: 'not found' },
    })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(membershipChain),
    } as never)

    const response = await GET()
    expect(response.status).toBe(404)
  })
})

describe('POST /api/dashboard/agents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never)

    const request = new NextRequest('http://localhost/api/dashboard/agents', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Agent' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns 403 when user lacks permission', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never)

    const membershipChain = createMockChain({
      data: { organization_id: 'org-1', role: 'viewer', permissions: {} },
      error: null,
    })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(membershipChain),
    } as never)

    const request = new NextRequest('http://localhost/api/dashboard/agents', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Agent' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(403)

    const json = await response.json()
    expect(json.error).toContain('permission')
  })

  it('enforces agent limit', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never)

    const membershipChain = createMockChain({
      data: { organization_id: 'org-1', role: 'owner', permissions: {} },
      error: null,
    })

    const orgChain = createMockChain({
      data: { plan: 'trial', agent_limit: 2, slug: 'testorg' },
      error: null,
    })

    // Agent count query returns count via the resolved value
    const countChain: Record<string, unknown> = {}
    const countMethods = ['select', 'eq', 'in', 'order', 'limit']
    for (const m of countMethods) {
      countChain[m] = vi.fn().mockReturnValue(countChain)
    }
    countChain.single = vi.fn().mockResolvedValue({ data: null, error: null })
    countChain.then = vi.fn((resolve) => resolve({ data: null, error: null, count: 2 }))

    let agentsCallIndex = 0
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'organization_members') return membershipChain
        if (table === 'organizations') return orgChain
        if (table === 'agents') {
          agentsCallIndex++
          return countChain
        }
        return createMockChain()
      }),
    } as never)

    const request = new NextRequest('http://localhost/api/dashboard/agents', {
      method: 'POST',
      body: JSON.stringify({ name: 'New Agent' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(403)

    const json = await response.json()
    expect(json.error).toContain('Agent limit reached')
  })
})

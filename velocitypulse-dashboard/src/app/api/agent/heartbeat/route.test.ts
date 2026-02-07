import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock agent-auth
vi.mock('@/lib/api/agent-auth', () => ({
  authenticateAgent: vi.fn(),
}))

// Mock rate limiting (allow all)
vi.mock('@/lib/api/rate-limit', () => ({
  checkAgentRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  checkOrgMonthlyLimit: vi.fn().mockResolvedValue({ allowed: true }),
  incrementUsage: vi.fn().mockResolvedValue(undefined),
}))

// Mock constants
vi.mock('@/lib/constants', () => ({
  LATEST_AGENT_VERSION: '2.0.0',
  AGENT_DOWNLOAD_URL: 'https://example.com/download',
  ENFORCE_AGENT_UPDATES: false,
}))

import { POST } from './route'
import { authenticateAgent } from '@/lib/api/agent-auth'
import { createServiceClient } from '@/lib/db/client'

function createMockChain(resolveValue: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit']
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.single = vi.fn().mockResolvedValue(resolveValue)
  // For queries that don't end in .single()
  chain.then = vi.fn((resolve) => resolve(resolveValue))
  return chain
}

describe('POST /api/agent/heartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when agent auth fails', async () => {
    vi.mocked(authenticateAgent).mockResolvedValue(null)

    const request = new Request('http://localhost/api/agent/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ version: '1.0.0', hostname: 'test' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)

    const json = await response.json()
    expect(json.error).toBe('Invalid or disabled API key')
  })

  it('returns 400 for invalid JSON body', async () => {
    vi.mocked(authenticateAgent).mockResolvedValue({
      agentId: 'agent-1',
      agentName: 'Test Agent',
      organizationId: 'org-1',
    })

    const request = new Request('http://localhost/api/agent/heartbeat', {
      method: 'POST',
      body: 'not json',
    })
    const response = await POST(request)
    expect(response.status).toBe(400)

    const json = await response.json()
    expect(json.error).toBe('Invalid JSON body')
  })

  it('returns heartbeat response with segments when auth succeeds', async () => {
    vi.mocked(authenticateAgent).mockResolvedValue({
      agentId: 'agent-1',
      agentName: 'Test Agent',
      organizationId: 'org-1',
    })

    const segments = [{ id: 'seg-1', cidr: '192.168.1.0/24', is_enabled: true }]
    const mockChain = createMockChain({ data: segments, error: null })
    // For the update call (no .single), also need a chain
    const updateChain = createMockChain({ data: null, error: null })
    // For the commands query
    const commandsChain = createMockChain({ data: [], error: null })

    let callIndex = 0
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'agents') {
          callIndex++
          return callIndex === 1 ? updateChain : updateChain
        }
        if (table === 'network_segments') return mockChain
        if (table === 'agent_commands') return commandsChain
        return createMockChain()
      }),
    } as never)

    const request = new Request('http://localhost/api/agent/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ version: '1.0.0', hostname: 'test' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.success).toBe(true)
    expect(json.agent_id).toBe('agent-1')
    expect(json.agent_name).toBe('Test Agent')
    expect(json.organization_id).toBe('org-1')
    expect(json.latest_agent_version).toBe('2.0.0')
    expect(json.upgrade_available).toBe(true)
  })

  it('returns upgrade_available false when agent is up to date', async () => {
    vi.mocked(authenticateAgent).mockResolvedValue({
      agentId: 'agent-1',
      agentName: 'Test Agent',
      organizationId: 'org-1',
    })

    const mockChain = createMockChain({ data: [], error: null })
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(mockChain),
    } as never)

    const request = new Request('http://localhost/api/agent/heartbeat', {
      method: 'POST',
      body: JSON.stringify({ version: '2.0.0', hostname: 'test' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.upgrade_available).toBe(false)
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock agent-auth
vi.mock('@/lib/api/agent-auth', () => ({
  authenticateAgent: vi.fn(),
}))

// Mock notifications (fire-and-forget)
vi.mock('@/lib/notifications', () => ({
  triggerDeviceNotification: vi.fn().mockResolvedValue(undefined),
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
  chain.then = vi.fn((resolve) => resolve(resolveValue))
  return chain
}

describe('POST /api/agent/devices/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when agent auth fails', async () => {
    vi.mocked(authenticateAgent).mockResolvedValue(null)

    const request = new Request('http://localhost/api/agent/devices/status', {
      method: 'POST',
      body: JSON.stringify({ reports: [] }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)

    const json = await response.json()
    expect(json.error).toBe('Invalid or disabled API key')
  })

  it('returns 400 when reports array is missing', async () => {
    vi.mocked(authenticateAgent).mockResolvedValue({
      agentId: 'agent-1',
      agentName: 'Test Agent',
      organizationId: 'org-1',
    })

    const request = new Request('http://localhost/api/agent/devices/status', {
      method: 'POST',
      body: JSON.stringify({ foo: 'bar' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)

    const json = await response.json()
    expect(json.error).toBe('Validation failed')
    expect(json.code).toBe('VALIDATION_ERROR')
  })

  it('returns 400 for invalid JSON body', async () => {
    vi.mocked(authenticateAgent).mockResolvedValue({
      agentId: 'agent-1',
      agentName: 'Test Agent',
      organizationId: 'org-1',
    })

    const request = new Request('http://localhost/api/agent/devices/status', {
      method: 'POST',
      body: 'not-json',
    })
    const response = await POST(request)
    expect(response.status).toBe(400)

    const json = await response.json()
    expect(json.error).toBe('Invalid JSON body')
  })

  it('processes valid status reports successfully', async () => {
    vi.mocked(authenticateAgent).mockResolvedValue({
      agentId: 'agent-1',
      agentName: 'Test Agent',
      organizationId: 'org-1',
    })

    const deviceData = {
      id: 'device-1',
      name: 'Server 1',
      status: 'online',
      ip_address: '192.168.1.10',
      category_id: 'cat-1',
      network_segment_id: 'seg-1',
    }

    // devices.select().eq().eq().single() -> returns device
    const devicesSelectChain = createMockChain({ data: deviceData, error: null })
    // devices.update().eq().eq() -> success
    const devicesUpdateChain = createMockChain({ data: null, error: null })
    // device_status_history.insert().then()
    const historyChain = createMockChain({ data: null, error: null })

    let devicesCallIndex = 0
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'devices') {
          devicesCallIndex++
          return devicesCallIndex === 1 ? devicesSelectChain : devicesUpdateChain
        }
        if (table === 'device_status_history') return historyChain
        return createMockChain()
      }),
    } as never)

    const request = new Request('http://localhost/api/agent/devices/status', {
      method: 'POST',
      body: JSON.stringify({
        reports: [
          {
            device_id: 'device-1',
            status: 'online',
            response_time_ms: 5,
            checked_at: new Date().toISOString(),
          },
        ],
      }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.processed).toBe(1)
    expect(json.errors).toHaveLength(0)
  })

  it('reports errors for devices not found', async () => {
    vi.mocked(authenticateAgent).mockResolvedValue({
      agentId: 'agent-1',
      agentName: 'Test Agent',
      organizationId: 'org-1',
    })

    const notFoundChain = createMockChain({ data: null, error: { message: 'not found' } })
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(notFoundChain),
    } as never)

    const request = new Request('http://localhost/api/agent/devices/status', {
      method: 'POST',
      body: JSON.stringify({
        reports: [
          {
            device_id: 'nonexistent',
            status: 'online',
            response_time_ms: 5,
            checked_at: new Date().toISOString(),
          },
        ],
      }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.processed).toBe(0)
    expect(json.errors.length).toBeGreaterThan(0)
    expect(json.success).toBe(false)
  })
})

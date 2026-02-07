import { describe, it, expect, vi, beforeEach } from 'vitest'

import { GET } from './route'
import { auth } from '@clerk/nextjs/server'
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

describe('GET /api/billing/subscription', () => {
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

  it('returns 404 when user has no organization', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never)

    const membershipChain = createMockChain({ data: null, error: null })
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(membershipChain),
    } as never)

    const response = await GET()
    expect(response.status).toBe(404)
  })

  it('returns subscription data when found', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never)

    const membershipChain = createMockChain({
      data: { organization_id: 'org-1' },
      error: null,
    })

    const subscription = {
      plan: 'starter',
      status: 'active',
      current_period_end: '2026-03-01T00:00:00Z',
      amount_cents: 5000,
    }
    const subscriptionChain = createMockChain({
      data: subscription,
      error: null,
    })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'organization_members') return membershipChain
        if (table === 'subscriptions') return subscriptionChain
        return createMockChain()
      }),
    } as never)

    const response = await GET()
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.subscription).toEqual(subscription)
    expect(json.subscription.plan).toBe('starter')
    expect(json.subscription.status).toBe('active')
  })

  it('returns null subscription when none exists', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never)

    const membershipChain = createMockChain({
      data: { organization_id: 'org-1' },
      error: null,
    })

    const noSubChain = createMockChain({ data: null, error: null })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'organization_members') return membershipChain
        if (table === 'subscriptions') return noSubChain
        return createMockChain()
      }),
    } as never)

    const response = await GET()
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.subscription).toBeNull()
  })
})

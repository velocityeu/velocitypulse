import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/constants', () => ({
  PLAN_LIMITS: {
    trial: { devices: 100, agents: 10, users: 5 },
    starter: { devices: 100, agents: 10, users: 10 },
    unlimited: { devices: 5000, agents: 100, users: 50 },
  },
  TRIAL_DURATION_DAYS: 14,
}))

vi.mock('@/lib/utils', () => ({
  generateCustomerNumber: vi.fn().mockReturnValue('VEU-000001'),
  generateUniqueSlug: vi.fn().mockReturnValue('test-org'),
}))

vi.mock('@/lib/emails/lifecycle', () => ({
  sendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
}))

import { POST, GET } from './route'
import { auth, currentUser } from '@clerk/nextjs/server'
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

describe('POST /api/onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never)

    const request = new Request('http://localhost/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({ organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(401)
  })

  it('returns existing org if user already has one', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never)
    vi.mocked(currentUser).mockResolvedValue({
      id: 'user-1',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    } as never)

    const existingOrg = {
      id: 'org-1',
      name: 'Existing Org',
      slug: 'existing-org',
      plan: 'trial',
    }

    const membershipChain = createMockChain({
      data: { organization_id: 'org-1' },
      error: null,
    })

    const orgChain = createMockChain({
      data: existingOrg,
      error: null,
    })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'organization_members') return membershipChain
        if (table === 'organizations') return orgChain
        return createMockChain()
      }),
    } as never)

    const request = new Request('http://localhost/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({ organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.isNew).toBe(false)
    expect(json.organization.name).toBe('Existing Org')
  })

  it('creates organization with correct defaults', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never)
    vi.mocked(currentUser).mockResolvedValue({
      id: 'user-1',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    } as never)

    // No existing membership
    const noMembershipChain = createMockChain({ data: null, error: { code: 'PGRST116' } })

    const newOrg = {
      id: 'org-new',
      name: 'Test Org',
      slug: 'test-org',
      plan: 'trial',
    }

    // org insert chain
    const orgInsertChain = createMockChain({ data: newOrg, error: null })
    // member insert chain
    const memberInsertChain = createMockChain({ data: null, error: null })
    // categories insert chain
    const categoriesChain = createMockChain({ data: null, error: null })
    // audit_logs insert chain
    const auditChain = createMockChain({ data: null, error: null })

    let orgMembersCallIndex = 0
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'organization_members') {
          orgMembersCallIndex++
          return orgMembersCallIndex === 1 ? noMembershipChain : memberInsertChain
        }
        if (table === 'organizations') return orgInsertChain
        if (table === 'categories') return categoriesChain
        if (table === 'audit_logs') return auditChain
        return createMockChain()
      }),
    } as never)

    const request = new Request('http://localhost/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({ organizationName: 'Test Org' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.isNew).toBe(true)
    expect(json.organization.name).toBe('Test Org')
    expect(json.organization.plan).toBe('trial')
  })

  it('returns 400 when organization name is too short', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never)
    vi.mocked(currentUser).mockResolvedValue({
      id: 'user-1',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    } as never)

    const request = new Request('http://localhost/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({ organizationName: 'X' }),
    })
    const response = await POST(request)
    expect(response.status).toBe(400)

    const json = await response.json()
    expect(json.error).toBe('Validation failed')
    expect(json.code).toBe('VALIDATION_ERROR')
  })
})

describe('GET /api/onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never)

    const response = await GET()
    expect(response.status).toBe(401)
  })

  it('returns hasOrganization: false when no org exists', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never)

    const noMembershipChain = createMockChain({ data: null, error: null })
    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(noMembershipChain),
    } as never)

    const response = await GET()
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.hasOrganization).toBe(false)
  })

  it('returns organization data when exists', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user-1' } as never)

    const orgData = {
      id: 'org-1',
      name: 'My Org',
      plan: 'starter',
    }
    const membershipChain = createMockChain({
      data: {
        role: 'owner',
        permissions: { can_manage_billing: true },
        organizations: orgData,
      },
      error: null,
    })

    vi.mocked(createServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue(membershipChain),
    } as never)

    const response = await GET()
    expect(response.status).toBe(200)

    const json = await response.json()
    expect(json.hasOrganization).toBe(true)
    expect(json.organization.name).toBe('My Org')
    expect(json.role).toBe('owner')
  })
})

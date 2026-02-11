import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./env', () => ({
  isResendConfigured: vi.fn(),
  isSupabaseConfigured: vi.fn(),
  isZohoConfigured: vi.fn(),
  isDevelopment: vi.fn(),
}))

vi.mock('./zoho', () => ({
  createContactFormTicket: vi.fn(),
  createPartnerApplicationTicket: vi.fn(),
}))

import { deliverContactForm } from './form-delivery'
import { isDevelopment, isResendConfigured, isSupabaseConfigured, isZohoConfigured } from './env'

describe('form delivery contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isDevelopment).mockReturnValue(false)
    vi.mocked(isResendConfigured).mockReturnValue(false)
    vi.mocked(isSupabaseConfigured).mockReturnValue(false)
    vi.mocked(isZohoConfigured).mockReturnValue(false)
    vi.stubGlobal('fetch', vi.fn())
  })

  it('returns failure when no delivery sinks are configured', async () => {
    const result = await deliverContactForm({
      name: 'Alice',
      email: 'alice@example.com',
      subject: 'Question',
      message: 'Hello team',
    })

    expect(result.success).toBe(false)
    expect(result.configured_sinks).toBe(0)
    expect(result.successful_sinks).toBe(0)
  })

  it('returns success when at least one configured sink succeeds', async () => {
    vi.mocked(isResendConfigured).mockReturnValue(true)
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: async () => '',
    } as Response)

    const result = await deliverContactForm({
      name: 'Alice',
      email: 'alice@example.com',
      subject: 'Question',
      message: 'Hello team',
    })

    expect(result.success).toBe(true)
    expect(result.configured_sinks).toBe(1)
    expect(result.successful_sinks).toBe(1)
  })

  it('returns failure when configured sinks all fail', async () => {
    vi.mocked(isResendConfigured).mockReturnValue(true)
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'Service unavailable',
    } as Response)

    const result = await deliverContactForm({
      name: 'Alice',
      email: 'alice@example.com',
      subject: 'Question',
      message: 'Hello team',
    })

    expect(result.success).toBe(false)
    expect(result.configured_sinks).toBe(1)
    expect(result.failed_sinks).toBe(1)
  })
})

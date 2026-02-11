import { describe, expect, it, vi } from 'vitest'

import {
  acquireStripeWebhookEventProcessing,
  markStripeWebhookEventFailed,
  markStripeWebhookEventProcessed,
} from './stripe-webhook-events'

interface MockClientConfig {
  insertError?: unknown
  selectData?: { status: 'processing' | 'processed' | 'failed'; retry_count: number | null } | null
  selectError?: unknown
  updateError?: unknown
}

function createMockSupabaseClient(config: MockClientConfig = {}) {
  const insert = vi.fn().mockResolvedValue({ error: config.insertError ?? null })
  const single = vi.fn().mockResolvedValue({
    data: config.selectData ?? null,
    error: config.selectError ?? null,
  })
  const selectEq = vi.fn().mockReturnValue({ single })
  const select = vi.fn().mockReturnValue({ eq: selectEq })

  const updateEq = vi.fn().mockResolvedValue({ error: config.updateError ?? null })
  const update = vi.fn().mockReturnValue({ eq: updateEq })

  const from = vi.fn().mockReturnValue({
    insert,
    select,
    update,
  })

  return {
    client: { from } as never,
    from,
    insert,
    select,
    selectEq,
    single,
    update,
    updateEq,
  }
}

describe('stripe webhook event helpers', () => {
  it('returns new when event is inserted for the first time', async () => {
    const mocks = createMockSupabaseClient()

    const result = await acquireStripeWebhookEventProcessing(
      mocks.client,
      'evt_new',
      'invoice.payment_succeeded'
    )

    expect(result).toBe('new')
    expect(mocks.insert).toHaveBeenCalledTimes(1)
  })

  it('returns processed on duplicate processed event', async () => {
    const mocks = createMockSupabaseClient({
      insertError: { code: '23505', message: 'duplicate key' },
      selectData: { status: 'processed', retry_count: 0 },
    })

    const result = await acquireStripeWebhookEventProcessing(
      mocks.client,
      'evt_processed',
      'invoice.payment_succeeded'
    )

    expect(result).toBe('processed')
    expect(mocks.select).toHaveBeenCalledTimes(1)
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('returns processing on duplicate in-progress event', async () => {
    const mocks = createMockSupabaseClient({
      insertError: { code: '23505', message: 'duplicate key' },
      selectData: { status: 'processing', retry_count: 0 },
    })

    const result = await acquireStripeWebhookEventProcessing(
      mocks.client,
      'evt_processing',
      'invoice.payment_succeeded'
    )

    expect(result).toBe('processing')
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('returns retry and increments retry_count for failed duplicate event', async () => {
    const mocks = createMockSupabaseClient({
      insertError: { code: '23505', message: 'duplicate key' },
      selectData: { status: 'failed', retry_count: 2 },
    })

    const result = await acquireStripeWebhookEventProcessing(
      mocks.client,
      'evt_failed',
      'invoice.payment_succeeded'
    )

    expect(result).toBe('retry')
    expect(mocks.update).toHaveBeenCalledTimes(1)
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'processing',
        retry_count: 3,
        error_message: null,
      })
    )
  })

  it('throws for non-duplicate insert errors', async () => {
    const mocks = createMockSupabaseClient({
      insertError: { code: 'PGRST500', message: 'db down' },
    })

    await expect(
      acquireStripeWebhookEventProcessing(
        mocks.client,
        'evt_fail',
        'invoice.payment_succeeded'
      )
    ).rejects.toEqual({ code: 'PGRST500', message: 'db down' })
  })

  it('marks event processed and failed without throwing', async () => {
    const mocks = createMockSupabaseClient()

    await expect(markStripeWebhookEventProcessed(mocks.client, 'evt_marked')).resolves.toBeUndefined()
    await expect(markStripeWebhookEventFailed(mocks.client, 'evt_marked', 'boom')).resolves.toBeUndefined()

    expect(mocks.update).toHaveBeenCalledTimes(2)
  })
})


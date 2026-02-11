import { afterEach, describe, expect, it } from 'vitest'

import { resolvePaidPlanFromPriceId } from './stripe-pricing'

const ORIGINAL_ENV = {
  starter: process.env.STRIPE_STARTER_PRICE_ID,
  unlimited: process.env.STRIPE_UNLIMITED_PRICE_ID,
}

describe('resolvePaidPlanFromPriceId', () => {
  afterEach(() => {
    process.env.STRIPE_STARTER_PRICE_ID = ORIGINAL_ENV.starter
    process.env.STRIPE_UNLIMITED_PRICE_ID = ORIGINAL_ENV.unlimited
  })

  it('resolves starter and unlimited plans from configured price IDs', () => {
    process.env.STRIPE_STARTER_PRICE_ID = 'price_starter_test'
    process.env.STRIPE_UNLIMITED_PRICE_ID = 'price_unlimited_test'

    expect(resolvePaidPlanFromPriceId('price_starter_test')).toBe('starter')
    expect(resolvePaidPlanFromPriceId('price_unlimited_test')).toBe('unlimited')
  })

  it('returns null for unsupported price IDs', () => {
    process.env.STRIPE_STARTER_PRICE_ID = 'price_starter_test'
    process.env.STRIPE_UNLIMITED_PRICE_ID = 'price_unlimited_test'

    expect(resolvePaidPlanFromPriceId('price_other_test')).toBeNull()
  })

  it('throws when required Stripe price env variables are missing', () => {
    delete process.env.STRIPE_STARTER_PRICE_ID
    delete process.env.STRIPE_UNLIMITED_PRICE_ID

    expect(() => resolvePaidPlanFromPriceId('price_starter_test')).toThrow(
      'STRIPE_STARTER_PRICE_ID and STRIPE_UNLIMITED_PRICE_ID must be configured'
    )
  })
})


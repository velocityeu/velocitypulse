import { describe, expect, it } from 'vitest'

import {
  isStripeEventStale,
  mapStripeSubscriptionStatus,
} from './stripe-webhook-lifecycle'

describe('stripe webhook lifecycle helpers', () => {
  it('maps active and trialing statuses to active organization/subscription states', () => {
    expect(mapStripeSubscriptionStatus('active')).toEqual({
      subscriptionStatus: 'active',
      organizationStatus: 'active',
    })

    expect(mapStripeSubscriptionStatus('trialing')).toEqual({
      subscriptionStatus: 'active',
      organizationStatus: 'active',
    })
  })

  it('maps past_due and unpaid to past_due states', () => {
    expect(mapStripeSubscriptionStatus('past_due')).toEqual({
      subscriptionStatus: 'past_due',
      organizationStatus: 'past_due',
    })

    expect(mapStripeSubscriptionStatus('unpaid')).toEqual({
      subscriptionStatus: 'past_due',
      organizationStatus: 'past_due',
    })
  })

  it('maps canceled to cancelled', () => {
    expect(mapStripeSubscriptionStatus('canceled')).toEqual({
      subscriptionStatus: 'cancelled',
      organizationStatus: 'cancelled',
    })
  })

  it('maps incomplete family to suspended/incomplete', () => {
    expect(mapStripeSubscriptionStatus('incomplete')).toEqual({
      subscriptionStatus: 'incomplete',
      organizationStatus: 'suspended',
    })

    expect(mapStripeSubscriptionStatus('incomplete_expired')).toEqual({
      subscriptionStatus: 'incomplete',
      organizationStatus: 'suspended',
    })

    expect(mapStripeSubscriptionStatus('paused')).toEqual({
      subscriptionStatus: 'incomplete',
      organizationStatus: 'suspended',
    })
  })

  it('detects stale events when incoming created timestamp is older', () => {
    expect(isStripeEventStale(100, 101)).toBe(true)
    expect(isStripeEventStale(101, 101)).toBe(false)
    expect(isStripeEventStale(102, 101)).toBe(false)
  })
})

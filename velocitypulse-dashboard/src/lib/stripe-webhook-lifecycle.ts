import type Stripe from 'stripe'

export type LocalSubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'incomplete'
export type LocalOrganizationStatus = 'active' | 'past_due' | 'suspended' | 'cancelled'

export function mapStripeSubscriptionStatus(
  stripeStatus: Stripe.Subscription.Status
): {
  subscriptionStatus: LocalSubscriptionStatus
  organizationStatus: LocalOrganizationStatus
} {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return { subscriptionStatus: 'active', organizationStatus: 'active' }
    case 'past_due':
    case 'unpaid':
      return { subscriptionStatus: 'past_due', organizationStatus: 'past_due' }
    case 'canceled':
      return { subscriptionStatus: 'cancelled', organizationStatus: 'cancelled' }
    case 'incomplete':
    case 'incomplete_expired':
    case 'paused':
    default:
      return { subscriptionStatus: 'incomplete', organizationStatus: 'suspended' }
  }
}

export function isStripeEventStale(
  incomingEventCreated: number,
  lastAppliedEventCreated: number | null | undefined
): boolean {
  return (lastAppliedEventCreated ?? 0) > incomingEventCreated
}

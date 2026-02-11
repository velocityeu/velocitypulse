export type PaidPlan = 'starter' | 'unlimited'

interface StripePriceConfig {
  starter: string
  unlimited: string
}

function getStripePriceConfig(): StripePriceConfig {
  const starter = process.env.STRIPE_STARTER_PRICE_ID
  const unlimited = process.env.STRIPE_UNLIMITED_PRICE_ID

  if (!starter || !unlimited) {
    throw new Error('STRIPE_STARTER_PRICE_ID and STRIPE_UNLIMITED_PRICE_ID must be configured')
  }

  return { starter, unlimited }
}

export function resolvePaidPlanFromPriceId(priceId: string): PaidPlan | null {
  const prices = getStripePriceConfig()

  if (priceId === prices.starter) return 'starter'
  if (priceId === prices.unlimited) return 'unlimited'
  return null
}


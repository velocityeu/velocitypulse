// ==============================================
// VelocityPulse Constants
// ==============================================

// Dashboard version
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.1.0'

// Agent version management
export const LATEST_AGENT_VERSION = process.env.LATEST_AGENT_VERSION || '1.0.0'
export const AGENT_DOWNLOAD_URL = process.env.AGENT_DOWNLOAD_URL || 'https://github.com/velocityeu/velocitypulse-agent/releases/latest'
export const ENFORCE_AGENT_UPDATES = process.env.ENFORCE_AGENT_UPDATES === 'true'

// Trial duration
export const TRIAL_DURATION_DAYS = 14

// Plan pricing (yearly in pence)
export const STARTER_PRICE_YEARLY = 5000 // £50
export const UNLIMITED_PRICE_YEARLY = 95000 // £950

// Plan limits
export const PLAN_LIMITS = {
  trial: {
    devices: 100,
    agents: 10,
    users: 5,
    apiCallsPerMonth: 10000,
    whiteLabel: false,
    sso: false,
  },
  starter: {
    devices: 100,
    agents: 10,
    users: 10,
    apiCallsPerMonth: 50000,
    whiteLabel: false,
    sso: false,
  },
  unlimited: {
    devices: 5000,
    agents: 100,
    users: 50,
    apiCallsPerMonth: -1, // unlimited
    whiteLabel: true,
    sso: true,
  },
} as const

// Centralized plan definitions (used by PlanCards, billing page, onboarding, trial-expired)
export const PLANS = [
  {
    id: 'trial' as const,
    name: 'Trial',
    price: 'Free',
    period: '14 days',
    description: 'Try VelocityPulse with full features',
    features: [
      'Up to 100 devices',
      'Up to 10 agents',
      'Up to 5 users',
      '10,000 API calls/month',
      'Email support',
    ],
    priceId: null as string | null,
  },
  {
    id: 'starter' as const,
    name: 'Starter',
    price: '\u00a350',
    period: '/year',
    description: 'For small teams and organizations',
    features: [
      'Up to 100 devices',
      'Up to 10 agents',
      'Up to 10 users',
      '50,000 API calls/month',
      'Priority email support',
      'Audit logs',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || 'price_1Sv1fgClbxBbMUCj2cyRStNN',
    popular: true,
  },
  {
    id: 'unlimited' as const,
    name: 'Unlimited',
    price: '\u00a3950',
    period: '/year',
    description: 'For large organizations',
    features: [
      'Up to 5,000 devices',
      'Up to 100 agents',
      'Up to 50 users',
      'Unlimited API calls',
      'Priority phone & email support',
      'Advanced audit logs',
      'Custom integrations',
      'SLA guarantee',
      'White-label branding',
      'SSO / SAML authentication',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_UNLIMITED_PRICE_ID || 'price_1Sv1hNClbxBbMUCj68XSyZ5D',
  },
] as const

export type PlanId = 'trial' | 'starter' | 'unlimited'

// Default branding (used when no custom branding is set)
export const DEFAULT_BRANDING = {
  displayName: 'VelocityPulse',
  logoUrl: '/velocity-symbol.png',
} as const

// Rate limits (per hour)
export const RATE_LIMITS = {
  agentHeartbeat: 120, // 2 per minute max
  deviceUpdates: 1000,
  apiCalls: 500,
} as const

// Grace periods (in days)
export const GRACE_PERIODS = {
  paymentFailed: 7, // Days before suspension after payment failure
  dataRetention: 30, // Days to keep data after cancellation
} as const

// Agent online threshold (in milliseconds)
export const AGENT_ONLINE_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

// API Key format prefix
export const API_KEY_PREFIX = 'vp_' // vp_{org_prefix}_{random}

// Customer number prefix
export const CUSTOMER_NUMBER_PREFIX = 'VEU-'

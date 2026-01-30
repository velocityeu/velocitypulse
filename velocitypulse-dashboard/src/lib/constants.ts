// ==============================================
// VelocityPulse Constants
// ==============================================

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
  },
  starter: {
    devices: 100,
    agents: 10,
    users: 10,
    apiCallsPerMonth: 50000,
  },
  unlimited: {
    devices: 5000,
    agents: 100,
    users: 50,
    apiCallsPerMonth: -1, // unlimited
  },
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

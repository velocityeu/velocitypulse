import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('env validation', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
    // Clear all Stripe/Resend/Supabase/Zoho env vars
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_WEBHOOK_SECRET
    delete process.env.STRIPE_PRICE_STARTER
    delete process.env.STRIPE_PRICE_UNLIMITED
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
    delete process.env.RESEND_API_KEY
    delete process.env.ZOHO_ACCESS_TOKEN
    delete process.env.ZOHO_ORG_ID
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    // Reset module cache so env caches are cleared
    vi.resetModules()
  })

  describe('getServerEnv', () => {
    it('throws when STRIPE_SECRET_KEY is missing', async () => {
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123'
      process.env.STRIPE_PRICE_STARTER = 'price_starter123'
      process.env.STRIPE_PRICE_UNLIMITED = 'price_unlimited123'

      const { getServerEnv } = await import('./env.js')
      expect(() => getServerEnv()).toThrow('STRIPE_SECRET_KEY')
    })

    it('throws when STRIPE_SECRET_KEY has wrong prefix', async () => {
      process.env.STRIPE_SECRET_KEY = 'wrong_prefix'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123'
      process.env.STRIPE_PRICE_STARTER = 'price_starter123'
      process.env.STRIPE_PRICE_UNLIMITED = 'price_unlimited123'

      const { getServerEnv } = await import('./env.js')
      expect(() => getServerEnv()).toThrow('STRIPE_SECRET_KEY')
    })

    it('returns valid config with all required vars set', async () => {
      process.env.STRIPE_SECRET_KEY = 'sk_test_123'
      process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test123'
      process.env.STRIPE_PRICE_STARTER = 'price_starter123'
      process.env.STRIPE_PRICE_UNLIMITED = 'price_unlimited123'

      const { getServerEnv } = await import('./env.js')
      const env = getServerEnv()
      expect(env.STRIPE_SECRET_KEY).toBe('sk_test_123')
      expect(env.STRIPE_WEBHOOK_SECRET).toBe('whsec_test123')
    })
  })

  describe('getClientEnv', () => {
    it('throws when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing', async () => {
      const { getClientEnv } = await import('./env.js')
      expect(() => getClientEnv()).toThrow('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
    })

    it('throws when NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY has wrong prefix', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'wrong_prefix'

      const { getClientEnv } = await import('./env.js')
      expect(() => getClientEnv()).toThrow('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY')
    })

    it('returns valid config with correct key', async () => {
      process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = 'pk_test_abc123'

      const { getClientEnv } = await import('./env.js')
      const env = getClientEnv()
      expect(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).toBe('pk_test_abc123')
    })
  })

  describe('helper functions', () => {
    it('isDevelopment returns true when NODE_ENV is development', async () => {
      process.env.NODE_ENV = 'development'
      const { isDevelopment } = await import('./env.js')
      expect(isDevelopment()).toBe(true)
    })

    it('isDevelopment returns false when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production'
      const { isDevelopment } = await import('./env.js')
      expect(isDevelopment()).toBe(false)
    })

    it('isProduction returns true when NODE_ENV is production', async () => {
      process.env.NODE_ENV = 'production'
      const { isProduction } = await import('./env.js')
      expect(isProduction()).toBe(true)
    })

    it('isZohoConfigured returns true when both vars are set', async () => {
      process.env.ZOHO_ACCESS_TOKEN = 'token123'
      process.env.ZOHO_ORG_ID = 'org123'
      const { isZohoConfigured } = await import('./env.js')
      expect(isZohoConfigured()).toBe(true)
    })

    it('isZohoConfigured returns false when vars are missing', async () => {
      const { isZohoConfigured } = await import('./env.js')
      expect(isZohoConfigured()).toBe(false)
    })
  })
})

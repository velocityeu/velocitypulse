import { describe, expect, it } from 'vitest'

import { validateNotificationChannelConfig } from './channel-validation'

describe('notification channel validation', () => {
  it('accepts valid email config', () => {
    const result = validateNotificationChannelConfig('email', {
      recipients: ['ops@example.com', 'alerts@example.com'],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('email')
      if (result.data.type === 'email') {
        expect(result.data.recipients).toHaveLength(2)
      }
    }
  })

  it('rejects invalid email config', () => {
    const result = validateNotificationChannelConfig('email', {
      recipients: ['not-an-email'],
    })

    expect(result.success).toBe(false)
  })

  it('accepts webhook config and applies method default', () => {
    const result = validateNotificationChannelConfig('webhook', {
      url: 'https://example.com/hooks/notify',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('webhook')
      if (result.data.type === 'webhook') {
        expect(result.data.method).toBe('POST')
      }
    }
  })

  it('rejects invalid slack config URL', () => {
    const result = validateNotificationChannelConfig('slack', {
      webhook_url: 'not-a-url',
    })

    expect(result.success).toBe(false)
  })
})

import { test, expect } from '@playwright/test'

test.describe('Smoke tests', () => {
  test('root redirects to sign-in for unauthenticated users', async ({ page }) => {
    const response = await page.goto('/')
    expect(response?.status()).toBeLessThan(500)
    // Should eventually land on sign-in (Clerk redirect)
    await page.waitForURL(/sign-in/, { timeout: 10_000 })
    expect(page.url()).toContain('sign-in')
  })

  test('sign-in page renders', async ({ page }) => {
    const response = await page.goto('/sign-in')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('dashboard redirects unauthenticated users', async ({ page }) => {
    const response = await page.goto('/dashboard')
    expect(response?.status()).toBeLessThan(500)
    // Should redirect to sign-in
    await page.waitForURL(/sign-in/, { timeout: 10_000 })
  })

  test('API heartbeat returns 401 without auth', async ({ request }) => {
    const response = await request.post('/api/agent/heartbeat', {
      data: { version: '1.0.0', hostname: 'smoke-test' },
    })
    expect(response.status()).toBe(401)
    const json = await response.json()
    expect(json.error).toBeTruthy()
  })

  test('API onboarding GET returns 401 without auth', async ({ request }) => {
    const response = await request.get('/api/onboarding')
    expect(response.status()).toBe(401)
  })
})

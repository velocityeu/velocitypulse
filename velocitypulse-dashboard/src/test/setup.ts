import { vi } from 'vitest'

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'test-user-id', sessionClaims: {} }),
  currentUser: vi.fn().mockResolvedValue({
    id: 'test-user-id',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
  }),
  clerkMiddleware: vi.fn((handler) => handler),
  createRouteMatcher: vi.fn(() => () => false),
}))

// Mock Supabase client
vi.mock('@/lib/db/client', () => {
  const mockFrom = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn(),
  })
  return {
    createServiceClient: vi.fn(() => ({ from: mockFrom })),
    getAdminClient: vi.fn(() => ({ from: mockFrom })),
  }
})

// Mock Sentry
vi.mock('@sentry/nextjs', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: vi.fn((cb) => cb({ setExtra: vi.fn(), setTag: vi.fn() })),
}))

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Map([
    ['authorization', 'Bearer vp_testorg1_abcdefghijklmnopqrstuv'],
    ['x-forwarded-for', '127.0.0.1'],
  ])),
  cookies: vi.fn().mockReturnValue({
    get: vi.fn(),
    set: vi.fn(),
  }),
}))

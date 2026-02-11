import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ---- Route matchers (from existing proxy.ts) ----
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboarding(.*)',
  '/account-blocked(.*)',
  '/trial-expired(.*)',
  '/api/webhook/stripe',
  '/api/webhook/clerk',
  '/api/agent/(.*)',
  '/api/cron/(.*)',
  '/api/health',
  '/accept-invite(.*)',
  '/api/invitations/verify',
])

const isInternalRoute = createRouteMatcher([
  '/internal(.*)',
  '/api/internal(.*)',
])

const isBillingRoute = createRouteMatcher([
  '/billing(.*)',
  '/api/billing/(.*)',
  '/api/checkout(.*)',
  '/api/onboarding(.*)',
])

// ---- Security headers ----
const securityHeaders: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-API-Version': '1',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.clerk.accounts.dev https://clerk.velocitypulse.io https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co https://img.clerk.com",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.clerk.accounts.dev https://clerk.velocitypulse.io https://*.ingest.sentry.io https://challenges.cloudflare.com",
    "frame-src https://js.stripe.com https://*.clerk.accounts.dev https://clerk.velocitypulse.io https://challenges.cloudflare.com",
    "worker-src 'self' blob:",
    "child-src 'self' blob:",
    "form-action 'self'",
  ].join('; '),
}

// ---- Rate limiting (in-memory, simple per-IP) ----
// Note: This resets on serverless cold starts — sufficient for basic protection
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
  '/api/agent/heartbeat': { max: 120, windowMs: 60000 },
  '/api/agent/devices/status': { max: 60, windowMs: 60000 },
  '/api/agent/devices/discovered': { max: 30, windowMs: 60000 },
  '/api/onboarding': { max: 20, windowMs: 60000 },
  '/api/checkout/embedded': { max: 10, windowMs: 60000 },
  '/api/checkout': { max: 10, windowMs: 60000 },
  '/api/billing/change-plan': { max: 5, windowMs: 60000 },
  '/api/billing/cancel': { max: 3, windowMs: 60000 },
  '/api/billing/update-payment': { max: 5, windowMs: 60000 },
  '/api/billing/reactivate': { max: 5, windowMs: 60000 },
  '/api/dashboard/agents': { max: 10, windowMs: 60000 },
  '/api/invitations/accept': { max: 10, windowMs: 60000 },
  '/api/invitations/verify': { max: 20, windowMs: 60000 },
}

function checkRateLimit(ip: string, path: string): boolean {
  // Find matching rate limit rule
  const rule = Object.entries(RATE_LIMITS).find(([prefix]) => path.startsWith(prefix))
  if (!rule) return true // No rate limit for this path

  const [, { max, windowMs }] = rule
  const key = `${ip}:${rule[0]}`
  const now = Date.now()

  const entry = rateLimitMap.get(key)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  entry.count++
  return entry.count <= max
}

// ---- Singleton Supabase client for middleware ----
let middlewareClient: SupabaseClient | null = null
function getMiddlewareClient(): SupabaseClient | null {
  if (middlewareClient) return middlewareClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  middlewareClient = createClient(url, key)
  return middlewareClient
}

// ---- Org status check (from existing proxy.ts) ----
async function getOrgStatus(userId: string): Promise<{
  status: string
  trial_ends_at: string | null
} | null> {
  const supabase = getMiddlewareClient()
  if (!supabase) return null

  try {
    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userId)
      .limit(1)
      .single()
    if (!membership) return null

    const { data: org } = await supabase
      .from('organizations')
      .select('status, trial_ends_at')
      .eq('id', membership.organization_id)
      .single()
    return org ?? null
  } catch {
    return null
  }
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value)
  }
  return response
}

export default clerkMiddleware(async (auth, request) => {
  const { pathname } = request.nextUrl
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'

  // Rate limiting check (for POST endpoints)
  if (request.method === 'POST' && !checkRateLimit(ip, pathname)) {
    const response = NextResponse.json(
      { error: 'Too many requests', code: 'RATE_LIMITED' },
      { status: 429 }
    )
    response.headers.set('Retry-After', '60')
    return addSecurityHeaders(response)
  }

  // Public routes
  if (isPublicRoute(request)) {
    return addSecurityHeaders(NextResponse.next())
  }

  // Auth check
  const { userId, sessionClaims } = await auth()
  if (!userId) {
    // API routes get a JSON 401 — never redirect to HTML
    if (pathname.startsWith('/api/')) {
      return addSecurityHeaders(
        NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      )
    }
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirect_url', request.url)
    return addSecurityHeaders(NextResponse.redirect(signInUrl))
  }

  // Internal routes require staff role (checked via Supabase users table)
  if (isInternalRoute(request)) {
    let isStaff = false

    try {
      const sb = getMiddlewareClient()
      if (sb) {
        const { data: staffUser } = await sb
          .from('users')
          .select('is_staff')
          .eq('id', userId)
          .single()
        isStaff = staffUser?.is_staff === true
      }
    } catch (err) {
      console.error('Staff check failed for user', userId, err)
    }

    if (!isStaff) {
      // API routes get JSON 403, page routes get redirected
      if (pathname.startsWith('/api/')) {
        return addSecurityHeaders(
          NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        )
      }
      return addSecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)))
    }
  }

  // Skip org status checks for billing routes
  if (isBillingRoute(request)) {
    return addSecurityHeaders(NextResponse.next())
  }

  // Check org status
  const org = await getOrgStatus(userId)
  if (!org) {
    return addSecurityHeaders(NextResponse.next())
  }

  const { status, trial_ends_at } = org
  if (status === 'suspended' || status === 'cancelled') {
    return addSecurityHeaders(NextResponse.redirect(new URL('/account-blocked', request.url)))
  }
  if (status === 'trial' && trial_ends_at && new Date(trial_ends_at) < new Date()) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/trial-expired', request.url)))
  }

  return addSecurityHeaders(NextResponse.next())
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}

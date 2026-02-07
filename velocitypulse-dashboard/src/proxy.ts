import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/onboarding(.*)',
  '/account-blocked(.*)',
  '/trial-expired(.*)',
  '/api/webhook/stripe',
  '/api/agent/(.*)', // Agent API uses API key auth, not Clerk
  '/api/cron/(.*)', // Cron routes use CRON_SECRET auth
])

// Internal admin routes require staff role
const isInternalRoute = createRouteMatcher([
  '/internal(.*)',
  '/api/internal(.*)',
])

// Routes that bypass org status checks (billing must be accessible even when blocked)
const isBillingRoute = createRouteMatcher([
  '/billing(.*)',
  '/api/billing/(.*)',
  '/api/checkout(.*)',
  '/api/onboarding(.*)',
])

/**
 * Lightweight Supabase lookup for org status.
 * Uses service role to bypass RLS. Only fetches the minimum fields needed.
 */
async function getOrgStatus(userId: string): Promise<{
  status: string
  trial_ends_at: string | null
} | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) return null

  try {
    const supabase = createClient(url, key)

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

export default clerkMiddleware(async (auth, request) => {
  // Allow public routes
  if (isPublicRoute(request)) {
    return NextResponse.next()
  }

  // Check auth for protected routes
  const { userId, sessionClaims } = await auth()

  // Redirect unauthenticated users to sign in
  if (!userId) {
    const signInUrl = new URL('/sign-in', request.url)
    signInUrl.searchParams.set('redirect_url', request.url)
    return NextResponse.redirect(signInUrl)
  }

  // Check internal routes require staff role
  if (isInternalRoute(request)) {
    const metadata = sessionClaims?.metadata as { role?: string } | undefined
    const userRole = metadata?.role
    if (userRole !== 'staff' && userRole !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Skip org status checks for billing/checkout routes (must remain accessible)
  if (isBillingRoute(request)) {
    return NextResponse.next()
  }

  // Check org status for dashboard routes
  const org = await getOrgStatus(userId)

  // No org found = probably needs onboarding, let the page handle it
  if (!org) {
    return NextResponse.next()
  }

  const { status, trial_ends_at } = org

  // Suspended or cancelled → account blocked
  if (status === 'suspended' || status === 'cancelled') {
    return NextResponse.redirect(new URL('/account-blocked', request.url))
  }

  // Trial expired → trial expired page
  if (status === 'trial' && trial_ends_at && new Date(trial_ends_at) < new Date()) {
    return NextResponse.redirect(new URL('/trial-expired', request.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}

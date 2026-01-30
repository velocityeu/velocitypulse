import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhook/stripe',
  '/api/agent/(.*)', // Agent API uses API key auth, not Clerk
])

// Internal admin routes require staff role
const isInternalRoute = createRouteMatcher([
  '/internal(.*)',
  '/api/internal(.*)',
])

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

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

interface UpstashConfig {
  url: string
  token: string
}

const rateLimitConfigs: Record<string, RateLimitConfig> = {
  '/api/contact': { maxRequests: 5, windowMs: 60 * 1000 },
  '/api/partners': { maxRequests: 3, windowMs: 60 * 1000 },
}

const localRateLimitStore = new Map<string, { count: number; resetTime: number }>()

function getRateLimitConfig(path: string): RateLimitConfig | null {
  for (const [route, config] of Object.entries(rateLimitConfigs)) {
    if (path.startsWith(route)) return config
  }

  return null
}

function getRateLimitKey(ip: string, path: string): string {
  return `ratelimit:${path}:${ip}`
}

function cleanupLocalStore(now: number): void {
  for (const [key, record] of localRateLimitStore.entries()) {
    if (now > record.resetTime) {
      localRateLimitStore.delete(key)
    }
  }
}

function checkLocalRateLimit(ip: string, path: string, config: RateLimitConfig): boolean {
  const now = Date.now()
  cleanupLocalStore(now)

  const key = getRateLimitKey(ip, path)
  const record = localRateLimitStore.get(key)

  if (!record || now > record.resetTime) {
    localRateLimitStore.set(key, { count: 1, resetTime: now + config.windowMs })
    return false
  }

  record.count += 1
  return record.count > config.maxRequests
}

function getUpstashConfig(): UpstashConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim()
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim()

  if (!url || !token) return null

  return {
    url: url.replace(/\/$/, ''),
    token,
  }
}

async function checkUpstashRateLimit(
  key: string,
  config: RateLimitConfig,
  upstash: UpstashConfig
): Promise<boolean> {
  const headers = {
    Authorization: `Bearer ${upstash.token}`,
    'Content-Type': 'application/json',
  }

  const incrementResponse = await fetch(`${upstash.url}/incr/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers,
    cache: 'no-store',
  })

  if (!incrementResponse.ok) {
    throw new Error(`Upstash INCR failed: ${incrementResponse.status}`)
  }

  const incrementJson = await incrementResponse.json() as { result?: number }
  const count = Number(incrementJson.result || 0)

  if (count <= 1) {
    const ttlSeconds = Math.max(1, Math.ceil(config.windowMs / 1000))
    const expireResponse = await fetch(`${upstash.url}/expire/${encodeURIComponent(key)}/${ttlSeconds}`, {
      method: 'POST',
      headers,
      cache: 'no-store',
    })

    if (!expireResponse.ok) {
      throw new Error(`Upstash EXPIRE failed: ${expireResponse.status}`)
    }
  }

  return count > config.maxRequests
}

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown'
  }

  return request.headers.get('x-real-ip') || 'unknown'
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=31536000; includeSubDomains'
  )

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://*.ingest.sentry.io",
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  response.headers.set('Content-Security-Policy', csp)

  if (request.method === 'POST' && request.nextUrl.pathname.startsWith('/api/')) {
    const config = getRateLimitConfig(request.nextUrl.pathname)
    if (config) {
      const ip = getClientIp(request)
      const key = getRateLimitKey(ip, request.nextUrl.pathname)

      let limited = false
      const upstash = getUpstashConfig()

      if (upstash) {
        try {
          limited = await checkUpstashRateLimit(key, config, upstash)
        } catch (error) {
          console.error('[RateLimit] Upstash check failed, falling back to local store:', error)
          limited = checkLocalRateLimit(ip, request.nextUrl.pathname, config)
        }
      } else {
        limited = checkLocalRateLimit(ip, request.nextUrl.pathname, config)
      }

      if (limited) {
        return new NextResponse(
          JSON.stringify({ error: 'Too many requests. Please try again later.' }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': '60',
            },
          }
        )
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

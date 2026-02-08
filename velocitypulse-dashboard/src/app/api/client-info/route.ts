import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/client-info
 * Public endpoint returning the caller's IP address.
 */
export async function GET(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0]?.trim() || realIp || 'Unknown'

  return NextResponse.json({ ip })
}

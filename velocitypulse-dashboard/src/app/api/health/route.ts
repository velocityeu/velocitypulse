import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const response: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
  }

  // Check Supabase connectivity with latency measurement
  try {
    const supabase = createServiceClient()
    const start = performance.now()
    const { error } = await supabase.from('organizations').select('id').limit(1)
    const latency = Math.round(performance.now() - start)

    response.latency_ms = latency
    response.database = error ? 'error' : 'connected'
    response.status = error ? 'degraded' : 'healthy'
  } catch {
    response.database = 'unreachable'
    response.status = 'degraded'
  }

  const statusCode = response.status === 'healthy' ? 200 : 503
  return NextResponse.json(response, { status: statusCode })
}

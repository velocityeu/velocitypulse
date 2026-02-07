import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/db/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const response: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
  }

  // Optional: check Supabase connectivity
  try {
    const supabase = createServiceClient()
    const { error } = await supabase.from('organizations').select('id').limit(1)
    response.database = error ? 'error' : 'connected'
  } catch {
    response.database = 'unreachable'
  }

  return NextResponse.json(response)
}

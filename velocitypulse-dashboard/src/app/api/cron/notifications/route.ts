import { NextRequest, NextResponse } from 'next/server'
import { getNotificationService } from '@/lib/notifications'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'

async function handleNotificationRetryCron(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret && process.env.NODE_ENV === 'production') {
    logger.error('CRON_SECRET is not configured', { route: 'api/cron/notifications' })
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 500 }
    )
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limitParam = request.nextUrl.searchParams.get('limit')
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : 50
  const limit = Number.isFinite(parsedLimit)
    ? Math.max(1, Math.min(parsedLimit, 200))
    : 50

  try {
    const result = await getNotificationService().processRetryQueue(limit)
    return NextResponse.json({
      success: true,
      limit,
      ...result,
    })
  } catch (error) {
    logger.error('Notification retry cron failed', error, { route: 'api/cron/notifications', limit })
    return NextResponse.json(
      { error: 'Notification retry cron failed', limit },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleNotificationRetryCron(request)
}

export async function POST(request: NextRequest) {
  return handleNotificationRetryCron(request)
}

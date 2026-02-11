import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/logger'

type StripeWebhookEventStatus = 'processing' | 'processed' | 'failed'
type AcquireWebhookEventResult = 'new' | 'processed' | 'processing' | 'retry'

interface StripeWebhookEventRow {
  status: StripeWebhookEventStatus
  retry_count: number | null
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const code = (error as { code?: string }).code
  if (code === '23505') return true

  const message = (error as { message?: string }).message || ''
  return /duplicate key/i.test(message)
}

export async function acquireStripeWebhookEventProcessing(
  supabase: SupabaseClient,
  eventId: string,
  eventType: string
): Promise<AcquireWebhookEventResult> {
  const now = new Date().toISOString()

  const { error: insertError } = await supabase
    .from('stripe_webhook_events')
    .insert({
      event_id: eventId,
      event_type: eventType,
      status: 'processing',
      last_attempt_at: now,
    })

  if (!insertError) {
    return 'new'
  }

  if (!isUniqueViolation(insertError)) {
    throw insertError
  }

  const { data: existing, error: existingError } = await supabase
    .from('stripe_webhook_events')
    .select('status, retry_count')
    .eq('event_id', eventId)
    .single<StripeWebhookEventRow>()

  if (existingError || !existing) {
    throw existingError || new Error('Failed to read existing webhook event state')
  }

  if (existing.status === 'processed') {
    return 'processed'
  }

  if (existing.status === 'processing') {
    return 'processing'
  }

  const retryCount = (existing.retry_count ?? 0) + 1
  const { error: updateError } = await supabase
    .from('stripe_webhook_events')
    .update({
      event_type: eventType,
      status: 'processing',
      retry_count: retryCount,
      error_message: null,
      last_attempt_at: now,
    })
    .eq('event_id', eventId)

  if (updateError) {
    throw updateError
  }

  return 'retry'
}

export async function markStripeWebhookEventProcessed(
  supabase: SupabaseClient,
  eventId: string
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('stripe_webhook_events')
    .update({
      status: 'processed',
      processed_at: now,
      last_attempt_at: now,
      error_message: null,
    })
    .eq('event_id', eventId)

  if (error) {
    logger.error('Failed to mark Stripe webhook event as processed', error, {
      eventId,
      route: 'api/webhook/stripe',
    })
  }
}

export async function markStripeWebhookEventFailed(
  supabase: SupabaseClient,
  eventId: string,
  errorMessage: string
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('stripe_webhook_events')
    .update({
      status: 'failed',
      error_message: errorMessage,
      last_attempt_at: now,
    })
    .eq('event_id', eventId)

  if (error) {
    logger.error('Failed to mark Stripe webhook event as failed', error, {
      eventId,
      route: 'api/webhook/stripe',
    })
  }
}


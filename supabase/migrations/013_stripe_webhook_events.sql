-- Stripe webhook event idempotency ledger
-- Prevents duplicate side effects from replayed events and supports safe retries after failures.

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id VARCHAR(255) PRIMARY KEY,
  event_type VARCHAR(120) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'processed', 'failed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_status
  ON stripe_webhook_events(status);

CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_last_attempt
  ON stripe_webhook_events(last_attempt_at DESC);

-- Reuse existing update_updated_at() trigger function from 001
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'tr_stripe_webhook_events_updated_at'
  ) THEN
    CREATE TRIGGER tr_stripe_webhook_events_updated_at
      BEFORE UPDATE ON stripe_webhook_events
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE policyname = 'Service role full access on stripe_webhook_events'
      AND tablename = 'stripe_webhook_events'
  ) THEN
    CREATE POLICY "Service role full access on stripe_webhook_events"
      ON stripe_webhook_events FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


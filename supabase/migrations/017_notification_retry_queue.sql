-- ==============================================
-- Notification retry/dead-letter queue
-- ==============================================

CREATE TABLE IF NOT EXISTS notification_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES notification_rules(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES notification_channels(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'sent', 'dead_letter')),
  last_error TEXT,
  locked_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_retry_queue_status_next
  ON notification_retry_queue(status, next_attempt_at);

CREATE INDEX IF NOT EXISTS idx_notification_retry_queue_org
  ON notification_retry_queue(organization_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'tr_notification_retry_queue_updated_at'
  ) THEN
    CREATE TRIGGER tr_notification_retry_queue_updated_at
      BEFORE UPDATE ON notification_retry_queue
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

ALTER TABLE notification_retry_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Service role full access on notification_retry_queue'
      AND tablename = 'notification_retry_queue'
  ) THEN
    CREATE POLICY "Service role full access on notification_retry_queue"
      ON notification_retry_queue FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

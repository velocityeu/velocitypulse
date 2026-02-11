-- ==============================================
-- Outbound email delivery history
-- ==============================================

CREATE TABLE IF NOT EXISTS outbound_email_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  source VARCHAR(50) NOT NULL,
  template_key VARCHAR(100) NOT NULL,
  event_id VARCHAR(255),
  recipients TEXT[] NOT NULL DEFAULT '{}',
  provider VARCHAR(50) NOT NULL DEFAULT 'resend',
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed')),
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_outbound_email_deliveries_org
  ON outbound_email_deliveries(organization_id, attempted_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbound_email_deliveries_event
  ON outbound_email_deliveries(event_id);

ALTER TABLE outbound_email_deliveries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Service role full access on outbound_email_deliveries'
      AND tablename = 'outbound_email_deliveries'
  ) THEN
    CREATE POLICY "Service role full access on outbound_email_deliveries"
      ON outbound_email_deliveries FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

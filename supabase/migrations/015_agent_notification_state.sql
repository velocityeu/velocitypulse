-- ==============================================
-- Agent notification transition state
-- ==============================================

CREATE TABLE IF NOT EXISTS agent_notification_state (
  agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  last_notified_state VARCHAR(20) NOT NULL CHECK (last_notified_state IN ('online', 'offline')),
  last_transition_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_notification_state_org
  ON agent_notification_state(organization_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'tr_agent_notification_state_updated_at'
  ) THEN
    CREATE TRIGGER tr_agent_notification_state_updated_at
      BEFORE UPDATE ON agent_notification_state
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

ALTER TABLE agent_notification_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Service role full access on agent_notification_state'
      AND tablename = 'agent_notification_state'
  ) THEN
    CREATE POLICY "Service role full access on agent_notification_state"
      ON agent_notification_state FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

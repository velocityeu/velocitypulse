-- =============================================
-- VelocityPulse Notification System Schema
-- =============================================

-- Notification Channels (email, slack, teams, webhook)
CREATE TABLE IF NOT EXISTS notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  channel_type VARCHAR(20) NOT NULL CHECK (channel_type IN ('email', 'slack', 'teams', 'webhook')),
  config JSONB NOT NULL DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast org lookups
CREATE INDEX IF NOT EXISTS idx_notification_channels_org
  ON notification_channels(organization_id);

-- Notification Rules (what events trigger notifications)
CREATE TABLE IF NOT EXISTS notification_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN (
    'device.offline', 'device.online', 'device.degraded',
    'agent.offline', 'agent.online', 'scan.complete'
  )),
  channel_ids UUID[] NOT NULL DEFAULT '{}',
  filters JSONB DEFAULT '{}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  cooldown_minutes INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast org and event lookups
CREATE INDEX IF NOT EXISTS idx_notification_rules_org
  ON notification_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_event
  ON notification_rules(organization_id, event_type) WHERE is_enabled = true;

-- Notification History (log of sent notifications)
CREATE TABLE IF NOT EXISTS notification_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES notification_rules(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES notification_channels(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for history lookups
CREATE INDEX IF NOT EXISTS idx_notification_history_org
  ON notification_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_created
  ON notification_history(organization_id, created_at DESC);

-- Cooldown tracking (prevent notification spam)
CREATE TABLE IF NOT EXISTS notification_cooldowns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES notification_rules(id) ON DELETE CASCADE,
  resource_type VARCHAR(20) NOT NULL, -- 'device' or 'agent'
  resource_id UUID NOT NULL,
  last_notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(rule_id, resource_type, resource_id)
);

-- Index for cooldown lookups
CREATE INDEX IF NOT EXISTS idx_notification_cooldowns_lookup
  ON notification_cooldowns(rule_id, resource_type, resource_id);

-- =============================================
-- Row Level Security Policies
-- =============================================

ALTER TABLE notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_cooldowns ENABLE ROW LEVEL SECURITY;

-- Policies for notification_channels
CREATE POLICY "Users can view their org channels" ON notification_channels
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage channels" ON notification_channels
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Policies for notification_rules
CREATE POLICY "Users can view their org rules" ON notification_rules
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage rules" ON notification_rules
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Policies for notification_history
CREATE POLICY "Users can view their org history" ON notification_history
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- Service role can insert history
CREATE POLICY "Service can insert history" ON notification_history
  FOR INSERT WITH CHECK (true);

-- Policies for notification_cooldowns (service only)
CREATE POLICY "Service can manage cooldowns" ON notification_cooldowns
  FOR ALL USING (true);

-- =============================================
-- Triggers for updated_at
-- =============================================

CREATE OR REPLACE FUNCTION update_notification_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_notification_channels_updated_at
  BEFORE UPDATE ON notification_channels
  FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER update_notification_rules_updated_at
  BEFORE UPDATE ON notification_rules
  FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();

-- =============================================
-- Helper function to check cooldown
-- =============================================

CREATE OR REPLACE FUNCTION check_notification_cooldown(
  p_rule_id UUID,
  p_resource_type VARCHAR(20),
  p_resource_id UUID,
  p_cooldown_minutes INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_last_notified TIMESTAMPTZ;
BEGIN
  SELECT last_notified_at INTO v_last_notified
  FROM notification_cooldowns
  WHERE rule_id = p_rule_id
    AND resource_type = p_resource_type
    AND resource_id = p_resource_id;

  IF v_last_notified IS NULL THEN
    RETURN true; -- No previous notification, allow
  END IF;

  IF v_last_notified + (p_cooldown_minutes || ' minutes')::INTERVAL < NOW() THEN
    RETURN true; -- Cooldown expired, allow
  END IF;

  RETURN false; -- Still in cooldown
END;
$$ LANGUAGE plpgsql;

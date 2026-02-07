-- Migration 006: Organization Branding, SSO, and Analytics
-- Tier 3 enterprise features

-- ==============================================
-- Feature 1: White-Label Branding (Unlimited Tier)
-- ==============================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS branding_display_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS branding_logo_url VARCHAR(2048),
  ADD COLUMN IF NOT EXISTS branding_primary_color VARCHAR(20);

-- ==============================================
-- Feature 2: SSO/SAML Configuration
-- ==============================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS sso_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sso_domain VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sso_provider VARCHAR(50);

-- ==============================================
-- Feature 3: Advanced Analytics - Device Status History
-- ==============================================

CREATE TABLE IF NOT EXISTS device_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  response_time_ms INTEGER,
  check_type VARCHAR(20) NOT NULL DEFAULT 'ping',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient time-series queries
CREATE INDEX IF NOT EXISTS idx_status_history_device_time
  ON device_status_history(device_id, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_status_history_org_time
  ON device_status_history(organization_id, checked_at DESC);

-- RLS policy: only access own organization's history
ALTER TABLE device_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "device_status_history_org_isolation"
  ON device_status_history
  FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
  ));

-- Service role bypass for agent API inserts
CREATE POLICY "device_status_history_service_role"
  ON device_status_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Pruning function for retention management
CREATE OR REPLACE FUNCTION prune_device_status_history(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM device_status_history
  WHERE checked_at < NOW() - (retention_days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration 008: Operational Hardening
-- Adds API usage tracking tables, composite indexes, and retention functions

-- ========================================
-- API Usage Tracking Tables
-- ========================================

-- Monthly usage per organization (for quota enforcement)
CREATE TABLE IF NOT EXISTS api_usage_monthly (
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year_month VARCHAR(7) NOT NULL, -- e.g. '2026-02'
  call_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(organization_id, year_month)
);

-- Hourly usage per agent per endpoint (for rate limiting)
CREATE TABLE IF NOT EXISTS api_usage_hourly (
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  hour_bucket TIMESTAMPTZ NOT NULL,
  endpoint VARCHAR(100) NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE(agent_id, hour_bucket, endpoint)
);

-- RLS: service_role only (no direct client access)
ALTER TABLE api_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_hourly ENABLE ROW LEVEL SECURITY;

-- ========================================
-- Atomic UPSERT Functions
-- ========================================

-- Increment monthly usage counter (atomic upsert)
CREATE OR REPLACE FUNCTION increment_monthly_usage(org_id UUID, ym VARCHAR)
RETURNS void AS $$
BEGIN
  INSERT INTO api_usage_monthly (organization_id, year_month, call_count)
  VALUES (org_id, ym, 1)
  ON CONFLICT (organization_id, year_month)
  DO UPDATE SET call_count = api_usage_monthly.call_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment hourly usage counter (atomic upsert)
CREATE OR REPLACE FUNCTION increment_hourly_usage(a_id UUID, org_id UUID, ep VARCHAR)
RETURNS void AS $$
BEGIN
  INSERT INTO api_usage_hourly (agent_id, organization_id, hour_bucket, endpoint, call_count)
  VALUES (a_id, org_id, date_trunc('hour', NOW()), ep, 1)
  ON CONFLICT (agent_id, hour_bucket, endpoint)
  DO UPDATE SET call_count = api_usage_hourly.call_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- Retention / Pruning Functions
-- ========================================

-- Prune old audit logs (default 365 days)
CREATE OR REPLACE FUNCTION prune_audit_logs(retention_days INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Prune old hourly usage records (older than 7 days)
CREATE OR REPLACE FUNCTION prune_api_usage()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM api_usage_hourly
  WHERE hour_bucket < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- Composite Indexes
-- ========================================

-- Devices composite indexes (improve dashboard queries)
CREATE INDEX IF NOT EXISTS idx_devices_org_status ON devices(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_devices_org_category ON devices(organization_id, category_id);
CREATE INDEX IF NOT EXISTS idx_devices_org_agent ON devices(organization_id, agent_id);

-- Audit logs composite indexes (improve log queries + pruning)
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_action ON audit_logs(organization_id, action);

-- Network segments composite index
CREATE INDEX IF NOT EXISTS idx_segments_agent_org ON network_segments(agent_id, organization_id);

-- Organization members composite index
CREATE INDEX IF NOT EXISTS idx_org_members_user_org ON organization_members(user_id, organization_id);

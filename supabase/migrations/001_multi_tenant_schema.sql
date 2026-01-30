-- ==============================================
-- VelocityPulse Multi-Tenant Database Schema
-- Migration: 001_multi_tenant_schema
-- ==============================================

-- Enable UUID extension (in extensions schema for Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ==============================================
-- Organizations (Tenants)
-- ==============================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  customer_number VARCHAR(20) UNIQUE NOT NULL, -- VEU-XXXXX format

  -- Stripe integration
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),

  -- Plan and status
  plan VARCHAR(50) NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial', 'starter', 'unlimited')),
  status VARCHAR(50) NOT NULL DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'suspended', 'cancelled')),

  -- Plan limits
  device_limit INTEGER NOT NULL DEFAULT 100,
  agent_limit INTEGER NOT NULL DEFAULT 10,
  user_limit INTEGER NOT NULL DEFAULT 5,

  -- Timestamps
  trial_ends_at TIMESTAMPTZ,
  suspended_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for common lookups
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_customer_number ON organizations(customer_number);
CREATE INDEX idx_organizations_stripe_customer ON organizations(stripe_customer_id);
CREATE INDEX idx_organizations_status ON organizations(status);

-- ==============================================
-- Organization Members (Users)
-- ==============================================
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id VARCHAR(255) NOT NULL, -- Clerk user ID
  role VARCHAR(50) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),

  -- Permissions JSON
  permissions JSONB NOT NULL DEFAULT '{
    "can_manage_billing": false,
    "can_manage_agents": false,
    "can_manage_devices": true,
    "can_manage_members": false,
    "can_view_audit_logs": false
  }'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, user_id)
);

-- Index for user lookups
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);

-- ==============================================
-- Categories (Multi-Tenant)
-- ==============================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'box',
  color VARCHAR(20) DEFAULT '#6B7280',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(organization_id, slug)
);

CREATE INDEX idx_categories_org ON categories(organization_id);

-- ==============================================
-- Agents (Multi-Tenant)
-- ==============================================
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- API Key (stored hashed)
  api_key_prefix VARCHAR(20) NOT NULL, -- vp_XXXXXXXX for fast lookup
  api_key_hash VARCHAR(64) NOT NULL,

  -- Key rotation support
  previous_api_key_hash VARCHAR(64),
  previous_api_key_expires_at TIMESTAMPTZ,

  -- Status
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  last_ip_address VARCHAR(45),
  version VARCHAR(20),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_agents_org ON agents(organization_id);
CREATE INDEX idx_agents_api_key_prefix ON agents(api_key_prefix);
CREATE INDEX idx_agents_enabled ON agents(is_enabled) WHERE is_enabled = true;

-- ==============================================
-- Network Segments (Multi-Tenant)
-- ==============================================
CREATE TABLE IF NOT EXISTS network_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cidr VARCHAR(50) NOT NULL, -- e.g., 192.168.1.0/24
  scan_interval_seconds INTEGER NOT NULL DEFAULT 300,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  last_scan_at TIMESTAMPTZ,
  last_scan_device_count INTEGER NOT NULL DEFAULT 0,

  -- Auto-registration fields
  is_auto_registered BOOLEAN DEFAULT false,
  interface_name VARCHAR(100),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_segments_org ON network_segments(organization_id);
CREATE INDEX idx_segments_agent ON network_segments(agent_id);

-- ==============================================
-- Devices (Multi-Tenant)
-- ==============================================
CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  network_segment_id UUID REFERENCES network_segments(id) ON DELETE SET NULL,

  -- Basic info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  ip_address VARCHAR(45),
  url VARCHAR(2048),
  port INTEGER,
  check_type VARCHAR(20) NOT NULL DEFAULT 'ping' CHECK (check_type IN ('ping', 'http', 'tcp')),
  icon VARCHAR(50),
  thumbnail_url VARCHAR(2048),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'unknown' CHECK (status IN ('online', 'offline', 'degraded', 'unknown')),
  last_check TIMESTAMPTZ,
  last_online TIMESTAMPTZ,
  response_time_ms INTEGER,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_monitored BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Discovery
  discovered_by VARCHAR(50) NOT NULL DEFAULT 'manual' CHECK (discovered_by IN ('manual', 'agent_scan', 'agent_arp', 'agent_mdns', 'agent_ssdp', 'agent_snmp')),
  mac_address VARCHAR(17),
  hostname VARCHAR(255),
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,

  -- Enhanced discovery
  manufacturer VARCHAR(255),
  os_hints JSONB DEFAULT '[]'::jsonb,
  device_type VARCHAR(50) DEFAULT 'unknown' CHECK (device_type IN ('server', 'workstation', 'network', 'printer', 'iot', 'unknown')),
  open_ports JSONB DEFAULT '[]'::jsonb,
  services JSONB DEFAULT '[]'::jsonb,
  netbios_name VARCHAR(255),
  snmp_info JSONB DEFAULT '{}'::jsonb,
  upnp_info JSONB DEFAULT '{}'::jsonb,
  last_full_scan_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_org ON devices(organization_id);
CREATE INDEX idx_devices_category ON devices(category_id);
CREATE INDEX idx_devices_agent ON devices(agent_id);
CREATE INDEX idx_devices_segment ON devices(network_segment_id);
CREATE INDEX idx_devices_ip ON devices(ip_address);
CREATE INDEX idx_devices_status ON devices(status);

-- ==============================================
-- Agent Commands
-- ==============================================
CREATE TABLE IF NOT EXISTS agent_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  command_type VARCHAR(50) NOT NULL CHECK (command_type IN ('scan_now', 'scan_segment', 'update_config', 'restart', 'upgrade', 'ping')),
  payload JSONB DEFAULT '{}'::jsonb,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  executed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_commands_agent ON agent_commands(agent_id);
CREATE INDEX idx_commands_status ON agent_commands(status) WHERE status = 'pending';

-- ==============================================
-- Subscriptions
-- ==============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  plan VARCHAR(50) NOT NULL CHECK (plan IN ('trial', 'starter', 'unlimited')),
  status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'past_due', 'cancelled', 'incomplete')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  amount_cents INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- ==============================================
-- Audit Logs
-- ==============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_type VARCHAR(50) NOT NULL CHECK (actor_type IN ('user', 'system', 'webhook')),
  actor_id VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100) NOT NULL,
  resource_id VARCHAR(255),
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);

-- ==============================================
-- Agent Pings (for dashboard alerts)
-- ==============================================
CREATE TABLE IF NOT EXISTS agent_pings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pings_agent ON agent_pings(agent_id);

-- ==============================================
-- View: Agents with online status (computed)
-- ==============================================
CREATE OR REPLACE VIEW agents_with_status AS
SELECT
  a.*,
  CASE
    WHEN a.last_seen_at IS NULL THEN false
    WHEN a.last_seen_at > NOW() - INTERVAL '5 minutes' THEN true
    ELSE false
  END AS is_online
FROM agents a;

-- ==============================================
-- Function: Update updated_at timestamp
-- ==============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER tr_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_org_members_updated_at BEFORE UPDATE ON organization_members FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_agents_updated_at BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_segments_updated_at BEFORE UPDATE ON network_segments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_devices_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

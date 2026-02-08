-- ==============================================
-- Migration 010: Admin Roles, Admin Audit Logs, User Enhancements
-- Phase 1: User Management improvements
-- ==============================================

-- ==============================================
-- Admin Roles (SaaS admin role hierarchy)
-- ==============================================
CREATE TABLE IF NOT EXISTS admin_roles (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(30) NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('super_admin', 'billing_admin', 'support_admin', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  invited_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_roles_role ON admin_roles(role);
CREATE INDEX idx_admin_roles_active ON admin_roles(is_active) WHERE is_active = true;

ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access on admin_roles" ON admin_roles
  USING (true) WITH CHECK (true);

CREATE TRIGGER tr_admin_roles_updated_at
  BEFORE UPDATE ON admin_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==============================================
-- Admin Audit Logs (cross-org admin actions)
-- ==============================================
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id VARCHAR(255) NOT NULL,
  actor_email VARCHAR(320),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(255),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_admin_audit_logs_actor ON admin_audit_logs(actor_id);
CREATE INDEX idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX idx_admin_audit_logs_org ON admin_audit_logs(organization_id);
CREATE INDEX idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on admin_audit_logs" ON admin_audit_logs
  USING (true) WITH CHECK (true);

-- ==============================================
-- User enhancements
-- ==============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_sign_in_at TIMESTAMPTZ;

-- ==============================================
-- Phase 4: Remote Monitoring & Segment Types
-- ==============================================

-- Segment type: local_scan (LAN discovery) vs remote_monitor (internet/remote checks)
ALTER TABLE network_segments ADD COLUMN IF NOT EXISTS segment_type VARCHAR(20) NOT NULL DEFAULT 'local_scan'
  CHECK (segment_type IN ('local_scan', 'remote_monitor'));

-- Device fields for remote monitoring
ALTER TABLE devices ADD COLUMN IF NOT EXISTS ssl_expiry_at TIMESTAMPTZ;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS ssl_expiry_warn_days INTEGER DEFAULT 30;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS ssl_issuer VARCHAR(255);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS ssl_subject VARCHAR(255);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS dns_expected_ip VARCHAR(45);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS check_interval_seconds INTEGER DEFAULT 60;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS monitoring_mode VARCHAR(20) NOT NULL DEFAULT 'auto'
  CHECK (monitoring_mode IN ('auto', 'manual'));

-- Update check_type constraint to include ssl and dns
-- Drop old constraint first if it exists, then add new one
DO $$
BEGIN
  -- Try to drop existing check constraint on check_type
  ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_check_type_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Index for remote monitoring queries
CREATE INDEX IF NOT EXISTS idx_devices_monitoring_mode ON devices(monitoring_mode) WHERE monitoring_mode = 'manual';
CREATE INDEX IF NOT EXISTS idx_segments_type ON network_segments(segment_type);

-- ==============================================
-- Phase 6: Support / Helpdesk System
-- ==============================================

-- Ticket number sequence
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START 1;

-- Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(20) NOT NULL UNIQUE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by VARCHAR(255) NOT NULL,
  assigned_to VARCHAR(255),
  subject VARCHAR(300) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(30) NOT NULL DEFAULT 'other'
    CHECK (category IN ('billing', 'subscription', 'technical', 'other')),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_support_tickets_org ON support_tickets(organization_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX idx_support_tickets_assigned ON support_tickets(assigned_to);
CREATE INDEX idx_support_tickets_created ON support_tickets(created_at DESC);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on support_tickets" ON support_tickets
  USING (true) WITH CHECK (true);

CREATE TRIGGER tr_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.ticket_number := 'VP-' || LPAD(NEXTVAL('ticket_number_seq')::TEXT, 5, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_support_ticket_number
  BEFORE INSERT ON support_tickets
  FOR EACH ROW
  WHEN (NEW.ticket_number IS NULL OR NEW.ticket_number = '')
  EXECUTE FUNCTION generate_ticket_number();

-- Ticket Comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_id VARCHAR(255) NOT NULL,
  author_type VARCHAR(10) NOT NULL DEFAULT 'user'
    CHECK (author_type IN ('user', 'admin')),
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_comments_created ON ticket_comments(created_at);

ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on ticket_comments" ON ticket_comments
  USING (true) WITH CHECK (true);

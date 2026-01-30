-- ==============================================
-- VelocityPulse Row Level Security Policies
-- Migration: 002_rls_policies
-- ==============================================

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_pings ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- Helper function: Get user's organization IDs
-- ==============================================
CREATE OR REPLACE FUNCTION get_user_organizations(user_id TEXT)
RETURNS SETOF UUID AS $$
  SELECT organization_id FROM organization_members WHERE organization_members.user_id = $1;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ==============================================
-- Helper function: Check if user is org member
-- ==============================================
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID, user_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id AND organization_members.user_id = $2
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ==============================================
-- Helper function: Get user's role in org
-- ==============================================
CREATE OR REPLACE FUNCTION get_user_role(org_id UUID, user_id TEXT)
RETURNS TEXT AS $$
  SELECT role FROM organization_members
  WHERE organization_id = org_id AND organization_members.user_id = $2;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ==============================================
-- Organizations Policies
-- ==============================================

-- Users can view organizations they're members of
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (id IN (SELECT get_user_organizations(auth.uid()::text)));

-- Only owners can update organization settings
CREATE POLICY "Owners can update organizations"
  ON organizations FOR UPDATE
  USING (get_user_role(id, auth.uid()::text) = 'owner');

-- ==============================================
-- Organization Members Policies
-- ==============================================

-- Users can view members of their organizations
CREATE POLICY "Users can view org members"
  ON organization_members FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations(auth.uid()::text)));

-- Admins and owners can manage members
CREATE POLICY "Admins can manage members"
  ON organization_members FOR ALL
  USING (get_user_role(organization_id, auth.uid()::text) IN ('owner', 'admin'));

-- ==============================================
-- Categories Policies
-- ==============================================

-- Users can view categories in their organizations
CREATE POLICY "Users can view categories"
  ON categories FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations(auth.uid()::text)));

-- Editors and above can manage categories
CREATE POLICY "Editors can manage categories"
  ON categories FOR ALL
  USING (get_user_role(organization_id, auth.uid()::text) IN ('owner', 'admin', 'editor'));

-- ==============================================
-- Agents Policies
-- ==============================================

-- Users can view agents in their organizations
CREATE POLICY "Users can view agents"
  ON agents FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations(auth.uid()::text)));

-- Admins can manage agents
CREATE POLICY "Admins can manage agents"
  ON agents FOR ALL
  USING (get_user_role(organization_id, auth.uid()::text) IN ('owner', 'admin'));

-- ==============================================
-- Network Segments Policies
-- ==============================================

-- Users can view segments in their organizations
CREATE POLICY "Users can view segments"
  ON network_segments FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations(auth.uid()::text)));

-- Admins can manage segments
CREATE POLICY "Admins can manage segments"
  ON network_segments FOR ALL
  USING (get_user_role(organization_id, auth.uid()::text) IN ('owner', 'admin'));

-- ==============================================
-- Devices Policies
-- ==============================================

-- Users can view devices in their organizations
CREATE POLICY "Users can view devices"
  ON devices FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations(auth.uid()::text)));

-- Editors and above can manage devices
CREATE POLICY "Editors can manage devices"
  ON devices FOR ALL
  USING (get_user_role(organization_id, auth.uid()::text) IN ('owner', 'admin', 'editor'));

-- ==============================================
-- Agent Commands Policies
-- ==============================================

-- Users can view commands for agents in their orgs
CREATE POLICY "Users can view agent commands"
  ON agent_commands FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM agents
      WHERE organization_id IN (SELECT get_user_organizations(auth.uid()::text))
    )
  );

-- Admins can create commands
CREATE POLICY "Admins can create commands"
  ON agent_commands FOR INSERT
  WITH CHECK (
    agent_id IN (
      SELECT id FROM agents
      WHERE organization_id IN (
        SELECT organization_id FROM organization_members
        WHERE user_id = auth.uid()::text AND role IN ('owner', 'admin')
      )
    )
  );

-- ==============================================
-- Subscriptions Policies
-- ==============================================

-- Users can view subscriptions for their organizations
CREATE POLICY "Users can view subscriptions"
  ON subscriptions FOR SELECT
  USING (organization_id IN (SELECT get_user_organizations(auth.uid()::text)));

-- ==============================================
-- Audit Logs Policies
-- ==============================================

-- Users with permission can view audit logs
CREATE POLICY "Users can view audit logs"
  ON audit_logs FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()::text
      AND (
        role IN ('owner', 'admin')
        OR (permissions->>'can_view_audit_logs')::boolean = true
      )
    )
  );

-- ==============================================
-- Agent Pings Policies
-- ==============================================

-- Users can view pings from agents in their orgs
CREATE POLICY "Users can view agent pings"
  ON agent_pings FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM agents
      WHERE organization_id IN (SELECT get_user_organizations(auth.uid()::text))
    )
  );

-- ==============================================
-- Service Role Bypass
-- Note: Service role key bypasses RLS by default
-- These policies allow agent API operations
-- ==============================================

-- Create a function to check for organization header
CREATE OR REPLACE FUNCTION get_request_org_id()
RETURNS UUID AS $$
BEGIN
  -- This would be set by the application layer for agent requests
  RETURN NULLIF(current_setting('request.organization_id', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

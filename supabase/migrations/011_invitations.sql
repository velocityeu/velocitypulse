-- =====================================================
-- Migration 011: Invitations Table
-- Supports both org member and admin invitations
-- =====================================================

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token VARCHAR(64) NOT NULL UNIQUE,
  email TEXT NOT NULL,
  invitation_type TEXT NOT NULL CHECK (invitation_type IN ('member', 'admin')),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  invited_by TEXT NOT NULL,
  accepted_by TEXT,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One pending invite per email+org for member type
CREATE UNIQUE INDEX idx_invitations_pending_member
  ON invitations (email, organization_id)
  WHERE status = 'pending' AND invitation_type = 'member';

-- One pending invite per email for admin type
CREATE UNIQUE INDEX idx_invitations_pending_admin
  ON invitations (email)
  WHERE status = 'pending' AND invitation_type = 'admin';

-- Lookup by token (for accept flow)
CREATE INDEX idx_invitations_token ON invitations (token);

-- Lookup by email (for webhook auto-accept)
CREATE INDEX idx_invitations_email_pending ON invitations (email) WHERE status = 'pending';

-- Lookup by org (for listing pending invitations)
CREATE INDEX idx_invitations_org_pending ON invitations (organization_id) WHERE status = 'pending';

-- Auto-update updated_at trigger (reuses existing function from migration 001)
CREATE TRIGGER set_invitations_updated_at
  BEFORE UPDATE ON invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Service role gets full access (all API routes use service client)
CREATE POLICY "Service role full access on invitations"
  ON invitations FOR ALL
  USING (true)
  WITH CHECK (true);

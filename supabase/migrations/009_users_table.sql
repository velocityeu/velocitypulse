-- 009: Users table — cache Clerk user profile data in Supabase
-- This makes user display data (name, email, avatar) available without Clerk API calls
-- and fixes the getOrgRecipients bug where organization_members.email doesn't exist.

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,          -- Clerk user_id
  email VARCHAR(320) NOT NULL,
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  image_url VARCHAR(2048),
  is_staff BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Service role full access (webhook inserts, API route reads)
CREATE POLICY "Service role full access" ON users
  USING (true) WITH CHECK (true);

CREATE TRIGGER tr_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

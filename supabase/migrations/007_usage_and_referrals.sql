-- Migration 007: Referral tracking
-- Adds referral_code and referred_by columns to organizations

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS referred_by TEXT;

-- Generate a default referral code for existing organizations
-- Format: first 4 chars of slug + random 4 chars
-- New orgs will get codes generated in the API
CREATE INDEX IF NOT EXISTS idx_organizations_referral_code ON organizations(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_referred_by ON organizations(referred_by) WHERE referred_by IS NOT NULL;

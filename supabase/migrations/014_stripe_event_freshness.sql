-- ==============================================
-- Stripe webhook event freshness tracking
-- ==============================================

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS stripe_last_event_created BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_last_event_id VARCHAR(255);

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS stripe_last_event_created BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_last_event_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_organizations_stripe_last_event_created
  ON organizations(stripe_last_event_created DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_last_event_created
  ON subscriptions(stripe_last_event_created DESC);

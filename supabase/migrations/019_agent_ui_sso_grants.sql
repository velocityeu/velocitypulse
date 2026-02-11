-- ==============================================
-- Agent UI SSO one-time grants
-- ==============================================

CREATE TABLE IF NOT EXISTS public.agent_ui_sso_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin')),
  state_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_ui_sso_grants_agent_id
  ON public.agent_ui_sso_grants(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_ui_sso_grants_org_id
  ON public.agent_ui_sso_grants(organization_id);

CREATE INDEX IF NOT EXISTS idx_agent_ui_sso_grants_expires_at
  ON public.agent_ui_sso_grants(expires_at);

CREATE INDEX IF NOT EXISTS idx_agent_ui_sso_grants_unused
  ON public.agent_ui_sso_grants(id)
  WHERE used_at IS NULL;

ALTER TABLE public.agent_ui_sso_grants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'agent_ui_sso_grants'
      AND policyname = 'Service role full access on agent_ui_sso_grants'
  ) THEN
    CREATE POLICY "Service role full access on agent_ui_sso_grants"
      ON public.agent_ui_sso_grants
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

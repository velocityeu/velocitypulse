-- ==============================================
-- Stripe webhook atomic org/subscription state apply
-- ==============================================

CREATE OR REPLACE FUNCTION public.apply_stripe_lifecycle_state(
  p_organization_id UUID,
  p_stripe_subscription_id TEXT,
  p_event_created BIGINT,
  p_event_id TEXT,
  p_org_patch JSONB DEFAULT '{}'::JSONB,
  p_sub_patch JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org organizations%ROWTYPE;
  v_sub subscriptions%ROWTYPE;
  v_sub_exists BOOLEAN := FALSE;
  v_has_subscription_patch BOOLEAN := p_sub_patch IS NOT NULL;
  v_subscription_id TEXT := NULLIF(BTRIM(COALESCE(p_stripe_subscription_id, '')), '');
  v_inserted BOOLEAN := FALSE;
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN jsonb_build_object('applied', FALSE, 'reason', 'missing_organization_id');
  END IF;

  IF p_event_created IS NULL OR p_event_id IS NULL OR BTRIM(p_event_id) = '' THEN
    RETURN jsonb_build_object('applied', FALSE, 'reason', 'missing_event_metadata');
  END IF;

  SELECT *
  INTO v_org
  FROM organizations
  WHERE id = p_organization_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', FALSE, 'reason', 'organization_not_found');
  END IF;

  IF COALESCE(v_org.stripe_last_event_created, 0) > p_event_created THEN
    RETURN jsonb_build_object('applied', FALSE, 'reason', 'stale_organization');
  END IF;

  IF v_has_subscription_patch AND v_subscription_id IS NULL THEN
    RETURN jsonb_build_object('applied', FALSE, 'reason', 'missing_subscription_id');
  END IF;

  IF v_has_subscription_patch THEN
    SELECT *
    INTO v_sub
    FROM subscriptions
    WHERE stripe_subscription_id = v_subscription_id
    FOR UPDATE;

    v_sub_exists := FOUND;

    IF v_sub_exists AND COALESCE(v_sub.stripe_last_event_created, 0) > p_event_created THEN
      RETURN jsonb_build_object('applied', FALSE, 'reason', 'stale_subscription');
    END IF;
  END IF;

  UPDATE organizations
  SET
    stripe_last_event_created = p_event_created,
    stripe_last_event_id = p_event_id,
    status = CASE WHEN p_org_patch ? 'status' THEN (p_org_patch->>'status')::VARCHAR ELSE status END,
    plan = CASE WHEN p_org_patch ? 'plan' THEN (p_org_patch->>'plan')::VARCHAR ELSE plan END,
    stripe_subscription_id = CASE
      WHEN p_org_patch ? 'stripe_subscription_id' THEN NULLIF(p_org_patch->>'stripe_subscription_id', '')
      ELSE stripe_subscription_id
    END,
    device_limit = CASE WHEN p_org_patch ? 'device_limit' THEN (p_org_patch->>'device_limit')::INTEGER ELSE device_limit END,
    agent_limit = CASE WHEN p_org_patch ? 'agent_limit' THEN (p_org_patch->>'agent_limit')::INTEGER ELSE agent_limit END,
    user_limit = CASE WHEN p_org_patch ? 'user_limit' THEN (p_org_patch->>'user_limit')::INTEGER ELSE user_limit END,
    trial_ends_at = CASE WHEN p_org_patch ? 'trial_ends_at' THEN (p_org_patch->>'trial_ends_at')::TIMESTAMPTZ ELSE trial_ends_at END,
    cancelled_at = CASE WHEN p_org_patch ? 'cancelled_at' THEN (p_org_patch->>'cancelled_at')::TIMESTAMPTZ ELSE cancelled_at END,
    suspended_at = CASE WHEN p_org_patch ? 'suspended_at' THEN (p_org_patch->>'suspended_at')::TIMESTAMPTZ ELSE suspended_at END,
    updated_at = NOW()
  WHERE id = p_organization_id;

  IF v_has_subscription_patch THEN
    IF v_sub_exists THEN
      UPDATE subscriptions
      SET
        organization_id = CASE WHEN p_sub_patch ? 'organization_id' THEN (p_sub_patch->>'organization_id')::UUID ELSE organization_id END,
        plan = CASE WHEN p_sub_patch ? 'plan' THEN (p_sub_patch->>'plan')::VARCHAR ELSE plan END,
        status = CASE WHEN p_sub_patch ? 'status' THEN (p_sub_patch->>'status')::VARCHAR ELSE status END,
        current_period_start = CASE
          WHEN p_sub_patch ? 'current_period_start' THEN (p_sub_patch->>'current_period_start')::TIMESTAMPTZ
          ELSE current_period_start
        END,
        current_period_end = CASE
          WHEN p_sub_patch ? 'current_period_end' THEN (p_sub_patch->>'current_period_end')::TIMESTAMPTZ
          ELSE current_period_end
        END,
        amount_cents = CASE WHEN p_sub_patch ? 'amount_cents' THEN (p_sub_patch->>'amount_cents')::INTEGER ELSE amount_cents END,
        stripe_last_event_created = p_event_created,
        stripe_last_event_id = p_event_id,
        updated_at = NOW()
      WHERE stripe_subscription_id = v_subscription_id;
    ELSE
      INSERT INTO subscriptions (
        organization_id,
        stripe_subscription_id,
        plan,
        status,
        current_period_start,
        current_period_end,
        amount_cents,
        stripe_last_event_created,
        stripe_last_event_id
      )
      VALUES (
        COALESCE((p_sub_patch->>'organization_id')::UUID, p_organization_id),
        v_subscription_id,
        COALESCE((p_sub_patch->>'plan')::VARCHAR, 'trial'),
        COALESCE((p_sub_patch->>'status')::VARCHAR, 'incomplete'),
        COALESCE((p_sub_patch->>'current_period_start')::TIMESTAMPTZ, NOW()),
        COALESCE((p_sub_patch->>'current_period_end')::TIMESTAMPTZ, NOW()),
        COALESCE((p_sub_patch->>'amount_cents')::INTEGER, 0),
        p_event_created,
        p_event_id
      )
      ON CONFLICT (stripe_subscription_id)
      DO UPDATE
      SET
        organization_id = EXCLUDED.organization_id,
        plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        amount_cents = EXCLUDED.amount_cents,
        stripe_last_event_created = EXCLUDED.stripe_last_event_created,
        stripe_last_event_id = EXCLUDED.stripe_last_event_id,
        updated_at = NOW()
      WHERE subscriptions.stripe_last_event_created <= EXCLUDED.stripe_last_event_created;

      v_inserted := TRUE;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'applied', TRUE,
    'subscription_applied', v_has_subscription_patch,
    'subscription_inserted', v_inserted
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'applied', FALSE,
      'reason', 'exception',
      'error', SQLERRM
    );
END;
$$;


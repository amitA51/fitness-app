-- ============================================================================
-- billing_core behaviour test
-- ============================================================================
-- Exercises the money path added in 20260726100000_billing_core.sql:
--   * billing_apply_subscription() creates and updates a subscription
--   * the entitlement read model is projected from it by trigger
--   * an out-of-order (stale) provider event is REJECTED, not applied
--   * a cancellation drops the plan back to free
--   * has_paid_entitlement() / has_feature_access() answer for the caller
--   * current_entitlement() expires a lapsed period past the grace window
--   * the free-plan template quota is enforced in the database
--
-- Prerequisites (a plain Postgres is enough):
--   psql -f supabase/tests/fixtures/supabase_min_stub.sql
--   psql -f supabase/migrations/20260726100000_billing_core.sql
--   psql -f supabase/tests/billing_core_test.sql
--
-- Expected final line: "billing_core: ALL ASSERTIONS PASSED".
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_user     uuid;
  v_other    uuid;
  v_applied  boolean;
  v_reason   text;
  v_plan     text;
  v_status   text;
  v_name     text;
  v_count    integer;
  v_paid     boolean;
  v_err      text;
BEGIN
  INSERT INTO auth.users (email) VALUES ('payer@example.com') RETURNING id INTO v_user;
  INSERT INTO auth.users (email) VALUES ('free@example.com') RETURNING id INTO v_other;

  -- A price the operator would have inserted after approving the commercials.
  INSERT INTO public.billing_prices (
    price_key, scope, grants_plan, provider, provider_price_id,
    currency, unit_amount, tax_inclusive, billing_interval, trial_days, is_active
  ) VALUES (
    'pro_monthly', 'consumer', 'pro_monthly', 'paddle', 'pri_test_1',
    'ILS', 3900, true, 'month', 7, true
  );

  -- ── First webhook: subscription becomes active ───────────────────────────
  SELECT applied, reason INTO v_applied, v_reason
  FROM public.billing_apply_subscription(
    v_user, 'consumer', 'paddle', 'sub_1', 'pro_monthly', 'active', 1,
    now() - interval '1 day', now() + interval '29 days', false,
    '2026-07-01 10:00:00+00', '{"event":"created"}'::jsonb
  );
  ASSERT v_applied, format('first apply was rejected: %s', v_reason);

  SELECT plan, status INTO v_plan, v_status FROM public.entitlements WHERE user_id = v_user;
  ASSERT v_plan = 'pro_monthly', format('entitlement plan not projected: %L', v_plan);
  ASSERT v_status = 'active', format('entitlement status not projected: %L', v_status);

  -- ── A STALE provider event must not be applied ───────────────────────────
  -- This is the out-of-order delivery that would otherwise downgrade a payer who
  -- has already renewed.
  SELECT applied, reason INTO v_applied, v_reason
  FROM public.billing_apply_subscription(
    v_user, 'consumer', 'paddle', 'sub_1', 'pro_monthly', 'canceled', 1,
    now() - interval '40 days', now() - interval '10 days', true,
    '2026-06-01 10:00:00+00', '{"event":"stale-cancel"}'::jsonb
  );
  ASSERT NOT v_applied, 'a stale event was applied';
  ASSERT v_reason = 'stale_event', format('unexpected reason: %L', v_reason);

  SELECT plan, status INTO v_plan, v_status FROM public.entitlements WHERE user_id = v_user;
  ASSERT v_plan = 'pro_monthly', 'stale event downgraded the plan';
  ASSERT v_status = 'active', 'stale event changed the status';

  -- ── Only one subscription row exists (idempotent upsert on provider id) ──
  SELECT count(*) INTO v_count FROM public.billing_subscriptions
  WHERE provider = 'paddle' AND provider_subscription_id = 'sub_1';
  ASSERT v_count = 1, format('expected 1 subscription row, found %s', v_count);

  -- ── has_paid_entitlement / has_feature_access answer for the CALLER ──────
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  SELECT public.has_paid_entitlement() INTO v_paid;
  ASSERT v_paid, 'paying user was not recognised as entitled';
  ASSERT public.has_feature_access('ai_coach'), 'paid feature denied to a payer';
  ASSERT public.has_feature_access('something_free'), 'unknown feature key was gated';

  PERFORM set_config('request.jwt.claim.sub', v_other::text, true);
  SELECT public.has_paid_entitlement() INTO v_paid;
  ASSERT NOT v_paid, 'a free user was treated as entitled';
  ASSERT NOT public.has_feature_access('ai_coach'), 'paid feature granted to a free user';

  -- ── current_entitlement() expires a lapsed period past the grace window ──
  UPDATE public.entitlements
     SET current_period_end = now() - interval '48 hours'
   WHERE user_id = v_user;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  SELECT plan, status INTO v_plan, v_status FROM public.current_entitlement();
  ASSERT v_plan = 'free', format('lapsed subscription still reads as %L', v_plan);
  ASSERT v_status = 'expired', format('lapsed status reads as %L', v_status);

  -- Inside the 24h grace window a payer keeps access (webhook lag tolerance).
  UPDATE public.entitlements
     SET current_period_end = now() - interval '2 hours'
   WHERE user_id = v_user;
  SELECT plan INTO v_plan FROM public.current_entitlement();
  ASSERT v_plan = 'pro_monthly', 'grace window revoked access too early';

  -- ── A real cancellation DOES drop the plan ───────────────────────────────
  SELECT applied INTO v_applied
  FROM public.billing_apply_subscription(
    v_user, 'consumer', 'paddle', 'sub_1', 'pro_monthly', 'canceled', 1,
    now() - interval '30 days', now(), true,
    '2026-08-01 10:00:00+00', '{"event":"cancel"}'::jsonb
  );
  ASSERT v_applied, 'a newer cancellation was rejected';

  SELECT plan, status INTO v_plan, v_status FROM public.entitlements WHERE user_id = v_user;
  ASSERT v_plan = 'free', format('cancelled subscription still grants %L', v_plan);
  ASSERT v_status = 'canceled', format('cancelled status is %L', v_status);

  -- ── Free-plan template quota, enforced by trigger ────────────────────────
  INSERT INTO public.workout_templates (user_id, name) VALUES (v_other, 'a');
  INSERT INTO public.workout_templates (user_id, name) VALUES (v_other, 'b');
  INSERT INTO public.workout_templates (user_id, name) VALUES (v_other, 'c');

  BEGIN
    INSERT INTO public.workout_templates (user_id, name) VALUES (v_other, 'd');
    RAISE EXCEPTION 'the fourth free template was accepted';
  EXCEPTION
    WHEN others THEN
      v_err := SQLERRM;
      ASSERT v_err LIKE '%free_template_limit_reached%',
        format('unexpected quota error: %L', v_err);
  END;

  -- A tombstoned template must not count against the quota.
  UPDATE public.workout_templates SET deleted_at = now()
   WHERE user_id = v_other AND name = 'a';
  INSERT INTO public.workout_templates (user_id, name) VALUES (v_other, 'd');
  SELECT count(*) INTO v_count FROM public.workout_templates
  WHERE user_id = v_other AND deleted_at IS NULL;
  ASSERT v_count = 3, format('expected 3 live templates, found %s', v_count);

  -- A paying user is unlimited.
  INSERT INTO public.entitlements (user_id, plan, status, current_period_end)
  VALUES (v_user, 'pro_yearly', 'active', now() + interval '300 days')
  ON CONFLICT (user_id) DO UPDATE
    SET plan = 'pro_yearly', status = 'active',
        current_period_end = now() + interval '300 days';

  FOR v_count IN 1..6 LOOP
    INSERT INTO public.workout_templates (user_id, name) VALUES (v_user, 'p' || v_count);
  END LOOP;
  SELECT count(*) INTO v_count FROM public.workout_templates WHERE user_id = v_user;
  ASSERT v_count = 6, format('premium user was capped at %s templates', v_count);

  -- ── Coach-scope subscriptions must NOT upgrade the personal plan ─────────
  INSERT INTO public.billing_prices (
    price_key, scope, grants_plan, provider, provider_price_id,
    currency, unit_amount, tax_inclusive, billing_interval, seat_limit, is_active
  ) VALUES (
    'coach_starter', 'coach', 'free', 'paddle', 'pri_coach_1',
    'ILS', 19900, true, 'month', 10, true
  );

  SELECT plan INTO v_plan FROM public.entitlements WHERE user_id = v_other;
  ASSERT v_plan IS NULL OR v_plan = 'free', 'free user unexpectedly has a plan';

  PERFORM public.billing_apply_subscription(
    v_other, 'coach', 'paddle', 'sub_coach_1', 'coach_starter', 'active', 3,
    now(), now() + interval '30 days', false, now(), '{}'::jsonb
  );

  SELECT plan INTO v_plan FROM public.entitlements WHERE user_id = v_other;
  ASSERT v_plan IS NULL OR v_plan = 'free',
    format('a coach seat subscription upgraded the personal plan to %L', v_plan);

  -- Seats are multiplied by quantity.
  SELECT seat_limit INTO v_count FROM public.billing_subscriptions
  WHERE provider_subscription_id = 'sub_coach_1';
  ASSERT v_count = 30, format('expected 30 seats (10 x 3), got %s', v_count);

  -- Silence the unused-variable warning for v_name.
  v_name := 'ok';
  ASSERT v_name = 'ok';

  RAISE NOTICE 'billing_core: ALL ASSERTIONS PASSED';
END;
$$;

ROLLBACK;

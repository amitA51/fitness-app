-- ============================================================================
-- RLS test for the tables added on 2026-07-26
-- ============================================================================
-- RLS mistakes are silent: a missing policy or a forgotten REVOKE looks fine in
-- the app and only shows up when someone reads another customer's data. This
-- exercises the policies AS THE `authenticated` ROLE with a real auth.uid(),
-- which is the only way to see what a browser session can actually do.
--
-- Prerequisites:
--   psql -f supabase/tests/fixtures/supabase_min_stub.sql
--   psql -f supabase/migrations/20260726090000_account_deletion_audit.sql
--   psql -f supabase/migrations/20260726100000_billing_core.sql
--   psql -f supabase/migrations/20260726110000_product_events.sql
--   psql -f supabase/tests/rls_2026_07_26_test.sql
--
-- Expected final line: "rls_2026_07_26: ALL ASSERTIONS PASSED".
-- ============================================================================

BEGIN;

-- Seeded with superuser rights, before dropping into the authenticated role.
CREATE TEMP TABLE _ids (label text PRIMARY KEY, id uuid);

DO $$
DECLARE
  v_a uuid;
  v_b uuid;
BEGIN
  INSERT INTO auth.users (email) VALUES ('a@example.com') RETURNING id INTO v_a;
  INSERT INTO auth.users (email) VALUES ('b@example.com') RETURNING id INTO v_b;
  INSERT INTO _ids VALUES ('a', v_a), ('b', v_b);

  INSERT INTO public.billing_prices (
    price_key, scope, grants_plan, provider, provider_price_id,
    currency, unit_amount, tax_inclusive, billing_interval, is_active
  ) VALUES
    ('visible_price', 'consumer', 'pro_monthly', 'paddle', 'pri_v', 'ILS', 3900, true, 'month', true),
    ('hidden_price',  'consumer', 'pro_yearly',  'paddle', 'pri_h', 'ILS', 39000, true, 'year', false);

  INSERT INTO public.entitlements (user_id, plan, status) VALUES (v_a, 'pro_monthly', 'active');
  INSERT INTO public.entitlements (user_id, plan, status) VALUES (v_b, 'free', 'active');

  PERFORM public.billing_apply_subscription(
    v_b, 'consumer', 'paddle', 'sub_b', 'visible_price', 'active', 1,
    now(), now() + interval '30 days', false, now(), '{}'::jsonb
  );

  INSERT INTO public.account_deletion_audit (deleted_user_id, outcome)
  VALUES (v_b, 'completed');
END;
$$;

DO $$
DECLARE
  v_a      uuid := (SELECT id FROM _ids WHERE label = 'a');
  v_b      uuid := (SELECT id FROM _ids WHERE label = 'b');
  v_count  integer;
  v_err    text;
BEGIN
  -- Become a signed-in browser session for user A.
  PERFORM set_config('request.jwt.claim.sub', v_a::text, true);
  SET LOCAL ROLE authenticated;

  -- ── billing_prices: active rows readable, inactive ones hidden ───────────
  SELECT count(*) INTO v_count FROM public.billing_prices;
  ASSERT v_count = 1, format('expected 1 visible price, saw %s', v_count);

  -- ── entitlements: own row only ───────────────────────────────────────────
  SELECT count(*) INTO v_count FROM public.entitlements;
  ASSERT v_count = 1, format('entitlements leaked %s rows to one user', v_count);

  -- ── billing_subscriptions: user B's subscription must be invisible ───────
  SELECT count(*) INTO v_count FROM public.billing_subscriptions;
  ASSERT v_count = 0, format('billing_subscriptions leaked %s rows', v_count);

  -- ── account_deletion_audit: no client access at all ─────────────────────
  BEGIN
    SELECT count(*) INTO v_count FROM public.account_deletion_audit;
    ASSERT v_count = 0, format('account_deletion_audit leaked %s rows', v_count);
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL; -- Privilege revoked outright: also acceptable, and stricter.
  END;

  -- ── product_events: may insert OWN allow-listed events ──────────────────
  INSERT INTO public.product_events (user_id, name, props)
  VALUES (v_a, 'paywall_viewed', '{"source":"test"}'::jsonb);

  -- ...but not for somebody else.
  BEGIN
    INSERT INTO public.product_events (user_id, name) VALUES (v_b, 'paywall_viewed');
    RAISE EXCEPTION 'inserted a product event attributed to another user';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN NULL;
  END;

  -- ...and not with an arbitrary event name.
  BEGIN
    INSERT INTO public.product_events (user_id, name) VALUES (v_a, 'arbitrary_junk_event');
    RAISE EXCEPTION 'inserted a product event with a non-allow-listed name';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN NULL;
  END;

  -- ...and cannot read the table back (append-only from the client's view).
  BEGIN
    SELECT count(*) INTO v_count FROM public.product_events;
    RAISE EXCEPTION 'client could read product_events';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  -- ── Money state is not client-writable ──────────────────────────────────
  BEGIN
    UPDATE public.entitlements SET plan = 'pro_yearly' WHERE user_id = v_a;
    -- RLS with no UPDATE policy silently matches zero rows rather than erroring.
    RESET ROLE;
    SELECT count(*) INTO v_count FROM public.entitlements
    WHERE user_id = v_a AND plan = 'pro_yearly';
    ASSERT v_count = 0, 'a client upgraded its own entitlement';
    SET LOCAL ROLE authenticated;
  EXCEPTION
    WHEN insufficient_privilege THEN
      SET LOCAL ROLE authenticated;
  END;

  BEGIN
    INSERT INTO public.billing_subscriptions (
      subject_user_id, scope, provider, provider_subscription_id, price_key,
      status, latest_event_at
    ) VALUES (v_a, 'consumer', 'paddle', 'forged', 'visible_price', 'active', now());
    RAISE EXCEPTION 'a client inserted its own subscription';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN NULL;
  END;

  -- ── The privileged RPC is not callable by a client ──────────────────────
  BEGIN
    PERFORM public.billing_apply_subscription(
      v_a, 'consumer', 'paddle', 'forged2', 'visible_price', 'active', 1,
      now(), now() + interval '30 days', false, now(), '{}'::jsonb
    );
    RAISE EXCEPTION 'a client called billing_apply_subscription';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;
  END;

  RESET ROLE;
  RAISE NOTICE 'rls_2026_07_26: ALL ASSERTIONS PASSED';
END;
$$;

ROLLBACK;

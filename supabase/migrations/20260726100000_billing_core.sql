-- ============================================================================
-- BILLING CORE — the commercial source of truth
-- ============================================================================
-- Before this migration the app had `entitlements` (a one-row-per-user read
-- model) and `billing_events` (idempotency log), but nothing that could actually
-- SELL anything: no price catalogue, no customer/subscription records, no
-- webhook receiver, and no server-side enforcement. Premium gating lived only in
-- React (`PlanGate`), so every paid feature was reachable by calling the API
-- directly.
--
-- Design decisions, deliberately provider-agnostic:
--   • `billing_prices` is the catalogue and is SERVER-OWNED. It ships EMPTY:
--     real prices, currency and VAT treatment are business decisions and must be
--     inserted by the operator (see the template INSERT at the bottom, commented
--     out on purpose). The client never sends an amount.
--   • `billing_customers` / `billing_subscriptions` hold the provider's identity
--     and lifecycle so support, reconciliation, refunds and a customer portal
--     are possible without re-reading raw webhook payloads.
--   • `entitlements` stays as the fast read model that `current_entitlement()`
--     already serves, and is now PROJECTED from `billing_subscriptions` by a
--     trigger, so there is exactly one write path.
--   • `has_feature_access()` is the server-side gate. Edge functions and RPCs
--     must call it; `PlanGate` in React is presentation only.
--
-- Every table here is service-role-write. Clients may read only their own rows.
-- ============================================================================

-- ── 1. Price catalogue (server-owned) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_prices (
  -- Stable internal key referenced by checkout requests, e.g. 'pro_monthly'.
  price_key       text PRIMARY KEY,
  scope           text NOT NULL CHECK (scope IN ('consumer', 'coach')),
  -- Which entitlement plan a purchase of this price grants.
  grants_plan     text NOT NULL CHECK (grants_plan IN ('free', 'pro_monthly', 'pro_yearly')),
  provider        text NOT NULL,
  -- The provider's own price/plan identifier. Never sent by the browser.
  provider_price_id text NOT NULL,
  currency        text NOT NULL CHECK (char_length(currency) = 3),
  -- Minor units (agorot / cents) to avoid float rounding on money.
  unit_amount     integer NOT NULL CHECK (unit_amount >= 0),
  -- Whether unit_amount already includes VAT. Drives the checkout disclosure.
  tax_inclusive   boolean NOT NULL DEFAULT true,
  billing_interval text NOT NULL CHECK (billing_interval IN ('month', 'year')),
  trial_days      integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  -- Coach plans sell seats; consumer plans leave this NULL.
  seat_limit      integer CHECK (seat_limit IS NULL OR seat_limit > 0),
  is_active       boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_price_id)
);

ALTER TABLE public.billing_prices ENABLE ROW LEVEL SECURITY;

-- The paywall needs to render real prices, so active rows are world-readable to
-- signed-in users. Nothing here is secret; writes remain service-role only.
DROP POLICY IF EXISTS billing_prices_read_active ON public.billing_prices;
CREATE POLICY billing_prices_read_active ON public.billing_prices
  FOR SELECT TO authenticated USING (is_active);

REVOKE INSERT, UPDATE, DELETE ON public.billing_prices FROM anon, authenticated;

-- ── 2. Provider customer identity ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_customers (
  user_id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  provider             text NOT NULL,
  provider_customer_id text NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_customer_id)
);

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_customers_owner_read ON public.billing_customers;
CREATE POLICY billing_customers_owner_read ON public.billing_customers
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ── 3. Subscription lifecycle ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope                    text NOT NULL CHECK (scope IN ('consumer', 'coach')),
  provider                 text NOT NULL,
  provider_subscription_id text NOT NULL,
  price_key                text REFERENCES public.billing_prices(price_key),
  status                   text NOT NULL
                             CHECK (status IN ('trialing', 'active', 'past_due',
                                               'canceled', 'expired', 'incomplete')),
  quantity                 integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  seat_limit               integer CHECK (seat_limit IS NULL OR seat_limit > 0),
  current_period_start     timestamptz,
  current_period_end       timestamptz,
  cancel_at_period_end     boolean NOT NULL DEFAULT false,
  -- Provider event ordering guard: an out-of-order webhook must not overwrite a
  -- newer state (see billing_apply_subscription).
  latest_event_at          timestamptz NOT NULL DEFAULT now(),
  provider_snapshot        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_subscription_id)
);

CREATE INDEX IF NOT EXISTS billing_subscriptions_subject_idx
  ON public.billing_subscriptions (subject_user_id, scope, status);

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_subscriptions_owner_read ON public.billing_subscriptions;
CREATE POLICY billing_subscriptions_owner_read ON public.billing_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = subject_user_id);
-- No client write policy: only the webhook (service role) may change money state.

-- ── 4. Checkout sessions (audit + reconciliation) ───────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_checkout_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  price_key             text NOT NULL REFERENCES public.billing_prices(price_key),
  provider              text NOT NULL,
  provider_session_id   text,
  status                text NOT NULL DEFAULT 'created'
                          CHECK (status IN ('created', 'completed', 'abandoned', 'failed')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz
);

CREATE INDEX IF NOT EXISTS billing_checkout_sessions_user_idx
  ON public.billing_checkout_sessions (user_id, created_at DESC);

ALTER TABLE public.billing_checkout_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_checkout_owner_read ON public.billing_checkout_sessions;
CREATE POLICY billing_checkout_owner_read ON public.billing_checkout_sessions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ── 5. Project subscriptions onto the entitlement read model ────────────────
--
-- One write path. The webhook calls billing_apply_subscription(); the trigger
-- keeps `entitlements` in sync so `current_entitlement()` and every RLS check
-- read a single derived truth.

CREATE OR REPLACE FUNCTION public.billing_sync_entitlement()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_plan   text := 'free';
  v_status text := 'active';
  v_end    timestamptz;
  v_source text;
BEGIN
  -- Consumer subscriptions drive the personal entitlement. Coach seat
  -- subscriptions are handled by coach_subscriptions and must not upgrade the
  -- personal plan.
  IF NEW.scope <> 'consumer' THEN
    RETURN NEW;
  END IF;

  SELECT p.grants_plan, NEW.status, NEW.current_period_end, NEW.provider
    INTO v_plan, v_status, v_end, v_source
  FROM public.billing_prices p
  WHERE p.price_key = NEW.price_key;

  -- Unknown price (should be impossible via FK) or a terminal status → free.
  IF v_plan IS NULL OR NEW.status IN ('canceled', 'expired', 'incomplete') THEN
    v_plan := 'free';
  END IF;

  -- The entitlements table's own CHECK constraints only accept this subset.
  IF v_status NOT IN ('active', 'trialing', 'past_due', 'canceled', 'expired') THEN
    v_status := 'expired';
  END IF;

  INSERT INTO public.entitlements (user_id, plan, status, source, current_period_end, updated_at)
  VALUES (NEW.subject_user_id, v_plan, v_status,
          CASE WHEN v_source IN ('web_stripe', 'web_paddle', 'apple', 'google')
               THEN v_source ELSE NULL END,
          v_end, now())
  ON CONFLICT (user_id) DO UPDATE
    SET plan = EXCLUDED.plan,
        status = EXCLUDED.status,
        source = EXCLUDED.source,
        current_period_end = EXCLUDED.current_period_end,
        updated_at = now();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_billing_sync_entitlement ON public.billing_subscriptions;
CREATE TRIGGER trg_billing_sync_entitlement
  AFTER INSERT OR UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.billing_sync_entitlement();

-- ── 6. Idempotent webhook application ───────────────────────────────────────
--
-- Called by the billing-webhook edge function with the service role. Rejects
-- stale events so a retried/out-of-order delivery cannot downgrade a payer.

CREATE OR REPLACE FUNCTION public.billing_apply_subscription(
  p_user_id                  uuid,
  p_scope                    text,
  p_provider                 text,
  p_provider_subscription_id text,
  p_price_key                text,
  p_status                   text,
  p_quantity                 integer,
  p_current_period_start     timestamptz,
  p_current_period_end       timestamptz,
  p_cancel_at_period_end     boolean,
  p_event_at                 timestamptz,
  p_snapshot                 jsonb
)
RETURNS TABLE (applied boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_existing_event_at timestamptz;
  v_seat_limit        integer;
BEGIN
  SELECT latest_event_at INTO v_existing_event_at
  FROM public.billing_subscriptions
  WHERE provider = p_provider AND provider_subscription_id = p_provider_subscription_id
  FOR UPDATE;

  IF v_existing_event_at IS NOT NULL AND p_event_at < v_existing_event_at THEN
    RETURN QUERY SELECT false, 'stale_event';
    RETURN;
  END IF;

  SELECT seat_limit INTO v_seat_limit FROM public.billing_prices WHERE price_key = p_price_key;

  INSERT INTO public.billing_subscriptions AS s (
    subject_user_id, scope, provider, provider_subscription_id, price_key, status,
    quantity, seat_limit, current_period_start, current_period_end,
    cancel_at_period_end, latest_event_at, provider_snapshot, updated_at
  ) VALUES (
    p_user_id, p_scope, p_provider, p_provider_subscription_id, p_price_key, p_status,
    GREATEST(COALESCE(p_quantity, 1), 1),
    CASE WHEN v_seat_limit IS NULL THEN NULL
         ELSE v_seat_limit * GREATEST(COALESCE(p_quantity, 1), 1) END,
    p_current_period_start, p_current_period_end,
    COALESCE(p_cancel_at_period_end, false), p_event_at,
    COALESCE(p_snapshot, '{}'::jsonb), now()
  )
  ON CONFLICT (provider, provider_subscription_id) DO UPDATE
    SET subject_user_id = EXCLUDED.subject_user_id,
        scope = EXCLUDED.scope,
        price_key = EXCLUDED.price_key,
        status = EXCLUDED.status,
        quantity = EXCLUDED.quantity,
        seat_limit = EXCLUDED.seat_limit,
        current_period_start = EXCLUDED.current_period_start,
        current_period_end = EXCLUDED.current_period_end,
        cancel_at_period_end = EXCLUDED.cancel_at_period_end,
        latest_event_at = EXCLUDED.latest_event_at,
        provider_snapshot = EXCLUDED.provider_snapshot,
        updated_at = now();

  RETURN QUERY SELECT true, 'applied';
END;
$$;

REVOKE ALL ON FUNCTION public.billing_apply_subscription(
  uuid, text, text, text, text, text, integer, timestamptz, timestamptz, boolean,
  timestamptz, jsonb
) FROM PUBLIC, anon, authenticated;

-- ── 7. Server-side feature gate ─────────────────────────────────────────────
--
-- The authoritative answer to "may this user use this paid feature?". Note the
-- period-end check: a webhook that never arrives must not leave a lapsed
-- subscription looking active forever.

CREATE OR REPLACE FUNCTION public.has_paid_entitlement(p_grace_hours integer DEFAULT 24)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.entitlements e
    WHERE e.user_id = auth.uid()
      AND e.plan <> 'free'
      AND e.status IN ('active', 'trialing')
      AND (
        e.current_period_end IS NULL
        OR e.current_period_end > now() - make_interval(hours => GREATEST(p_grace_hours, 0))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_paid_entitlement(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_paid_entitlement(integer) TO authenticated;

-- Feature-level gate. Keep the key list in sync with PREMIUM_FEATURES in
-- src/services/billing/types.ts. An unknown key is treated as FREE so adding a
-- feature to the client cannot accidentally lock existing users out.
CREATE OR REPLACE FUNCTION public.has_feature_access(p_feature text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN p_feature IN ('advanced_progress', 'ai_coach', 'unlimited_templates',
                       'progress_photos', 'cloud_sync', 'data_export')
      THEN public.has_paid_entitlement()
    ELSE true
  END;
$$;

REVOKE ALL ON FUNCTION public.has_feature_access(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_feature_access(text) TO authenticated;

-- ── 8. Free-tier template quota, enforced in the database ───────────────────
--
-- The paywall advertises "up to 3" templates on free. That promise was never
-- enforced anywhere: createWorkoutTemplate wrote straight to IndexedDB and the
-- cloud accepted any number of rows. Enforcing it on INSERT means the limit
-- holds no matter which client path (create, duplicate, save-from-summary,
-- offline replay) produced the row.

CREATE OR REPLACE FUNCTION public.enforce_free_template_quota()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
  v_paid  boolean;
BEGIN
  -- Paid users are unlimited. Evaluated against the row's owner rather than
  -- auth.uid() so a service-role replay is judged correctly too.
  SELECT EXISTS (
    SELECT 1 FROM public.entitlements e
    WHERE e.user_id = NEW.user_id
      AND e.plan <> 'free'
      AND e.status IN ('active', 'trialing')
      AND (e.current_period_end IS NULL OR e.current_period_end > now() - interval '24 hours')
  ) INTO v_paid;

  IF v_paid THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.workout_templates t
  WHERE t.user_id = NEW.user_id
    AND t.deleted_at IS NULL;

  IF v_count >= 3 THEN
    -- Typed message so the client can map it to a paywall prompt rather than a
    -- generic failure (see FREE_TEMPLATE_LIMIT_ERROR in templateDb.ts).
    RAISE EXCEPTION 'free_template_limit_reached'
      USING HINT = 'Upgrade required to store more than 3 workout templates.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_free_template_quota ON public.workout_templates;
CREATE TRIGGER trg_enforce_free_template_quota
  BEFORE INSERT ON public.workout_templates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_free_template_quota();

-- ── 9. Operator setup (intentionally NOT executed) ──────────────────────────
--
-- Prices are a business decision: amount, currency, VAT treatment, trial length
-- and the provider's own price ids must come from the operator and their
-- accountant. Fill in and run this once the provider account exists. Nothing is
-- purchasable until at least one row here is is_active = true.
--
-- INSERT INTO public.billing_prices (
--   price_key, scope, grants_plan, provider, provider_price_id,
--   currency, unit_amount, tax_inclusive, billing_interval, trial_days,
--   seat_limit, is_active
-- ) VALUES
--   ('pro_monthly', 'consumer', 'pro_monthly', '<provider>', '<provider_price_id>',
--    'ILS', <amount_in_agorot>, true, 'month', <trial_days>, NULL, true),
--   ('pro_yearly',  'consumer', 'pro_yearly',  '<provider>', '<provider_price_id>',
--    'ILS', <amount_in_agorot>, true, 'year',  <trial_days>, NULL, true),
--   ('coach_starter','coach',   'free',        '<provider>', '<provider_price_id>',
--    'ILS', <amount_in_agorot>, true, 'month', 0, <seats_per_unit>, true);

-- ── 10. Period-end awareness in the existing read RPC ───────────────────────
--
-- `current_entitlement()` returned the stored status verbatim, and the client's
-- isPremium() only looks at plan + status. A missed or delayed "subscription
-- ended" webhook therefore left a lapsed subscription reading as active
-- indefinitely. The RPC now expires it itself, with a 24h grace so a payer is
-- never cut off by a few minutes of webhook lag.

CREATE OR REPLACE FUNCTION public.current_entitlement()
RETURNS TABLE (plan text, status text, current_period_end timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE
      WHEN e.plan IS NULL THEN 'free'
      WHEN e.plan <> 'free'
        AND e.current_period_end IS NOT NULL
        AND e.current_period_end <= now() - interval '24 hours'
        THEN 'free'
      ELSE e.plan
    END AS plan,
    CASE
      WHEN e.status IS NULL THEN 'active'
      WHEN e.plan <> 'free'
        AND e.current_period_end IS NOT NULL
        AND e.current_period_end <= now() - interval '24 hours'
        THEN 'expired'
      ELSE e.status
    END AS status,
    e.current_period_end
  FROM (SELECT auth.uid() AS uid) ctx
  LEFT JOIN public.entitlements e ON e.user_id = ctx.uid;
$$;

REVOKE ALL ON FUNCTION public.current_entitlement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_entitlement() TO authenticated;

-- ── 11. Replay-safe webhook idempotency ─────────────────────────────────────
--
-- `billing_events` already had UNIQUE (provider, external_id), which stops a
-- duplicate delivery from being applied twice. On its own that is not enough:
-- if the row is written and the subsequent apply FAILS, the provider's retry hits
-- the unique constraint, is treated as a duplicate, and the subscription is never
-- applied — a paying customer silently gets nothing.
--
-- Recording WHEN processing completed separates "seen" from "done", so a retry of
-- a half-finished event is allowed exactly until it succeeds.

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS processed_at timestamptz;

CREATE INDEX IF NOT EXISTS billing_events_unprocessed_idx
  ON public.billing_events (created_at)
  WHERE processed_at IS NULL;

COMMENT ON COLUMN public.billing_events.processed_at IS
  'Set once the event has been fully applied. NULL means a retry is still allowed (see billing-webhook).';

COMMENT ON TABLE public.billing_prices IS
  'Server-owned price catalogue. The client never sends an amount; checkout takes a price_key only.';
COMMENT ON FUNCTION public.has_feature_access(text) IS
  'Authoritative paid-feature gate. Edge functions and RPCs must call this; PlanGate in React is presentation only.';

-- ============================================================================
-- ENTITLEMENTS — platform-agnostic subscription SSOT (web Stripe/Paddle + native
-- Apple/Google). The client reads its OWN entitlement only; all writes happen
-- via webhook → edge function → service role. No client-write policy exists.
--
-- Follows the project convention (20260608000000_profiles_role.sql,
-- 20260609000000_legal_consent.sql): RLS, DROP POLICY IF EXISTS/CREATE POLICY,
-- SECURITY DEFINER ... SET search_path = public, REVOKE/GRANT EXECUTE.
--
-- Fail-safe: current_entitlement() returns ('free','active',null) when the
-- caller has no row, so the app fully works on the free plan before any
-- payment provider is wired in.
-- ============================================================================

-- ── One entitlement row per user (denormalized SSOT, written by webhooks) ────
CREATE TABLE IF NOT EXISTS public.entitlements (
  user_id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan               text NOT NULL DEFAULT 'free'
                       CHECK (plan IN ('free', 'pro_monthly', 'pro_yearly')),
  status             text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
  source             text CHECK (source IN ('web_stripe', 'web_paddle', 'apple', 'google')),
  current_period_end timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ── Webhook event log — idempotency + audit (service role only) ──────────────
CREATE TABLE IF NOT EXISTS public.billing_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  provider    text,
  external_id text,
  event_type  text,
  payload     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_id)              -- blocks double-processing
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS entitlements_owner_read ON public.entitlements;
CREATE POLICY entitlements_owner_read ON public.entitlements
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- No client INSERT/UPDATE/DELETE policy: entitlements are written ONLY by the
-- service role (webhooks) / SECURITY DEFINER functions. RLS blocks all clients.

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
-- No policy at all → no client access. Service-role connections bypass RLS.

-- ── RPC: the caller's effective entitlement, fail-safe to free ───────────────
CREATE OR REPLACE FUNCTION public.current_entitlement()
RETURNS TABLE (plan text, status text, current_period_end timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(e.plan, 'free')      AS plan,
    COALESCE(e.status, 'active')  AS status,
    e.current_period_end
  FROM (SELECT auth.uid() AS uid) ctx
  LEFT JOIN public.entitlements e ON e.user_id = ctx.uid;
$$;

REVOKE ALL ON FUNCTION public.current_entitlement() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_entitlement() TO authenticated;

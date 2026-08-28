-- ============================================================================
-- ADMIN-ONLY COACH ASSIGNMENT — closes coach self-promotion (2026-08-28)
--
-- Why: 20260608000000_profiles_role.sql ended with
--   GRANT EXECUTE ON FUNCTION public.become_coach(TEXT) TO authenticated;
-- so ANY logged-in user could promote themselves to coach with a single RPC
-- call. profiles.role is the SSOT for "who is a coach", and a coach can read
-- and write their trainees' data — self-service promotion is a privilege
-- escalation path, not a feature.
--
-- After this migration there is exactly ONE promotion path:
--   an app_admins member calls admin_set_coach(target).
-- become_coach() is kept (other migrations and tests reference it) but is no
-- longer executable by the `authenticated` role.
--
-- Out of scope on purpose: admin-side DEMOTION (coach -> trainee). It was not
-- requested, and guard_profile_role() blocks it while coach_profiles rows
-- exist, so it would have to destroy a coach's business data and trainee links.
-- (Self-service exit already exists for the empty case: leave_coach_mode().)
-- ============================================================================

-- ------------------------------------------------------------
-- 1. APP ADMINS — the allow-list. Membership is NOT self-serve.
-- ------------------------------------------------------------
-- No index beyond the primary key: user_id = auth.uid() is the only lookup,
-- and the PK index already covers it.
CREATE TABLE IF NOT EXISTS public.app_admins (
    user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_admins ENABLE ROW LEVEL SECURITY;

-- Read-only, own row only: the app may ask "am I an admin?" and nothing else.
-- Deliberately NO insert/update/delete policy for anon or authenticated — with
-- RLS enabled and no write policy, every client write is refused. The only
-- write paths are service_role (bypasses RLS) and a superuser SQL statement.
DROP POLICY IF EXISTS "app_admins_select_own" ON public.app_admins;
CREATE POLICY "app_admins_select_own" ON public.app_admins
    FOR SELECT USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.app_admins FROM anon, authenticated;
GRANT SELECT ON public.app_admins TO authenticated;

COMMENT ON TABLE public.app_admins IS
  'Operator allow-list. Membership is granted only by service_role or superuser SQL; clients can read their own row and nothing else.';

-- ------------------------------------------------------------
-- 2. is_app_admin() — SECURITY DEFINER so the check cannot be
--    starved by app_admins RLS (same shape as is_coach_of()).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_app_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_admins a
    WHERE a.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_app_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_app_admin() TO authenticated, service_role;

-- ------------------------------------------------------------
-- 3. admin_set_coach() — the only coach-promotion path.
-- ------------------------------------------------------------
-- Does for _target exactly what become_coach() does for the caller: coach
-- business rows first (so guard_profile_role()'s invariant holds), then the
-- role flip. Idempotent on re-call. The privilege gate is the FIRST statement.
CREATE OR REPLACE FUNCTION public.admin_set_coach(_target UUID, _business_name TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_app_admin() THEN
        RAISE EXCEPTION 'not_app_admin' USING ERRCODE = 'insufficient_privilege';
    END IF;

    INSERT INTO public.coach_profiles (id, business_name)
    VALUES (_target, _business_name)
    ON CONFLICT (id) DO NOTHING;

    -- seat_limit 5 = the current free-tier default become_coach() seeds
    -- (20260824010000). guard_coach_subscription_fields() rejects any
    -- authenticated INSERT that is not exactly free/5/active.
    INSERT INTO public.coach_subscriptions (coach_id, plan, seat_limit, status)
    VALUES (_target, 'free', 5, 'active')
    ON CONFLICT (coach_id) DO NOTHING;

    UPDATE public.profiles SET role = 'coach' WHERE id = _target AND role <> 'coach';
END;
$$;

-- authenticated keeps EXECUTE: the gate lives inside the function. service_role
-- is intentionally NOT granted — auth.uid() is NULL for it, so is_app_admin()
-- would refuse anyway; a backend promotes via direct SQL.
REVOKE ALL ON FUNCTION public.admin_set_coach(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_coach(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.admin_set_coach(UUID, TEXT) IS
  'Admin-only coach assignment. Refuses unless is_app_admin(). Idempotent.';

-- ------------------------------------------------------------
-- 4. Close the self-promotion hole.
-- ------------------------------------------------------------
-- become_coach() is NOT dropped: earlier migrations and the pgTAP suites
-- reference it. It simply stops being reachable from a client session.
REVOKE EXECUTE ON FUNCTION public.become_coach(TEXT) FROM authenticated;
REVOKE ALL ON FUNCTION public.become_coach(TEXT) FROM PUBLIC, anon;

COMMENT ON FUNCTION public.become_coach(TEXT) IS
  'Legacy self-promotion RPC. No longer executable by authenticated — use admin_set_coach(). Kept for migration/test references.';

-- ------------------------------------------------------------
-- 5. Seeding the first admin (run ONCE, by the owner)
-- ------------------------------------------------------------
-- No user id or email is hardcoded here on purpose. Seed yourself from the
-- Supabase SQL editor (superuser) or with the service_role key:
--
-- INSERT INTO public.app_admins (user_id) SELECT id FROM auth.users WHERE email = 'owner@example.com' ON CONFLICT DO NOTHING;

-- ============================================================
-- ROLE SPLIT — server-side coach/trainee classification.
-- profiles.role becomes the SSOT for "who is a coach". Backfills from
-- coach_profiles (existing implicit signal), guards self-promotion, and
-- adds an atomic become_coach() RPC as the only coach-promotion path.
-- Invariant: role='coach' requires a coach_profiles row.
-- ============================================================

-- 1. Column + backfill -----------------------------------------------------
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'trainee'
    CHECK (role IN ('coach', 'trainee'));

UPDATE public.profiles p
SET role = 'coach'
WHERE p.role <> 'coach'
  AND EXISTS (SELECT 1 FROM public.coach_profiles cp WHERE cp.id = p.id);

-- New signups: handle_new_user() omits role, so the column DEFAULT
-- ('trainee') applies. Promotion happens only via become_coach().

-- 2. Guard: keep role consistent with coach_profiles ------------------------
-- Blocks a client from self-promoting to coach without a coach_profiles row,
-- and from demoting to trainee while coach business data still exists.
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.role = 'coach' AND OLD.role <> 'coach'
       AND NOT EXISTS (SELECT 1 FROM public.coach_profiles cp WHERE cp.id = NEW.id) THEN
        RAISE EXCEPTION 'role_coach_requires_coach_profile' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.role = 'trainee' AND OLD.role = 'coach'
       AND EXISTS (SELECT 1 FROM public.coach_profiles cp WHERE cp.id = NEW.id) THEN
        RAISE EXCEPTION 'role_trainee_requires_no_coach_profile' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_profile_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.guard_profile_role() FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_profile_role ON public.profiles;
CREATE TRIGGER trg_guard_profile_role
    BEFORE UPDATE OF role ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();

-- 3. become_coach() — the single, atomic coach-promotion path ---------------
-- Creates coach business rows first so the guard trigger is satisfied,
-- then flips the role. Idempotent on re-call.
CREATE OR REPLACE FUNCTION public.become_coach(_business_name TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'unauthenticated' USING ERRCODE = 'insufficient_privilege';
    END IF;

    INSERT INTO public.coach_profiles (id, business_name)
    VALUES (uid, _business_name)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.coach_subscriptions (coach_id, plan, seat_limit, status)
    VALUES (uid, 'free', 1, 'active')
    ON CONFLICT (coach_id) DO NOTHING;

    UPDATE public.profiles SET role = 'coach' WHERE id = uid AND role <> 'coach';
END;
$$;

REVOKE ALL ON FUNCTION public.become_coach(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.become_coach(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.become_coach(TEXT) TO authenticated;

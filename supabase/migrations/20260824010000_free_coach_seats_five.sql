-- ============================================================================
-- Raise the free coach seat limit from 1 to 5 (2026-08-24)
--
-- Why: `become_coach()` seeded seat_limit = 1, so a self-serve coach could
-- never add a second client — client #2 required operator SQL against prod.
-- There is no upgrade path to buy seats yet (billing off), which made the
-- invite screen's "upgrade" copy a dead end. 5 seats covers the realistic
-- pilot coach without any billing surface.
--
-- Also backfills existing free subscriptions still sitting at 1, and updates
-- the INSERT guard in guard_coach_subscription_fields() which pinned new rows
-- to exactly 1. The guard stays: clients still cannot write plan/status/seat;
-- only the allowed default changes.
--
-- Idempotent; safe on any environment state. When billing ships, paid plans
-- overwrite seat_limit through the webhook path (service role bypasses the
-- guard).
-- ============================================================================

-- 1) New coaches get 5 seats.
CREATE OR REPLACE FUNCTION public.become_coach(_business_name TEXT DEFAULT NULL)
RETURNS void
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
    VALUES (uid, 'free', 5, 'active')
    ON CONFLICT (coach_id) DO NOTHING;

    UPDATE public.profiles SET role = 'coach' WHERE id = uid AND role <> 'coach';
END;
$$;

REVOKE ALL ON FUNCTION public.become_coach(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.become_coach(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.become_coach(TEXT) TO authenticated;

-- 2) Backfill: every existing FREE subscription capped at 1 moves up to 5.
--    Paid plans (none exist yet) are left untouched.
UPDATE public.coach_subscriptions
SET seat_limit = 5
WHERE plan = 'free' AND seat_limit < 5;

-- 3) The field-guard now accepts the new free-tier default on INSERT.
CREATE OR REPLACE FUNCTION public.guard_coach_subscription_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RETURN NEW; -- service role / webhook manages billing
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.seat_limit IS DISTINCT FROM 5
           OR NEW.plan IS DISTINCT FROM 'free'
           OR NEW.status IS DISTINCT FROM 'active' THEN
            RAISE EXCEPTION 'coach_subscription_fields_are_server_managed'
                USING ERRCODE = 'check_violation',
                      HINT = 'Self-service signup may only create the free tier; plan upgrades go through billing.';
        END IF;
    ELSE -- UPDATE
        IF NEW.seat_limit IS DISTINCT FROM OLD.seat_limit
           OR NEW.plan IS DISTINCT FROM OLD.plan
           OR NEW.status IS DISTINCT FROM OLD.status THEN
            RAISE EXCEPTION 'coach_subscription_fields_are_server_managed'
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_coach_subscription_fields() FROM PUBLIC, anon, authenticated;

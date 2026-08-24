-- ============================================================================
-- leave_coach_mode() — reversible coach mode (2026-08-24)
--
-- Why: promotion to coach is one tap, but there was no reverse path anywhere.
-- guard_profile_role() actively blocks coach→trainee while a coach_profiles
-- row exists, and coach-invite-accept returns coaches_cannot_join — so a
-- curious trainee who tapped "מאמן" was permanently stuck in a client-
-- management UI with no support path except operator SQL.
--
-- This RPC is the mirror of become_coach():
--   • refuses while ACTIVE or PENDING client links exist (a coach with clients
--     cannot silently abandon them; paused/ended links are fine)
--   • deletes coach_profiles + coach_subscriptions rows first so the role
--     guard's invariant ("trainee requires no coach_profiles row") passes,
--   • then flips profiles.role back to 'trainee'.
--
-- SECURITY DEFINER is required because the client cannot delete its own
-- coach_profiles row under RLS-by-design. Idempotent on re-call.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.leave_coach_mode()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid UUID := auth.uid();
    active_links INT;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'unauthenticated' USING ERRCODE = 'insufficient_privilege';
    END IF;

    -- A coach with real clients must end those relationships explicitly from
    -- the roster first; this RPC is for the "I tapped it by mistake / I don't
    -- coach anymore" case with nothing in flight.
    SELECT count(*) INTO active_links
    FROM public.coach_clients
    WHERE coach_id = uid AND status IN ('active', 'pending');

    IF active_links > 0 THEN
        RAISE EXCEPTION 'coach_has_active_clients'
            USING HINT = 'End all client relationships before leaving coach mode.';
    END IF;

    DELETE FROM public.coach_subscriptions WHERE coach_id = uid;
    DELETE FROM public.coach_profiles WHERE id = uid;

    UPDATE public.profiles SET role = 'trainee' WHERE id = uid AND role <> 'trainee';
END;
$$;

REVOKE ALL ON FUNCTION public.leave_coach_mode() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.leave_coach_mode() FROM anon;
GRANT EXECUTE ON FUNCTION public.leave_coach_mode() TO authenticated;

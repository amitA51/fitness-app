-- ============================================================
-- Server-side seat enforcement at INVITE CREATION time.
-- Seats were only enforced at accept-time (trg_enforce_seat_limit
-- on coach_clients) — the UI disables the create button when full,
-- but a direct API call could still mint pending codes that are
-- doomed to fail at the trainee. Reject them at the source.
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_invite_seat_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    lim INTEGER;
    active_count INTEGER;
BEGIN
    -- Only newly minted pending invites consume a prospective seat.
    IF NEW.status <> 'pending' THEN
        RETURN NEW;
    END IF;

    SELECT seat_limit INTO lim
    FROM public.coach_subscriptions
    WHERE coach_id = NEW.coach_id;
    IF lim IS NULL THEN
        lim := 1; -- no subscription row => solo default (matches enforce_seat_limit)
    END IF;

    SELECT COUNT(*) INTO active_count
    FROM public.coach_clients
    WHERE coach_id = NEW.coach_id AND status = 'active';

    IF active_count >= lim THEN
        RAISE EXCEPTION 'invite_seat_limit_reached' USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_invite_seat_limit ON public.coach_invites;
CREATE TRIGGER trg_enforce_invite_seat_limit
    BEFORE INSERT ON public.coach_invites
    FOR EACH ROW EXECUTE FUNCTION public.enforce_invite_seat_limit();

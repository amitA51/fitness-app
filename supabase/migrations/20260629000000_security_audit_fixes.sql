-- ============================================================================
-- SECURITY AUDIT FIXES (2026-06-29) — claude-bughunter whitebox audit
-- ----------------------------------------------------------------------------
-- All findings below were CONFIRMED against the LIVE database (pg_policies /
-- pg_get_functiondef / pg_constraint) before this migration was written.
--
-- Fixes:
--   H-1/H-3  coach_clients: block client-driven activation of a link
--            (uninvited self-enrollment + re-activating a coach-ended link)
--   H-2      coach_subscriptions: stop clients writing plan/seat_limit/status
--            (self-granted unlimited seats) + bound seat_limit
--   M-2      is_group_member: require an ACTIVE coach_clients link
--            (terminated/paused clients kept group chat + assignment access)
--   M-3      8 coach-writable health tables: make user_id immutable
--            (a coach could re-attribute a record between two of their clients)
--   L-2      audit_log: a writer may only log against a user they relate to
--
-- PRE-DEPLOY NOTES (verify on a branch DB first — `supabase db diff`):
--   * The coach-invite-accept edge function activates links with the SERVICE
--     ROLE (no end-user JWT), so auth.uid() IS NULL there and the new
--     coach_clients trigger ALLOWS it. Confirm that path still works.
--   * become_coach() inserts coach_subscriptions {plan:'free', seat_limit:1,
--     status:'active'} with the caller's uid; the H-2 guard whitelists exactly
--     those INSERT defaults, so self-service coach signup still works.
--   * is_group_member is used for the CLIENT side of group policies; the
--     group's coach is granted access by separate `coach_id = auth.uid()`
--     clauses, so this redefinition does not lock coaches out. Re-check the
--     group_messages / assignments / reminders SELECT policies before deploy.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- H-1 / H-3 — coach_clients: only the coach or the service role may ACTIVATE.
-- A client (the non-coach party) can still INSERT a 'pending' row and set
-- 'paused'/'ended', but can no longer flip a link to 'active' themselves —
-- which is what bypassed the invite + consent + seat flow.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_coach_client_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
BEGIN
    -- Server-side (service-role) calls have no end-user JWT — allow them
    -- (this is the coach-invite-accept edge function path).
    IF uid IS NULL THEN
        RETURN NEW;
    END IF;

    -- The client party may never set the relationship to 'active'.
    -- (coach_id <> client_id is already a table CHECK, so a coach activating
    --  their own row hits uid = NEW.coach_id and is allowed.)
    IF NEW.status = 'active' AND uid = NEW.client_id AND uid <> NEW.coach_id THEN
        RAISE EXCEPTION 'client_cannot_activate_coach_link'
            USING ERRCODE = 'check_violation',
                  HINT = 'Activation is performed by the coach or the invite-accept edge function.';
    END IF;

    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_coach_client_activation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_coach_client_activation ON public.coach_clients;
CREATE TRIGGER trg_enforce_coach_client_activation
    BEFORE INSERT OR UPDATE ON public.coach_clients
    FOR EACH ROW EXECUTE FUNCTION public.enforce_coach_client_activation();

-- ----------------------------------------------------------------------------
-- H-2 — coach_subscriptions: plan / seat_limit / status are server-managed.
-- A client (auth.uid() not null) may not change them; INSERT is pinned to the
-- free-tier defaults that become_coach() seeds. Service role (uid null) and
-- billing webhooks may still set paid plans.
-- ----------------------------------------------------------------------------
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
        IF NEW.seat_limit IS DISTINCT FROM 1
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

DROP TRIGGER IF EXISTS trg_guard_coach_subscription_fields ON public.coach_subscriptions;
CREATE TRIGGER trg_guard_coach_subscription_fields
    BEFORE INSERT OR UPDATE ON public.coach_subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.guard_coach_subscription_fields();

-- Defense-in-depth bound. If this ADD fails, an existing row already has an
-- out-of-range seat_limit (possible prior exploitation) — investigate that row
-- before clamping it. Idempotent so the migration is safe to re-run.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'coach_subscriptions_seat_limit_check'
          AND conrelid = 'public.coach_subscriptions'::regclass
    ) THEN
        ALTER TABLE public.coach_subscriptions
            ADD CONSTRAINT coach_subscriptions_seat_limit_check
            CHECK (seat_limit >= 0 AND seat_limit <= 500);
    END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- M-2 — is_group_member: membership now requires an ACTIVE coach_clients link
-- with the group's coach. Ending/pausing a client now revokes their group
-- chat + assignment + reminder access immediately (no orphaned membership).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_group_member(_group uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.client_group_members m
        JOIN public.client_groups g ON g.id = m.group_id
        JOIN public.coach_clients cc
          ON cc.coach_id = g.coach_id
         AND cc.client_id = m.client_id
        WHERE m.group_id = _group
          AND m.client_id = auth.uid()
          AND cc.status = 'active'
    );
$$;

-- Preserve the existing grant posture (authenticated + service_role; not anon).
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- M-3 — user_id immutability on the 8 coach-writable trainee-data tables.
-- Prevents a coach from moving a record from one active client to another
-- (forging / corrupting cross-client health history). Owners are already
-- bound to their own user_id by the per-table WITH CHECK.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.forbid_user_id_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
        RAISE EXCEPTION 'user_id_is_immutable' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.forbid_user_id_reassignment() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'workout_sessions','workout_templates','personal_exercises',
        'body_weight','body_measurements','personal_records',
        'recovery_logs','nutrition_logs'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_forbid_user_id_reassignment ON public.%I', t);
        EXECUTE format(
            'CREATE TRIGGER trg_forbid_user_id_reassignment BEFORE UPDATE ON public.%I '
            'FOR EACH ROW EXECUTE FUNCTION public.forbid_user_id_reassignment()', t);
    END LOOP;
END;
$$;

-- ----------------------------------------------------------------------------
-- L-2 — audit_log: an actor may only insert a row whose subject is themselves
-- or a user they are actually coaching / coached by (no fabricated entries
-- pointing at arbitrary victims).
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_log_insert_own ON public.audit_log;
CREATE POLICY audit_log_insert_own ON public.audit_log
    FOR INSERT TO authenticated
    WITH CHECK (
        actor_id = (SELECT auth.uid())
        AND (
            subject_user_id = (SELECT auth.uid())
            OR public.is_coach_of(subject_user_id)
            OR public.is_client_of(subject_user_id)
        )
    );

COMMIT;

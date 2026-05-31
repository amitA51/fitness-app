-- ============================================================
-- SECURITY HARDENING — RLS + immutability triggers
-- S-2: coach_clients INSERT restricted to status='pending' only
-- S-3: messages INSERT requires active coach_clients relationship
-- S-4: immutable columns trigger (coach_id, client_id, consent_at)
-- S-7: messages UPDATE restricted to active relationships
-- ============================================================

BEGIN;

-- S-2: Restrict client-side INSERT to status='pending' only.
-- The edge function (service role) bypasses RLS for active creation.
DROP POLICY IF EXISTS "coach_clients_insert_client" ON public.coach_clients;
CREATE POLICY "coach_clients_insert_client" ON public.coach_clients
    FOR INSERT WITH CHECK (
        client_id = (SELECT auth.uid())
        AND status = 'pending'
    );

-- S-3: messages INSERT requires an active coach_clients relationship.
DROP POLICY IF EXISTS "messages_insert_party" ON public.messages;
CREATE POLICY "messages_insert_party" ON public.messages
    FOR INSERT WITH CHECK (
        sender_id = (SELECT auth.uid())
        AND (coach_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid()))
        AND EXISTS (
            SELECT 1 FROM public.coach_clients cc
            WHERE cc.coach_id = messages.coach_id
              AND cc.client_id = messages.client_id
              AND cc.status = 'active'
        )
    );

-- S-7: messages UPDATE (mark-as-read) restricted to active relationships.
-- SELECT is intentionally left open for history access after relationship ends.
DROP POLICY IF EXISTS "messages_update_party" ON public.messages;
CREATE POLICY "messages_update_party" ON public.messages
    FOR UPDATE USING (
        (coach_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid()))
        AND EXISTS (
            SELECT 1 FROM public.coach_clients cc
            WHERE cc.coach_id = messages.coach_id
              AND cc.client_id = messages.client_id
              AND cc.status = 'active'
        )
    ) WITH CHECK (
        coach_id = (SELECT auth.uid()) OR client_id = (SELECT auth.uid())
    );

-- S-4: Prevent changing coach_id, client_id, or consent_at after initial set.
CREATE OR REPLACE FUNCTION public.immutable_coach_client_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NEW.coach_id IS DISTINCT FROM OLD.coach_id THEN
        RAISE EXCEPTION 'coach_id is immutable' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
        RAISE EXCEPTION 'client_id is immutable' USING ERRCODE = 'check_violation';
    END IF;
    IF OLD.consent_at IS NOT NULL AND NEW.consent_at IS DISTINCT FROM OLD.consent_at THEN
        RAISE EXCEPTION 'consent_at is immutable once set' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_immutable_coach_client_cols ON public.coach_clients;
CREATE TRIGGER trg_immutable_coach_client_cols
    BEFORE UPDATE ON public.coach_clients
    FOR EACH ROW EXECUTE FUNCTION public.immutable_coach_client_columns();

-- Revoke direct RPC access to the new trigger function.
REVOKE EXECUTE ON FUNCTION public.immutable_coach_client_columns() FROM anon, authenticated;

COMMIT;

-- Design decision (S-7 SELECT): messages_select_party intentionally allows
-- both parties to read message history after a relationship ends. This is a
-- deliberate UX choice — users retain access to their conversation history.

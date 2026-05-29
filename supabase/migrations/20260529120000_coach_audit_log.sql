-- ============================================================
-- COACH PLATFORM — audit log
-- Tracks coach actions on client data for accountability.
-- Idempotent.
-- ============================================================

SET check_function_bodies = off;

CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subject_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    table_name TEXT NOT NULL,
    action TEXT NOT NULL,
    row_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_subject
    ON public.audit_log(subject_user_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_insert_own" ON public.audit_log;
CREATE POLICY "audit_log_insert_own" ON public.audit_log
    FOR INSERT WITH CHECK (actor_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "audit_log_select_party" ON public.audit_log;
CREATE POLICY "audit_log_select_party" ON public.audit_log
    FOR SELECT USING (actor_id = (SELECT auth.uid()) OR subject_user_id = (SELECT auth.uid()));

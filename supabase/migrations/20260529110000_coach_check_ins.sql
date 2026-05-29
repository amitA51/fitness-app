-- ============================================================
-- COACH PLATFORM — check-ins & private coach notes
-- check_ins: a trainee's periodic self-report (owner writes; their active
--   coach reads). coach_notes: a coach's PRIVATE notes about a client (only the
--   authoring coach can read/write — the client never sees them). Idempotent.
-- ============================================================

SET check_function_bodies = off;

-- ---- check_ins -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.check_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    weight NUMERIC,
    mood SMALLINT CHECK (mood BETWEEN 1 AND 5),
    energy SMALLINT CHECK (energy BETWEEN 1 AND 5),
    notes TEXT,
    photos JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_check_ins_user ON public.check_ins(user_id, date DESC);

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "check_ins_owner_all" ON public.check_ins;
DROP POLICY IF EXISTS "check_ins_coach_select" ON public.check_ins;

-- Owner has full control of their own check-ins.
CREATE POLICY "check_ins_owner_all" ON public.check_ins
    FOR ALL USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
-- An ACTIVE coach of the owner may read them.
CREATE POLICY "check_ins_coach_select" ON public.check_ins
    FOR SELECT USING (public.is_coach_of(user_id));

-- ---- coach_notes (private to the coach) ------------------------------------
CREATE TABLE IF NOT EXISTS public.coach_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_notes_lookup
    ON public.coach_notes(coach_id, client_id, created_at DESC);

ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_notes_owner_all" ON public.coach_notes;

-- ONLY the authoring coach can read/manage; the client has no access at all.
CREATE POLICY "coach_notes_owner_all" ON public.coach_notes
    FOR ALL USING (coach_id = (SELECT auth.uid())) WITH CHECK (coach_id = (SELECT auth.uid()));

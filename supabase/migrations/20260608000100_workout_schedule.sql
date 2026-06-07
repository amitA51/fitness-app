-- ============================================================
-- WORKOUT SCHEDULE — coach (or self) assigns workouts to concrete days.
-- One row per scheduled occurrence; recurrence is expanded at create time
-- (the recurrence rule itself lives on assignments.schedule JSONB).
-- Feeds the trainee "today's workout" card and scheduled-vs-done adherence.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workout_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL = self-scheduled
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- the trainee (RLS subject)
    template_id UUID,                       -- workout_templates row to run that day
    assignment_id UUID REFERENCES public.assignments(id) ON DELETE SET NULL,
    scheduled_date DATE NOT NULL,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'done', 'skipped')),
    session_id UUID,                        -- workout_sessions row that fulfilled it
    completed_at TIMESTAMPTZ,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, scheduled_date, template_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_schedule_user_date
    ON public.workout_schedule (user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_workout_schedule_coach_date
    ON public.workout_schedule (coach_id, scheduled_date);

ALTER TABLE public.workout_schedule ENABLE ROW LEVEL SECURITY;

-- Trainee: full control of own schedule (self-scheduling + mark done/skip).
CREATE POLICY "ws_owner_all" ON public.workout_schedule
    FOR ALL USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

-- Coach: full control of an ACTIVE client's schedule (is_coach_of gates on consent).
CREATE POLICY "ws_coach_all" ON public.workout_schedule
    FOR ALL USING (public.is_coach_of(user_id))
    WITH CHECK (public.is_coach_of(user_id));

DROP TRIGGER IF EXISTS update_workout_schedule_updated_at ON public.workout_schedule;
CREATE TRIGGER update_workout_schedule_updated_at
    BEFORE UPDATE ON public.workout_schedule
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Realtime so the trainee "today" card reacts live to coach scheduling.
-- RLS still applies to Realtime payloads.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'workout_schedule'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.workout_schedule;
    END IF;
END $$;

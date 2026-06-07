-- ============================================================
-- COACH DIRECT-EDIT — enable Realtime on the trainee-owned tables a coach
-- can now edit, so the trainee device reflects coach edits live.
-- RLS still applies to Realtime payloads. Idempotent (same pattern as
-- 20260529000200_coach_realtime.sql).
-- ============================================================
DO $$
DECLARE
    t TEXT;
    tbls TEXT[] := ARRAY['workout_sessions','body_weight','body_measurements','personal_records','recovery_logs'];
BEGIN
    FOREACH t IN ARRAY tbls LOOP
        IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
            CONTINUE;
        END IF;
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', t);
        END IF;
    END LOOP;
END $$;

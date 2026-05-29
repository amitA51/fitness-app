-- ============================================================
-- COACH PLATFORM — enable Supabase Realtime on coaching tables.
-- RLS still applies to Realtime, so clients only receive changes for rows
-- they are allowed to see. Idempotent: skips tables already in the publication
-- or absent from this deployment.
-- ============================================================
DO $$
DECLARE
    t TEXT;
    tbls TEXT[] := ARRAY['assignments','messages','reminders','workout_templates','nutrition_logs'];
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

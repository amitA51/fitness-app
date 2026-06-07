-- ============================================================
-- COACH PLATFORM — reusable program templates (coach library).
-- Stores the builder-form shape (days[] of exercises), NOT client
-- workout_templates rows, so one saved program can be assigned to any
-- client (fresh client templates are created at assign time).
-- Idempotent. Coach-private via RLS.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coach_program_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    days JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coach_program_templates_coach
    ON public.coach_program_templates(coach_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coach_program_templates_name_len'
  ) THEN
    ALTER TABLE public.coach_program_templates
      ADD CONSTRAINT coach_program_templates_name_len CHECK (char_length(name) BETWEEN 1 AND 200);
  END IF;
END $$;

ALTER TABLE public.coach_program_templates ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'coach_program_templates'
      AND policyname = 'coach_program_templates_all_own'
  ) THEN
    CREATE POLICY "coach_program_templates_all_own" ON public.coach_program_templates
      FOR ALL USING (coach_id = (SELECT auth.uid()))
      WITH CHECK (coach_id = (SELECT auth.uid()));
  END IF;
END $$;

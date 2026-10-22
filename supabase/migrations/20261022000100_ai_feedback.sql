-- ============================================================================
-- AI answer reports
-- ----------------------------------------------------------------------------
-- Google Play's generative-AI policy: users must be able to flag an AI answer
-- without leaving the app. The AI coach panel writes one row per report; the
-- owner reads them in the dashboard.
--
-- A user may only insert, and only as themself: user_id comes from the column
-- default (auth.uid()) because the client is granted no write on that column,
-- and the policy re-checks it. Nobody reads the table through the API.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_feedback (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  surface     text NOT NULL CHECK (char_length(surface) BETWEEN 1 AND 40),
  subject     text CHECK (char_length(subject) <= 200),
  question    text NOT NULL CHECK (char_length(question) <= 1000),
  answer      text NOT NULL CHECK (char_length(answer) <= 8000),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_feedback_created_at_idx ON public.ai_feedback (created_at DESC);

ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_feedback FROM anon, authenticated;
GRANT INSERT (surface, subject, question, answer) ON public.ai_feedback TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'ai_feedback' AND policyname = 'ai_feedback_insert_own'
  ) THEN
    CREATE POLICY ai_feedback_insert_own ON public.ai_feedback
      FOR INSERT TO authenticated
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;

COMMENT ON TABLE public.ai_feedback IS
  'Reports of AI answers flagged by users (Play generative-AI policy). Insert-only for the reporting user; read via the dashboard.';

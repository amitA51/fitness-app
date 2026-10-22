-- ============================================================================
-- AI answer reports: at most 20 per user per day
-- ----------------------------------------------------------------------------
-- ai_feedback (20261022000100) accepts inserts from any signed-in user, up to
-- ~9 KB each. Without a cap one account could fill the disk of a small
-- instance. A real user flags a handful of answers at most; 20 a day is far
-- above that and far below harm.
--
-- SECURITY DEFINER because users hold no SELECT on the table: the count must
-- run as the owner. search_path is pinned so the function cannot be redirected.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_feedback_daily_cap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (
    SELECT count(*) FROM public.ai_feedback
    WHERE user_id = NEW.user_id AND created_at > now() - interval '1 day'
  ) >= 20 THEN
    RAISE EXCEPTION 'ai_feedback daily limit reached' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.ai_feedback_daily_cap() FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS ai_feedback_user_created_idx
  ON public.ai_feedback (user_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'ai_feedback_daily_cap' AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER ai_feedback_daily_cap
      BEFORE INSERT ON public.ai_feedback
      FOR EACH ROW EXECUTE FUNCTION public.ai_feedback_daily_cap();
  END IF;
END $$;

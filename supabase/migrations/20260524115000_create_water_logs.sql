-- Create water_logs table backing the client water tracking + sync (DA-3).
-- Client (waterService.ts / supabaseSync.ts) upserts {id, user_id, date, amount_ml, created_at}.
CREATE TABLE IF NOT EXISTS public.water_logs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date text NOT NULL,
  amount_ml integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.water_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_water_logs_user_date ON public.water_logs (user_id, date DESC);

DROP POLICY IF EXISTS "water_logs_select_own" ON public.water_logs;
CREATE POLICY "water_logs_select_own" ON public.water_logs
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "water_logs_insert_own" ON public.water_logs;
CREATE POLICY "water_logs_insert_own" ON public.water_logs
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "water_logs_update_own" ON public.water_logs;
CREATE POLICY "water_logs_update_own" ON public.water_logs
  FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "water_logs_delete_own" ON public.water_logs;
CREATE POLICY "water_logs_delete_own" ON public.water_logs
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Fixture for the sync-integrity migration test. Composable with
-- fixtures/supabase_min_stub.sql, which already creates `workout_templates`.
--
-- What it sets up deliberately:
--   * the LEGACY `update_updated_at_column` trigger on workout_templates, so the
--     migration's replace path is exercised (and we can prove exactly one trigger
--     remains afterwards rather than two firing in sequence);
--   * `water_logs` WITHOUT a deleted_at column, so the add-column path runs.
--
-- Not part of the app schema.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.updated_at IS NULL OR NEW.updated_at <= OLD.updated_at THEN
    NEW.updated_at = now();
  END IF;
  NEW.updated_at = LEAST(COALESCE(NEW.updated_at, now()), now() + interval '5 minutes');
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.workout_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

DROP TRIGGER IF EXISTS update_workout_templates_updated_at ON public.workout_templates;
CREATE TRIGGER update_workout_templates_updated_at
  BEFORE UPDATE ON public.workout_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- No deleted_at and no trigger: the migration must add both.
DROP TABLE IF EXISTS public.water_logs;
CREATE TABLE public.water_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_ml integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

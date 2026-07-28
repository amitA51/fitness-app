-- ============================================================================
-- Columns for fields the app has always had but could never store
-- ============================================================================
-- Each column below backs a field that exists on the local record, is written by
-- real UI, and is read back by real UI — but had no cloud column, so both push
-- paths dropped it. The symptom in every case is the same and easy to mistake
-- for "sync is broken": you enter something on one device and it is simply
-- absent on the next one, with no error anywhere.
--
-- All additive and nullable, so an older client that does not send them keeps
-- working.
-- ============================================================================

-- ── workout_templates: library personalisation ──────────────────────────────
-- `is_builtin` is the important one. dataService.initializeData() re-seeds the
-- built-in templates when it cannot tell which rows are built-in, so losing the
-- flag on a cloud restore made the standard templates come back as DUPLICATES
-- alongside the restored copies. `is_favorite`/`times_used`/`last_used` silently
-- reset the user's own library ordering and favourites on every restore.
ALTER TABLE public.workout_templates
  ADD COLUMN IF NOT EXISTS last_used     timestamptz,
  ADD COLUMN IF NOT EXISTS times_used    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_favorite   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS muscle_groups text[],
  ADD COLUMN IF NOT EXISTS is_builtin    boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.workout_templates.is_builtin IS
  'Marks a shipped built-in template. Without it a restore cannot distinguish built-ins and dataService re-seeds them, creating duplicates.';

-- ── workout_sessions: the user's own post-workout input ─────────────────────
-- `rating` is written by the workout summary screen and displayed by
-- WorkoutDetail, so dropping it meant a rating you gave vanished everywhere else.
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS rating          integer,
  ADD COLUMN IF NOT EXISTS calories_burned numeric;

ALTER TABLE public.workout_sessions
  DROP CONSTRAINT IF EXISTS workout_sessions_rating_check;
ALTER TABLE public.workout_sessions
  ADD CONSTRAINT workout_sessions_rating_check
  CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);

-- ── nutrition_logs: the entry title ────────────────────────────────────────
-- The pull mapper had to rebuild this as '' because there was nowhere to put it,
-- so every restored meal entry lost its name.
ALTER TABLE public.nutrition_logs
  ADD COLUMN IF NOT EXISTS name text;

COMMENT ON COLUMN public.nutrition_logs.name IS
  'MealEntry.name. Previously unstorable, so pulled entries always came back with an empty title.';

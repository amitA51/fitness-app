-- ============================================================================
-- WORKOUT SESSIONS — stop dropping `status` and `template_id` on sync
-- ============================================================================
-- `WorkoutSession` (src/types/index.ts) carries both `status` and `templateId`,
-- but the cloud table had neither column, so both push mappers
-- (syncWorkoutSession in supabaseSync.ts and the batchUpsert in
-- supabaseSyncOrchestrator.ts) silently discarded them.
--
-- Consequences that were live:
--
--   • `templateId` is how `reconcileProgramOnSessionSave` (programService.ts)
--     proves a completed workout came from the program-day template it sent the
--     trainee to. Once the local IndexedDB copy is gone — which sign-out and
--     session-expiry both cause — the sessions pulled back from the cloud have
--     `templateId: null` forever, so the 12-week program can no longer tell which
--     of its days were actually completed. The linkage is not recoverable from
--     anywhere else: it had to be reconstructed by fingerprinting exercise names
--     against the program data.
--
--   • `status` was only saved from total loss by a fallback in
--     `toCanonicalSession` (`s.status ?? (s.endTime ? 'completed' : 'active')`).
--     That heuristic silently mislabels a CANCELLED session that happens to have
--     an end time as completed, and 20+ call sites filter on
--     `status === 'completed'`.
--
-- `template_id` is deliberately `text` with NO foreign key: template ids in this
-- app are not all uuids (the program day runner uses the fixed literal
-- `__bbt_program_day__`, and that template is intentionally never uploaded), so a
-- uuid column would 22P02-reject an entire 50-row batch.
-- ============================================================================

ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS template_id text,
  ADD COLUMN IF NOT EXISTS status text;

-- Backfill using the same rule `toCanonicalSession` already applies on read, so
-- existing rows stop depending on the client-side fallback. Left NULL where the
-- session never ended, since 'active' is the client's own default.
UPDATE public.workout_sessions
   SET status = 'completed'
 WHERE status IS NULL
   AND end_time IS NOT NULL;

-- Constrain to the values the `WorkoutSession` union allows. NULL stays legal so
-- an older client that does not send the column is not rejected.
ALTER TABLE public.workout_sessions
  DROP CONSTRAINT IF EXISTS workout_sessions_status_check;
ALTER TABLE public.workout_sessions
  ADD CONSTRAINT workout_sessions_status_check
  CHECK (status IS NULL OR status IN ('active', 'completed', 'cancelled'));

-- The program reconcile path looks up "this user's sessions for this template".
CREATE INDEX IF NOT EXISTS workout_sessions_user_template_idx
  ON public.workout_sessions (user_id, template_id)
  WHERE template_id IS NOT NULL;

COMMENT ON COLUMN public.workout_sessions.template_id IS
  'Template the workout was started from; NULL for a free workout. Plain text, not a FK: not every template id is a uuid.';
COMMENT ON COLUMN public.workout_sessions.status IS
  'active | completed | cancelled. Previously dropped on sync and reconstructed from end_time, which mislabelled cancelled sessions.';

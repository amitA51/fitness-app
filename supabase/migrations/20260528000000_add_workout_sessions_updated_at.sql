-- ============================================================
-- Add updated_at column + auto-update trigger to workout_sessions
-- ============================================================
--
-- Why: workout_sessions was the only synced table with just created_at and no
-- updated_at. Last-write-wins sync needs a server-maintained updated_at to
-- reconcile concurrent edits; without it, edited sessions could not be
-- correctly merged across devices.
--
-- The update_updated_at_column() trigger function and the matching triggers on
-- the other tables already exist in schema.sql; this migration brings
-- workout_sessions in line with them.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS + DROP TRIGGER IF EXISTS before CREATE.

BEGIN;

ALTER TABLE workout_sessions
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS update_workout_sessions_updated_at ON workout_sessions;

CREATE TRIGGER update_workout_sessions_updated_at
    BEFORE UPDATE ON workout_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

COMMIT;

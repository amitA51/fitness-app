-- ============================================================
-- Add WITH CHECK to all UPDATE RLS policies
-- ============================================================
--
-- Why: An UPDATE policy with only a USING clause allows the row to pass the
-- pre-update row filter but does NOT prevent the user from changing the
-- user_id column to someone else's UID in the resulting row. Adding
-- WITH CHECK ((SELECT auth.uid()) = user_id) ensures that both the existing
-- row AND the post-update row must belong to the authenticated user, which
-- closes the user_id-hijacking vector.
--
-- Tables patched: workout_sessions, workout_templates, personal_exercises,
--   personal_records, body_weight, body_measurements, recovery_logs,
--   nutrition_logs, user_settings, ai_conversations
--
-- Idempotent: uses DROP POLICY IF EXISTS before each CREATE.

BEGIN;

-- ---------- workout_sessions ----------
DROP POLICY IF EXISTS "Users can update their own workout sessions" ON workout_sessions;
CREATE POLICY "Users can update their own workout sessions"
    ON workout_sessions FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------- workout_templates ----------
DROP POLICY IF EXISTS "Users can update their own workout templates" ON workout_templates;
CREATE POLICY "Users can update their own workout templates"
    ON workout_templates FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------- personal_exercises ----------
DROP POLICY IF EXISTS "Users can update their own personal exercises" ON personal_exercises;
CREATE POLICY "Users can update their own personal exercises"
    ON personal_exercises FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------- personal_records ----------
DROP POLICY IF EXISTS "Users can update their own personal records" ON personal_records;
CREATE POLICY "Users can update their own personal records"
    ON personal_records FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------- body_weight ----------
DROP POLICY IF EXISTS "Users can update their own body weight" ON body_weight;
CREATE POLICY "Users can update their own body weight"
    ON body_weight FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------- body_measurements ----------
DROP POLICY IF EXISTS "Users can update their own body measurements" ON body_measurements;
CREATE POLICY "Users can update their own body measurements"
    ON body_measurements FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------- recovery_logs ----------
DROP POLICY IF EXISTS "Users can update their own recovery logs" ON recovery_logs;
CREATE POLICY "Users can update their own recovery logs"
    ON recovery_logs FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------- nutrition_logs ----------
DROP POLICY IF EXISTS "Users can update their own nutrition logs" ON nutrition_logs;
CREATE POLICY "Users can update their own nutrition logs"
    ON nutrition_logs FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------- user_settings ----------
DROP POLICY IF EXISTS "Users can update their own user settings" ON user_settings;
CREATE POLICY "Users can update their own user settings"
    ON user_settings FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- ---------- ai_conversations ----------
DROP POLICY IF EXISTS "Users can update their own AI conversations" ON ai_conversations;
CREATE POLICY "Users can update their own AI conversations"
    ON ai_conversations FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

COMMIT;

-- ============================================================
-- Optimize RLS policies by wrapping auth.uid() in a subquery
-- ============================================================
--
-- Why: Postgres evaluates `auth.uid()` per row in RLS predicates. Wrapping it
-- as `(SELECT auth.uid())` makes the planner treat it as an initplan that is
-- evaluated once per query rather than per row, materially reducing cost on
-- large tables. Reference: Supabase RLS performance guide.
--
-- This migration drops each policy and re-creates it with the wrapped form.
-- Policy names, operations (SELECT/INSERT/UPDATE/DELETE), and target tables
-- are preserved exactly so callers and audit logs stay valid.
--
-- Idempotent: uses DROP POLICY IF EXISTS before each CREATE.

BEGIN;

-- ---------- workout_templates ----------
DROP POLICY IF EXISTS "Users can view their own workout templates" ON workout_templates;
CREATE POLICY "Users can view their own workout templates"
    ON workout_templates FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own workout templates" ON workout_templates;
CREATE POLICY "Users can insert their own workout templates"
    ON workout_templates FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own workout templates" ON workout_templates;
CREATE POLICY "Users can update their own workout templates"
    ON workout_templates FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own workout templates" ON workout_templates;
CREATE POLICY "Users can delete their own workout templates"
    ON workout_templates FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- ---------- workout_sessions ----------
DROP POLICY IF EXISTS "Users can view their own workout sessions" ON workout_sessions;
CREATE POLICY "Users can view their own workout sessions"
    ON workout_sessions FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own workout sessions" ON workout_sessions;
CREATE POLICY "Users can insert their own workout sessions"
    ON workout_sessions FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own workout sessions" ON workout_sessions;
CREATE POLICY "Users can update their own workout sessions"
    ON workout_sessions FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own workout sessions" ON workout_sessions;
CREATE POLICY "Users can delete their own workout sessions"
    ON workout_sessions FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- ---------- personal_exercises ----------
DROP POLICY IF EXISTS "Users can view their own personal exercises" ON personal_exercises;
CREATE POLICY "Users can view their own personal exercises"
    ON personal_exercises FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own personal exercises" ON personal_exercises;
CREATE POLICY "Users can insert their own personal exercises"
    ON personal_exercises FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own personal exercises" ON personal_exercises;
CREATE POLICY "Users can update their own personal exercises"
    ON personal_exercises FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own personal exercises" ON personal_exercises;
CREATE POLICY "Users can delete their own personal exercises"
    ON personal_exercises FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- ---------- body_weight ----------
DROP POLICY IF EXISTS "Users can view their own body weight" ON body_weight;
CREATE POLICY "Users can view their own body weight"
    ON body_weight FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own body weight" ON body_weight;
CREATE POLICY "Users can insert their own body weight"
    ON body_weight FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own body weight" ON body_weight;
CREATE POLICY "Users can update their own body weight"
    ON body_weight FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own body weight" ON body_weight;
CREATE POLICY "Users can delete their own body weight"
    ON body_weight FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- ---------- body_measurements ----------
DROP POLICY IF EXISTS "Users can view their own body measurements" ON body_measurements;
CREATE POLICY "Users can view their own body measurements"
    ON body_measurements FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own body measurements" ON body_measurements;
CREATE POLICY "Users can insert their own body measurements"
    ON body_measurements FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own body measurements" ON body_measurements;
CREATE POLICY "Users can update their own body measurements"
    ON body_measurements FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own body measurements" ON body_measurements;
CREATE POLICY "Users can delete their own body measurements"
    ON body_measurements FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- ---------- personal_records ----------
DROP POLICY IF EXISTS "Users can view their own personal records" ON personal_records;
CREATE POLICY "Users can view their own personal records"
    ON personal_records FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own personal records" ON personal_records;
CREATE POLICY "Users can insert their own personal records"
    ON personal_records FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own personal records" ON personal_records;
CREATE POLICY "Users can update their own personal records"
    ON personal_records FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own personal records" ON personal_records;
CREATE POLICY "Users can delete their own personal records"
    ON personal_records FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- ---------- recovery_logs ----------
DROP POLICY IF EXISTS "Users can view their own recovery logs" ON recovery_logs;
CREATE POLICY "Users can view their own recovery logs"
    ON recovery_logs FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own recovery logs" ON recovery_logs;
CREATE POLICY "Users can insert their own recovery logs"
    ON recovery_logs FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own recovery logs" ON recovery_logs;
CREATE POLICY "Users can update their own recovery logs"
    ON recovery_logs FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own recovery logs" ON recovery_logs;
CREATE POLICY "Users can delete their own recovery logs"
    ON recovery_logs FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- ---------- nutrition_logs ----------
DROP POLICY IF EXISTS "Users can view their own nutrition logs" ON nutrition_logs;
CREATE POLICY "Users can view their own nutrition logs"
    ON nutrition_logs FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own nutrition logs" ON nutrition_logs;
CREATE POLICY "Users can insert their own nutrition logs"
    ON nutrition_logs FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own nutrition logs" ON nutrition_logs;
CREATE POLICY "Users can update their own nutrition logs"
    ON nutrition_logs FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own nutrition logs" ON nutrition_logs;
CREATE POLICY "Users can delete their own nutrition logs"
    ON nutrition_logs FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- ---------- user_settings ----------
DROP POLICY IF EXISTS "Users can view their own user settings" ON user_settings;
CREATE POLICY "Users can view their own user settings"
    ON user_settings FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own user settings" ON user_settings;
CREATE POLICY "Users can insert their own user settings"
    ON user_settings FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own user settings" ON user_settings;
CREATE POLICY "Users can update their own user settings"
    ON user_settings FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own user settings" ON user_settings;
CREATE POLICY "Users can delete their own user settings"
    ON user_settings FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- ---------- ai_conversations ----------
DROP POLICY IF EXISTS "Users can view their own AI conversations" ON ai_conversations;
CREATE POLICY "Users can view their own AI conversations"
    ON ai_conversations FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own AI conversations" ON ai_conversations;
CREATE POLICY "Users can insert their own AI conversations"
    ON ai_conversations FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own AI conversations" ON ai_conversations;
CREATE POLICY "Users can update their own AI conversations"
    ON ai_conversations FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own AI conversations" ON ai_conversations;
CREATE POLICY "Users can delete their own AI conversations"
    ON ai_conversations FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- ---------- water_logs ----------
DROP POLICY IF EXISTS "water_logs_select_own" ON water_logs;
CREATE POLICY "water_logs_select_own" ON water_logs
    FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "water_logs_insert_own" ON water_logs;
CREATE POLICY "water_logs_insert_own" ON water_logs
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "water_logs_update_own" ON water_logs;
CREATE POLICY "water_logs_update_own" ON water_logs
    FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "water_logs_delete_own" ON water_logs;
CREATE POLICY "water_logs_delete_own" ON water_logs
    FOR DELETE USING ((SELECT auth.uid()) = user_id);

COMMIT;

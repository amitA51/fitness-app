-- ============================================================
-- SPARKOS FITNESS APP - Supabase Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- WORKOUT TEMPLATES
-- ============================================================
CREATE TABLE workout_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    exercises JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workout_templates_user_id ON workout_templates(user_id);
CREATE INDEX idx_workout_templates_created_at ON workout_templates(created_at DESC);

-- ============================================================
-- WORKOUT SESSIONS
-- ============================================================
CREATE TABLE workout_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration INTEGER DEFAULT 0,
    exercises JSONB DEFAULT '[]',
    total_volume DECIMAL(10, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX idx_workout_sessions_date ON workout_sessions(date DESC);
CREATE INDEX idx_workout_sessions_start_time ON workout_sessions(start_time DESC);

-- ============================================================
-- PERSONAL EXERCISES
-- ============================================================
CREATE TABLE personal_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    muscle_group TEXT,
    category TEXT DEFAULT 'strength',
    tempo TEXT,
    default_rest_time INTEGER DEFAULT 60,
    default_sets INTEGER DEFAULT 3,
    notes TEXT,
    tutorial_text TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    use_count INTEGER DEFAULT 0,
    last_used TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_personal_exercises_user_id ON personal_exercises(user_id);
CREATE INDEX idx_personal_exercises_name ON personal_exercises(name);
CREATE INDEX idx_personal_exercises_muscle_group ON personal_exercises(muscle_group);
CREATE INDEX idx_personal_exercises_last_used ON personal_exercises(last_used DESC NULLS LAST);
CREATE INDEX idx_personal_exercises_use_count ON personal_exercises(use_count DESC);

-- ============================================================
-- BODY WEIGHT
-- ============================================================
CREATE TABLE body_weight (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    weight DECIMAL(5, 2) NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_body_weight_user_id ON body_weight(user_id);
CREATE INDEX idx_body_weight_date ON body_weight(date DESC);

-- ============================================================
-- BODY MEASUREMENTS
-- ============================================================
CREATE TABLE body_measurements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    measurements JSONB DEFAULT '{}',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_body_measurements_user_id ON body_measurements(user_id);
CREATE INDEX idx_body_measurements_date ON body_measurements(date DESC);

-- ============================================================
-- PERSONAL RECORDS
-- ============================================================
CREATE TABLE personal_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exercise_id UUID REFERENCES personal_exercises(id) ON DELETE CASCADE,
    exercise_name TEXT NOT NULL,
    weight DECIMAL(10, 2) NOT NULL,
    reps INTEGER NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    record_type TEXT NOT NULL CHECK (record_type IN ('weight', '1rm', 'volume', 'reps')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_personal_records_user_id ON personal_records(user_id);
CREATE INDEX idx_personal_records_exercise_id ON personal_records(exercise_id);
CREATE INDEX idx_personal_records_date ON personal_records(date DESC);
-- Composite index to optimize per-user PR lookups for a specific exercise
CREATE INDEX IF NOT EXISTS idx_personal_records_user_exercise ON personal_records(user_id, exercise_id);

-- ============================================================
-- RECOVERY LOGS
-- ============================================================
CREATE TABLE recovery_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sleep_hours DECIMAL(3, 1),
    sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
    soreness_level INTEGER CHECK (soreness_level >= 1 AND soreness_level <= 5),
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
    stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 5),
    tight_areas JSONB DEFAULT '[]',
    overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
    session_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recovery_logs_user_id ON recovery_logs(user_id);
CREATE INDEX idx_recovery_logs_date ON recovery_logs(date DESC);

-- ============================================================
-- NUTRITION LOGS
-- ============================================================
CREATE TABLE nutrition_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    calories INTEGER,
    protein INTEGER,
    carbs INTEGER,
    fat INTEGER,
    meals JSONB DEFAULT '[]',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_nutrition_logs_user_id ON nutrition_logs(user_id);
CREATE INDEX idx_nutrition_logs_date ON nutrition_logs(date DESC);

-- ============================================================
-- USER SETTINGS
-- ============================================================
CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key)
);

CREATE INDEX idx_user_settings_user_id ON user_settings(user_id);

-- ============================================================
-- AI CONVERSATIONS
-- ============================================================
CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT,
    messages JSONB DEFAULT '[]',
    context JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_updated_at ON ai_conversations(updated_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE workout_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_weight ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only access their own data
CREATE POLICY "Users can view their own workout templates"
    ON workout_templates FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own workout templates"
    ON workout_templates FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own workout templates"
    ON workout_templates FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own workout templates"
    ON workout_templates FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view their own workout sessions"
    ON workout_sessions FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own workout sessions"
    ON workout_sessions FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own workout sessions"
    ON workout_sessions FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own workout sessions"
    ON workout_sessions FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view their own personal exercises"
    ON personal_exercises FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own personal exercises"
    ON personal_exercises FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own personal exercises"
    ON personal_exercises FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own personal exercises"
    ON personal_exercises FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view their own body weight"
    ON body_weight FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own body weight"
    ON body_weight FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own body weight"
    ON body_weight FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own body weight"
    ON body_weight FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view their own body measurements"
    ON body_measurements FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own body measurements"
    ON body_measurements FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own body measurements"
    ON body_measurements FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own body measurements"
    ON body_measurements FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view their own personal records"
    ON personal_records FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own personal records"
    ON personal_records FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own personal records"
    ON personal_records FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own personal records"
    ON personal_records FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view their own recovery logs"
    ON recovery_logs FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own recovery logs"
    ON recovery_logs FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own recovery logs"
    ON recovery_logs FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own recovery logs"
    ON recovery_logs FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view their own nutrition logs"
    ON nutrition_logs FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own nutrition logs"
    ON nutrition_logs FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own nutrition logs"
    ON nutrition_logs FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own nutrition logs"
    ON nutrition_logs FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view their own user settings"
    ON user_settings FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own user settings"
    ON user_settings FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own user settings"
    ON user_settings FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own user settings"
    ON user_settings FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view their own AI conversations"
    ON ai_conversations FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert their own AI conversations"
    ON ai_conversations FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update their own AI conversations"
    ON ai_conversations FOR UPDATE
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete their own AI conversations"
    ON ai_conversations FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_workout_templates_updated_at
    BEFORE UPDATE ON workout_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workout_sessions_updated_at
    BEFORE UPDATE ON workout_sessions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_personal_exercises_updated_at
    BEFORE UPDATE ON personal_exercises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_conversations_updated_at
    BEFORE UPDATE ON ai_conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- WATER LOGS (added 2026-05-18)
-- ============================================================
CREATE TABLE IF NOT EXISTS water_logs (
    id TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    amount_ml INTEGER NOT NULL CHECK (amount_ml >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS water_logs_user_date_idx ON water_logs (user_id, date);

ALTER TABLE water_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "water_logs_select_own" ON water_logs
    FOR SELECT USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "water_logs_insert_own" ON water_logs
    FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "water_logs_update_own" ON water_logs
    FOR UPDATE USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "water_logs_delete_own" ON water_logs
    FOR DELETE USING ((SELECT auth.uid()) = user_id);

CREATE TRIGGER update_water_logs_updated_at
    BEFORE UPDATE ON water_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- MIGRATION SNIPPET (run on existing deployments)
-- ============================================================
-- Run these if you deployed schema.sql before 2026-04-22:
--
-- ALTER TABLE personal_records
--   DROP CONSTRAINT IF EXISTS personal_records_record_type_check,
--   ADD CONSTRAINT personal_records_record_type_check
--   CHECK (record_type IN ('weight', '1rm', 'volume', 'reps'));
--
-- ALTER TABLE recovery_logs
--   ADD COLUMN IF NOT EXISTS stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 5),
--   ADD COLUMN IF NOT EXISTS tight_areas JSONB DEFAULT '[]',
--   ADD COLUMN IF NOT EXISTS overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
--   ADD COLUMN IF NOT EXISTS session_id TEXT;

-- ============================================================
-- COACH PLATFORM (added 2026-05-29)
-- See migrations/20260529000000_coach_platform.sql for the authoritative
-- definition (helpers, tables, RLS, triggers, seat enforcement, audit
-- columns, and cross-user coach access policies). The migration is
-- idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS)
-- and may be run directly on an existing deployment.
-- ============================================================

-- ============================================================
-- Composite indexes for hot read paths
-- ============================================================
--
-- Most reads filter by `user_id` and then order or filter by a date column.
-- Single-column indexes force the planner to do a second sort step; composite
-- indexes (user_id first, date DESC second) let the planner serve the query
-- directly from the index. Existing single-column indexes are intentionally
-- left in place — drop them only after verifying production query plans.

-- workout_sessions: covers user_id filter + start_time order
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_starttime
    ON workout_sessions (user_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_date
    ON workout_sessions (user_id, date DESC);

-- personal_records: PR timeline by date and lookup by exercise name
CREATE INDEX IF NOT EXISTS idx_personal_records_user_date
    ON personal_records (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_personal_records_user_exname
    ON personal_records (user_id, exercise_name);

-- recovery_logs
CREATE INDEX IF NOT EXISTS idx_recovery_logs_user_date
    ON recovery_logs (user_id, date DESC);

-- nutrition_logs
CREATE INDEX IF NOT EXISTS idx_nutrition_logs_user_date
    ON nutrition_logs (user_id, date DESC);

-- ai_conversations: most-recent ordering
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated
    ON ai_conversations (user_id, updated_at DESC);

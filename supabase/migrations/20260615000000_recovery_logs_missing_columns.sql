-- Fix live schema mismatch: client sends/reads these 4 columns but they were
-- never migrated (snippet sat commented-out in schema.sql). Without them every
-- recovery-log push fails (PGRST204), every pull is a partial failure (42703),
-- and delete-all-data aborts.
ALTER TABLE recovery_logs
  ADD COLUMN IF NOT EXISTS stress_level INTEGER CHECK (stress_level >= 1 AND stress_level <= 5),
  ADD COLUMN IF NOT EXISTS tight_areas JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  ADD COLUMN IF NOT EXISTS session_id TEXT;

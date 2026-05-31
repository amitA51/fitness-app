-- DA-2: Fix update_updated_at_column trigger to preserve client timestamps
-- when the client sends a newer value (LWW correctness for multi-device sync).
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.updated_at IS NULL OR NEW.updated_at <= OLD.updated_at THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- DA-6: Add updated_at column to the 5 tables that were missing it.
-- Each gets a default of NOW() and the corrected trigger from DA-2.

-- body_weight
ALTER TABLE body_weight
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE body_weight SET updated_at = created_at WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS update_body_weight_updated_at ON body_weight;
CREATE TRIGGER update_body_weight_updated_at
  BEFORE UPDATE ON body_weight
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- body_measurements
ALTER TABLE body_measurements
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE body_measurements SET updated_at = created_at WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS update_body_measurements_updated_at ON body_measurements;
CREATE TRIGGER update_body_measurements_updated_at
  BEFORE UPDATE ON body_measurements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- personal_records
ALTER TABLE personal_records
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE personal_records SET updated_at = created_at WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS update_personal_records_updated_at ON personal_records;
CREATE TRIGGER update_personal_records_updated_at
  BEFORE UPDATE ON personal_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- recovery_logs
ALTER TABLE recovery_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE recovery_logs SET updated_at = created_at WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS update_recovery_logs_updated_at ON recovery_logs;
CREATE TRIGGER update_recovery_logs_updated_at
  BEFORE UPDATE ON recovery_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- nutrition_logs
ALTER TABLE nutrition_logs
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE nutrition_logs SET updated_at = created_at WHERE updated_at IS NULL;

DROP TRIGGER IF EXISTS update_nutrition_logs_updated_at ON nutrition_logs;
CREATE TRIGGER update_nutrition_logs_updated_at
  BEFORE UPDATE ON nutrition_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

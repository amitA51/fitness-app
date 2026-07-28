-- ============================================================================
-- HOTFIX — `sync_lww_guard` broke every UPDATE on water_logs
-- ============================================================================
-- 20260726120000_sync_integrity.sql attaches `sync_lww_guard` to all eleven
-- multi-device tables. Its DO block is careful to ADD `deleted_at` when a table
-- is missing it, but it assumes `updated_at` already exists. `water_logs` was
-- created by 20260524115000_create_water_logs.sql WITHOUT `updated_at`
-- (id, user_id, date, amount_ml, created_at only), so the guard's very first
-- statement — `v_incoming timestamptz := NEW.updated_at` — raises
--
--     record "new" has no field "updated_at"
--
-- on every UPDATE. Verified against the live database: an `UPDATE water_logs
-- SET amount_ml = amount_ml` failed with exactly that message.
--
-- Blast radius while broken: the water upsert uses `onConflict: 'id'`, so any
-- re-log of an existing row takes the ON CONFLICT DO UPDATE branch and fails;
-- `deleteCloudWaterEntry` is a plain UPDATE stamping `deleted_at` and also
-- fails, so water deletions could not propagate at all. Both surface to the
-- client as a generic error and get retried forever by the offline queue.
--
-- Note this is not merely a water bug: the same latent trap applies to any
-- table added to the synced set later without `updated_at`. The DO block below
-- therefore backfills the column for EVERY synced table rather than special-
-- casing water_logs, so the guard's precondition is guaranteed by construction.
-- ============================================================================

DO $$
DECLARE
  t text;
  synced_tables text[] := ARRAY[
    'workout_templates',
    'workout_sessions',
    'personal_exercises',
    'personal_records',
    'body_weight',
    'body_measurements',
    'recovery_logs',
    'nutrition_logs',
    'ai_conversations',
    'user_settings',
    'water_logs'
  ];
BEGIN
  FOREACH t IN ARRAY synced_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = t
    ) THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at'
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN updated_at timestamptz DEFAULT now()', t
      );
      -- Seed from created_at so existing rows get a sane LWW baseline instead of
      -- NULL. A NULL stored timestamp would make the guard treat every incoming
      -- write as "same or missing" and re-stamp it, which is safe but loses the
      -- original ordering.
      EXECUTE format(
        'UPDATE public.%I SET updated_at = COALESCE(created_at, now()) WHERE updated_at IS NULL', t
      );
      RAISE NOTICE 'added updated_at to %', t;
    END IF;
  END LOOP;
END;
$$;

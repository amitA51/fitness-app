-- ============================================================================
-- sync_lww_guard behaviour test
-- ============================================================================
-- Verifies the four rules of the BEFORE UPDATE guard added in
-- 20260726120000_sync_integrity.sql, on a throwaway table with the same shape as
-- the synced tables. Self-contained: creates its own fixture, asserts with
-- ASSERT (which raises on failure), and rolls nothing back so the output is
-- readable.
--
-- Run against any Postgres 13+ :
--   psql -f supabase/tests/sync_lww_guard_test.sql
--
-- Expected final line: "sync_lww_guard: ALL ASSERTIONS PASSED".
-- ============================================================================

BEGIN;

CREATE TEMP TABLE guard_fixture (
  id         text PRIMARY KEY,
  payload    text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TRIGGER guard_fixture_sync_lww_guard
  BEFORE UPDATE ON guard_fixture
  FOR EACH ROW EXECUTE FUNCTION public.sync_lww_guard();

DO $$
DECLARE
  v_payload    text;
  v_updated    timestamptz;
  v_deleted    timestamptz;
  t_old        timestamptz := '2026-01-01 09:00:00+00';
  t_new        timestamptz := '2026-01-01 10:00:00+00';
BEGIN
  -- ── Rule 1: a stale write must be SKIPPED, not accepted-and-restamped ─────
  INSERT INTO guard_fixture (id, payload, updated_at)
  VALUES ('r1', 'device-B-10:00', t_new);

  -- Device A pushes its older 09:00 copy, exactly like a blind bulk upsert.
  UPDATE guard_fixture SET payload = 'device-A-09:00', updated_at = t_old WHERE id = 'r1';

  SELECT payload, updated_at INTO v_payload, v_updated FROM guard_fixture WHERE id = 'r1';
  ASSERT v_payload = 'device-B-10:00',
    format('stale write was applied: payload is %L', v_payload);
  ASSERT v_updated = t_new,
    format('stale write restamped updated_at to %L', v_updated);

  -- ── A genuinely newer write must still win ────────────────────────────────
  UPDATE guard_fixture
     SET payload = 'device-A-11:00', updated_at = '2026-01-01 11:00:00+00'
   WHERE id = 'r1';

  SELECT payload INTO v_payload FROM guard_fixture WHERE id = 'r1';
  ASSERT v_payload = 'device-A-11:00',
    format('newer write was rejected: payload is %L', v_payload);

  -- ── Rule 3: a tombstone applies even with a stale timestamp ───────────────
  UPDATE guard_fixture
     SET deleted_at = t_new, updated_at = t_old
   WHERE id = 'r1';

  SELECT deleted_at INTO v_deleted FROM guard_fixture WHERE id = 'r1';
  ASSERT v_deleted IS NOT NULL, 'tombstone with a stale timestamp was dropped';

  -- ── Rule 2: a tombstone can never be cleared by a sync write ─────────────
  UPDATE guard_fixture
     SET payload = 'resurrected', deleted_at = NULL,
         updated_at = '2026-01-02 12:00:00+00'
   WHERE id = 'r1';

  SELECT deleted_at INTO v_deleted FROM guard_fixture WHERE id = 'r1';
  ASSERT v_deleted IS NOT NULL, 'a sync write resurrected a deleted row';

  -- ── Rule 4: a forged future timestamp is clamped ─────────────────────────
  INSERT INTO guard_fixture (id, payload, updated_at)
  VALUES ('r2', 'live', now() - interval '1 hour');

  UPDATE guard_fixture
     SET payload = 'forged', updated_at = now() + interval '10 years'
   WHERE id = 'r2';

  SELECT updated_at INTO v_updated FROM guard_fixture WHERE id = 'r2';
  ASSERT v_updated <= now() + interval '6 minutes',
    format('forged future timestamp was not clamped: %L', v_updated);

  -- ── A write with no timestamp is accepted and stamped now() ──────────────
  UPDATE guard_fixture SET payload = 'no-ts', updated_at = NULL WHERE id = 'r2';
  SELECT payload, updated_at INTO v_payload, v_updated FROM guard_fixture WHERE id = 'r2';
  ASSERT v_payload = 'no-ts', 'write without a timestamp was dropped';
  ASSERT v_updated IS NOT NULL, 'updated_at left NULL';

  RAISE NOTICE 'sync_lww_guard: temp-table rules verified';
END;
$$;

-- ── The migration's own effects on the REAL synced tables ──────────────────
DO $$
DECLARE
  v_count   integer;
  v_name    text;
  v_user    uuid;
  v_payload text;
BEGIN
  -- Exactly ONE guard must be attached, and the legacy update_*_updated_at
  -- trigger must be GONE rather than joined by a second trigger that also fires.
  -- (workout_templates legitimately also carries trg_enforce_free_template_quota,
  -- a BEFORE INSERT trigger from the billing migration, so the count is scoped by
  -- trigger function rather than by table.)
  SELECT count(*) INTO v_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE NOT t.tgisinternal
    AND c.relname = 'workout_templates'
    AND p.proname = 'sync_lww_guard';
  ASSERT v_count = 1, format('expected 1 sync_lww_guard trigger, found %s', v_count);

  SELECT count(*) INTO v_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE NOT t.tgisinternal
    AND c.relname = 'workout_templates'
    AND p.proname = 'update_updated_at_column';
  ASSERT v_count = 0,
    format('the legacy update_updated_at_column trigger is still attached (%s)', v_count);

  SELECT t.tgname INTO v_name
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_proc p ON p.oid = t.tgfoid
  WHERE NOT t.tgisinternal
    AND c.relname = 'workout_templates'
    AND p.proname = 'sync_lww_guard';
  ASSERT v_name = 'workout_templates_sync_lww_guard', format('unexpected trigger name %L', v_name);

  -- The missing tombstone column and its sparse index must have been added.
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'water_logs' AND column_name = 'deleted_at'
  ), 'deleted_at was not added to water_logs';
  ASSERT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_water_logs_deleted'
  ), 'idx_water_logs_deleted was not created';

  -- End-to-end: the exact shape of the client's blind bulk upsert must not be
  -- able to overwrite a newer cloud row.
  INSERT INTO auth.users (email) VALUES ('sync@example.com') RETURNING id INTO v_user;

  INSERT INTO public.workout_templates (id, user_id, name, updated_at)
  VALUES (
    '11111111-1111-1111-1111-111111111111', v_user,
    'device-B-10:00', '2026-01-01 10:00:00+00'
  );

  INSERT INTO public.workout_templates (id, user_id, name, updated_at)
  VALUES (
    '11111111-1111-1111-1111-111111111111', v_user,
    'device-A-09:00', '2026-01-01 09:00:00+00'
  )
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = EXCLUDED.updated_at;

  SELECT name INTO v_payload FROM public.workout_templates
  WHERE id = '11111111-1111-1111-1111-111111111111';
  ASSERT v_payload = 'device-B-10:00',
    format('a stale bulk upsert overwrote the newer cloud row with %L', v_payload);

  RAISE NOTICE 'sync_lww_guard: ALL ASSERTIONS PASSED';
END;
$$;

ROLLBACK;

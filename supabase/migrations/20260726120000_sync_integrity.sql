-- ============================================================================
-- SYNC INTEGRITY — optimistic concurrency + tombstone preservation
-- ============================================================================
-- The problem this fixes, precisely:
--
-- `update_updated_at_column()` (20260531160000) contains
--
--     IF NEW.updated_at IS NULL OR NEW.updated_at <= OLD.updated_at THEN
--       NEW.updated_at = now();
--     END IF;
--
-- which means a STALE write is accepted and then stamped as the newest version.
-- Concretely: device B edits a template at 10:00. Device A has been offline
-- holding the 09:00 copy and runs a full sync. `batchUpsert` (in
-- supabaseSyncOrchestrator) issues a blind `upsert`, the ON CONFLICT UPDATE
-- branch overwrites B's content with A's 09:00 content, and the trigger sets
-- `updated_at = now()`. Every future pull now treats the OLDER content as the
-- newest, so B's edit is unrecoverable. The client-side merge in cloudMerge.ts
-- cannot help: by the time it runs, the newer version no longer exists.
--
-- The fix is enforced in the database rather than the client, because the client
-- is exactly the component we cannot trust to be up to date:
--
--   1. A row write whose `updated_at` is OLDER than the stored row is SKIPPED
--      (BEFORE UPDATE ... RETURN NULL). Returning NULL drops just that row, so a
--      50-row bulk upsert still applies its other 49 rows and PostgREST reports
--      no error — a stale device simply loses the race instead of winning it.
--   2. A tombstone can never be cleared by a sync write. `deleted_at` going from
--      NOT NULL back to NULL is treated as "the client didn't know" and the
--      stored tombstone is restored.
--   3. Setting a tombstone is always allowed, even when `updated_at` looks stale,
--      because a delete must win over an in-flight edit of the same row.
--   4. The forged-future clamp from 20260531160000 is preserved.
--
-- Scope: only the user-owned, multi-device-synced tables. Coach/community tables
-- keep `update_updated_at_column()`, since they are written through a single
-- authoritative path rather than merged from many devices.
-- ============================================================================

-- Note: `water_logs` is part of the sync set but never got a tombstone column, so
-- its deletions could not propagate at all. It is added by the DO block below
-- rather than with a standalone ALTER, because 20260529000000_coach_platform.sql
-- already documents that water_logs may be absent from some deployments — an
-- unguarded ALTER would abort this whole migration there.

CREATE OR REPLACE FUNCTION public.sync_lww_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_incoming timestamptz := NEW.updated_at;
  v_stored   timestamptz := OLD.updated_at;
BEGIN
  -- (2) Never resurrect. A payload that omits or nulls deleted_at is treated as
  -- "this client has not seen the deletion", not as an undelete.
  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    NEW.deleted_at := OLD.deleted_at;
  END IF;

  -- (3) A new tombstone always applies: a user's delete outranks a concurrent
  -- edit of the same record, regardless of timestamps.
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    NEW.updated_at := LEAST(COALESCE(v_incoming, now()), now() + interval '5 minutes');
    IF NEW.updated_at <= v_stored THEN
      NEW.updated_at := now();
    END IF;
    RETURN NEW;
  END IF;

  -- (1) Optimistic concurrency. Silently drop a write that is demonstrably older
  -- than what is already stored.
  IF v_incoming IS NOT NULL AND v_stored IS NOT NULL AND v_incoming < v_stored THEN
    RETURN NULL;
  END IF;

  -- Same-or-missing timestamp: accept and stamp, as before.
  IF v_incoming IS NULL OR v_incoming <= v_stored THEN
    NEW.updated_at := now();
  END IF;

  -- (4) Forged-future clamp, unchanged in behaviour.
  NEW.updated_at := LEAST(COALESCE(NEW.updated_at, now()), now() + interval '5 minutes');
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_lww_guard() IS
  'BEFORE UPDATE guard for multi-device synced tables: drops stale writes (RETURN NULL), preserves tombstones, clamps forged future timestamps.';

-- Attach to every user-owned synced table. DO block so a deployment that is
-- missing one of these tables does not abort the whole migration.
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
      RAISE NOTICE 'sync_lww_guard: skipping missing table %', t;
      CONTINUE;
    END IF;

    -- Every one of these must have deleted_at for the guard to reference it.
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'deleted_at'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN deleted_at timestamptz DEFAULT NULL', t);
      RAISE NOTICE 'sync_lww_guard: added deleted_at to %', t;
    END IF;

    -- Sparse index matching the pattern in 20260531140000_tombstones.sql. Only
    -- created when the table is user-scoped, which every synced table is.
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'user_id'
    ) THEN
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS idx_%s_deleted ON public.%I (user_id, deleted_at)
           WHERE deleted_at IS NOT NULL',
        t, t
      );
    END IF;

    -- Replace the generic updated_at trigger with the guard. Both names are
    -- dropped so re-running the migration is safe and no double-firing occurs.
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS %s_sync_lww_guard ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER %s_sync_lww_guard BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.sync_lww_guard()',
      t, t
    );
  END LOOP;
END;
$$;

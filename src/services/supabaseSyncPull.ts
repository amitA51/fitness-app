/**
 * Supabase Pull
 * SPARKOS Fitness App - cloud -> local: the full/incremental pull, its per-table
 * cursors, targeted row pulls, and the template-ready check for workout starts.
 *
 * Split out of supabaseSyncOrchestrator.ts (which re-exports everything here) to
 * keep both files under the size cap. The per-table fetchers it composes live in
 * ./supabaseSync, ./supabaseMiscSync and ./waterService.
 */

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/withTimeout';
import { emitTemplatesChanged } from './dataEvents';
import { normalizeLegacyLocalIds } from './idNormalization';
import { STORES } from './indexedDBCore';
import { serverNowIso } from './serverClock';
import { getCurrentUser } from './supabaseAuth';
import {
  fetchAIConversations,
  fetchBodyMeasurements,
  fetchBodyWeight,
  fetchNutritionLogs,
  fetchPersonalExercises,
  fetchPersonalRecords,
  fetchRecoveryLogs,
  fetchUserSettings,
  fetchWorkoutSessions,
  fetchWorkoutTemplates,
} from './supabaseSync';
import {
  type AIConversation,
  type BodyMeasurement,
  type BodyWeightEntry,
  type NutritionLog,
  type PersonalExercise,
  type PersonalRecordRow,
  type RecoveryLog,
  type UserSetting,
  type WorkoutSession,
  type WorkoutTemplate,
  toCanonicalBodyMeasurement,
  toCanonicalBodyWeight,
  toCanonicalNutritionLog,
  toCanonicalPersonalExercise,
  toCanonicalSession,
  toCanonicalTemplate,
} from './supabaseSyncMappers';
// Type-only: erased at runtime, so the orchestrator's `export *` of this module
// does not become an import cycle.
import type { FullSyncCounts, SyncResult } from './supabaseSyncOrchestrator';
import { type PullFilter, withPullFilters } from './supabaseSyncPagination';
import { BUSY, SYNC_LOCK_BUSY_ERROR, withSyncLock } from './syncLock';
import {
  getWorkoutTemplate,
  mergeAIConversationsFromCloud,
  mergeBodyMeasurementsFromCloud,
  mergeBodyWeightFromCloud,
  mergeNutritionLogsFromCloud,
  mergePersonalExercisesFromCloud,
  mergePersonalRecordsFromCloud,
  mergeRecoveryLogsFromCloud,
  mergeUserSettingsFromCloud,
  mergeWorkoutSessionsFromCloud,
  mergeWorkoutTemplatesFromCloud,
} from './workoutDb';

const getUserId = async (): Promise<string | null> => {
  const user = await getCurrentUser();
  return user?.id || null;
};

/** Uniform result when the sync lock is taken: not a failure, just deferred. */
const LOCK_BUSY_RESULT: SyncResult = {
  success: false,
  error: SYNC_LOCK_BUSY_ERROR,
};

// Re-entrancy guard, keyed BY USER ID (see the note on the push guard in the
// orchestrator): a different identity always starts its own pass. `full` records
// whether the running pass reads every table, so a forced full pull is never
// answered by an incremental one.
let pullAllInFlight: { userId: string; full: boolean; promise: Promise<SyncResult> } | null = null;

// ==================== PULL POLICY ====================
//
// WHAT A PULL ASKS FOR, TABLE BY TABLE (incremental pulls, 2026-10-22).
//
// A pull used to fetch the FULL history of all eleven tables, 1000 rows a page,
// on every sign-in event and again on every AppShell mount — most of the load
// on a small database. Each table now remembers (per user, see "Pull cursors")
// when it was last pulled successfully, and asks only for rows whose
// `updated_at` is later than that minus INCREMENTAL_LOOKBACK_MS.
//
// That is correct ONLY because of three properties, checked against the merges
// and the migrations:
//
//  1. Every merge is non-destructive and per-row — sessionDb, templateDb,
//     cloudMerge.mergeGenericRecords (body weight, measurements, PRs, recovery,
//     nutrition, settings, exercises), mergeAIConversationsFromCloud and
//     waterService.mergeWaterLogsFromCloud. A row missing from the answer is
//     left alone; a full pull never removed anything by absence either, so a
//     smaller answer loses nothing.
//  2. Deletions on these tables are SOFT (an UPDATE of `deleted_at`), and the
//     server guard `sync_lww_guard` (20260726120000_sync_integrity.sql) stamps
//     `updated_at = now()` on a new tombstone. A deletion is therefore always "a
//     row changed after the cursor", and reaches the tombstone-aware merge — no
//     resurrection.
//  3. Inserts and edits keep the WRITER's `updated_at` (skew-corrected by
//     serverClock) — there is no insert trigger to restamp it. A write that
//     reaches the server late — queued during an outage, or on a phone that was
//     offline for days, and replayed with its original timestamp — can land
//     BEHIND another device's cursor. INCREMENTAL_LOOKBACK_MS re-reads a week
//     to cover that, and the daily full pull catches anything older. The row is
//     safe in the cloud either way; the window only bounds how long ANOTHER
//     device takes to show it.
//
// `user_settings` stays on full pulls: its cloud delete (deleteCloudUserSetting)
// is a HARD delete, the table is a handful of rows, and the restores that run
// after the merge (program progress, mirrored local keys) read it whole.
//
// Full pulls still happen per table: with no cursor (first pull on this device,
// a new account, or after a sign-out wiped local data — the cursors live in the
// same IndexedDB and are wiped with it), when the table's local store is empty,
// once a day, and whenever a caller asks (`pullAllData({ full: true })`).

/** How often each table is re-read in full, to catch writes that landed behind a cursor. */
const FULL_PULL_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * How far before the last successful pull an incremental pull starts reading.
 * Covers device clock skew and, mainly, writes made offline or queued during an
 * outage that are replayed later with their original `updated_at`. It was six
 * hours, so a workout logged on a phone that came back online the next day was
 * invisible on other devices until their daily full pull. Every table here is
 * one user's rows, so a week of them is still a small answer; the merges are
 * idempotent.
 */
const INCREMENTAL_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

/** A cursor further ahead of the server clock than this came from a wrong device clock. */
const CURSOR_FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

/** Every cloud table a pull reads. The name is also the `fetchAllPages` label. */
export type PulledTableName =
  | 'workout_templates'
  | 'workout_sessions'
  | 'personal_exercises'
  | 'body_weight'
  | 'body_measurements'
  | 'personal_records'
  | 'recovery_logs'
  | 'nutrition_logs'
  | 'user_settings'
  | 'ai_conversations'
  | 'water_logs';

/** One cloud table as the pull sees it (row types erased; see `pullTable`). */
interface PullTable {
  table: PulledTableName;
  /** Local IndexedDB store the rows merge into. */
  store: string;
  /** Name used in logs and in `SyncResult.error` ("fetch failed: templates"). */
  label: string;
  countKey: keyof FullSyncCounts | null;
  /** Whether rows may be asked for by `updated_at` — see the policy above. */
  incremental: boolean;
  fetch: (userId: string) => Promise<unknown[]>;
  merge: (rows: unknown[]) => Promise<unknown>;
}

interface PullTableSpec<T> extends Omit<PullTable, 'fetch' | 'merge'> {
  fetch: (userId: string) => Promise<T[]>;
  merge: (rows: T[]) => Promise<unknown>;
}

/** Erase a table's row type so all eleven fit one list, keeping each fetch/merge pair typed. */
const pullTable = <T>(spec: PullTableSpec<T>): PullTable => ({
  ...spec,
  merge: (rows) => spec.merge(rows as T[]),
});

/**
 * The eleven tables. waterService is loaded first so its fetcher can be STARTED
 * synchronously inside `withPullFilters` like the others.
 */
const loadPullTables = async (): Promise<readonly PullTable[]> => {
  const water = await import('./waterService');
  return [
    pullTable<WorkoutTemplate>({
      table: 'workout_templates',
      store: STORES.WORKOUT_TEMPLATES,
      label: 'templates',
      countKey: 'templates',
      incremental: true,
      fetch: fetchWorkoutTemplates,
      merge: (rows) => mergeWorkoutTemplatesFromCloud(rows.map(toCanonicalTemplate)),
    }),
    pullTable<WorkoutSession>({
      table: 'workout_sessions',
      store: STORES.WORKOUT_SESSIONS,
      label: 'sessions',
      countKey: 'sessions',
      incremental: true,
      fetch: fetchWorkoutSessions,
      merge: (rows) => mergeWorkoutSessionsFromCloud(rows.map(toCanonicalSession)),
    }),
    pullTable<PersonalExercise>({
      table: 'personal_exercises',
      store: STORES.PERSONAL_EXERCISES,
      label: 'exercises',
      countKey: 'exercises',
      incremental: true,
      fetch: fetchPersonalExercises,
      merge: (rows) => mergePersonalExercisesFromCloud(rows.map(toCanonicalPersonalExercise)),
    }),
    pullTable<BodyWeightEntry>({
      table: 'body_weight',
      store: STORES.BODY_WEIGHT,
      label: 'bodyWeight',
      countKey: 'bodyWeight',
      incremental: true,
      fetch: fetchBodyWeight,
      merge: (rows) => mergeBodyWeightFromCloud(rows.map(toCanonicalBodyWeight)),
    }),
    pullTable<BodyMeasurement>({
      table: 'body_measurements',
      store: STORES.BODY_MEASUREMENTS,
      label: 'bodyMeasurements',
      countKey: 'bodyMeasurements',
      incremental: true,
      fetch: fetchBodyMeasurements,
      merge: (rows) => mergeBodyMeasurementsFromCloud(rows.map(toCanonicalBodyMeasurement)),
    }),
    pullTable<PersonalRecordRow>({
      table: 'personal_records',
      store: STORES.PERSONAL_RECORDS,
      label: 'personalRecords',
      countKey: 'personalRecords',
      incremental: true,
      fetch: fetchPersonalRecords,
      merge: (rows) => mergePersonalRecordsFromCloud(rows),
    }),
    pullTable<RecoveryLog>({
      table: 'recovery_logs',
      store: STORES.RECOVERY_LOGS,
      label: 'recoveryLogs',
      countKey: 'recoveryLogs',
      incremental: true,
      fetch: fetchRecoveryLogs,
      merge: (rows) => mergeRecoveryLogsFromCloud(rows),
    }),
    pullTable<NutritionLog>({
      table: 'nutrition_logs',
      store: STORES.NUTRITION_LOGS,
      label: 'nutritionLogs',
      countKey: 'nutritionLogs',
      incremental: true,
      fetch: fetchNutritionLogs,
      merge: (rows) => mergeNutritionLogsFromCloud(rows.map(toCanonicalNutritionLog)),
    }),
    pullTable<UserSetting>({
      table: 'user_settings',
      store: STORES.USER_SETTINGS,
      label: 'userSettings',
      countKey: 'userSettings',
      // Hard deletes — see the policy above.
      incremental: false,
      fetch: fetchUserSettings,
      merge: (rows) => mergeUserSettingsFromCloud(rows),
    }),
    pullTable<AIConversation>({
      table: 'ai_conversations',
      store: STORES.AI_CONVERSATIONS,
      label: 'aiConversations',
      countKey: 'aiConversations',
      incremental: true,
      fetch: fetchAIConversations,
      merge: (rows) => mergeAIConversationsFromCloud(rows),
    }),
    pullTable<Awaited<ReturnType<typeof water.fetchWaterLogs>>[number]>({
      table: 'water_logs',
      store: STORES.WATER_LOGS,
      label: 'waterLogs',
      countKey: null,
      incremental: true,
      fetch: water.fetchWaterLogs,
      merge: water.mergeWaterLogsFromCloud,
    }),
  ];
};

/**
 * Call `fetch` NOW — never through `.then` — so it starts inside the caller's
 * `withPullFilters` window. A synchronous throw becomes a rejection.
 */
const startFetch = (spec: PullTable, userId: string): Promise<unknown[]> => {
  try {
    return spec.fetch(userId);
  } catch (err) {
    return Promise.reject(err);
  }
};

// ── Pull cursors ────────────────────────────────────────────────────────────
//
// Kept in the `pending_sync` IndexedDB store, next to the data they describe, on
// purpose: every wipe of local data (sign-out, account switch, expiry, "delete my
// data") clears every store in STORES, so the cursors go WITH the rows and an
// incremental pull can never run against a store that was emptied under it. A
// localStorage key would survive the wipe. The unsynced ledger that shares the
// store (sessionDb) ignores tags it does not own.

const PULL_CURSOR_TAG_PREFIX = 'pull-cursor:';

interface TableCursor {
  /** Server-clock start of the last successful pull of this table. */
  since: string;
  /** Server-clock start of the last successful FULL pull of this table. */
  fullAt: string;
}

interface PullCursorRow {
  tag: string;
  userId: string;
  tables: Partial<Record<PulledTableName, TableCursor>>;
  /** Start of the last pull in which every table was fetched and merged. */
  lastSuccessAt?: string;
  createdAt: string;
  /** Keeps the store's `retryCount` index well-formed, like the ledger rows. */
  retryCount: number;
}

const readPullCursors = async (userId: string): Promise<PullCursorRow | null> => {
  try {
    const { dbGet } = await import('./indexedDBCore');
    const row = await dbGet<PullCursorRow | undefined>(
      STORES.PENDING_SYNC,
      `${PULL_CURSOR_TAG_PREFIX}${userId}`
    );
    return row && row.userId === userId && row.tables ? row : null;
  } catch (err) {
    logger.sync.warn('Could not read the pull cursors; pulling in full', err);
    return null;
  }
};

const writePullCursors = async (row: PullCursorRow): Promise<void> => {
  try {
    const { dbPut } = await import('./indexedDBCore');
    await dbPut(STORES.PENDING_SYNC, row);
  } catch (err) {
    logger.sync.warn('Could not save the pull cursors; the next pull repeats this one', err);
  }
};

/**
 * Rows per local store, or null where the count failed (then nothing is
 * forced). An EMPTY store always gets a full pull, whatever the cursor says —
 * the last line of defence against a cursor that outlived its rows.
 */
const countLocalRows = async (stores: readonly string[]): Promise<Array<number | null>> => {
  try {
    const { initDB } = await import('./indexedDBCore');
    const db = await initDB();
    return await Promise.all(
      stores.map(
        (store) =>
          new Promise<number | null>((resolve) => {
            try {
              const request = db.transaction(store, 'readonly').objectStore(store).count();
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => resolve(null);
            } catch {
              resolve(null);
            }
          })
      )
    );
  } catch {
    return stores.map(() => null);
  }
};

/** The filter for one table's pull, or null for a full pull. */
const planTable = (
  spec: PullTable,
  cursor: TableCursor | undefined,
  nowMs: number,
  forceFull: boolean,
  localRows: number | null
): PullFilter | null => {
  if (forceFull || !spec.incremental || !cursor || localRows === 0) return null;
  const since = Date.parse(cursor.since);
  const fullAt = Date.parse(cursor.fullAt);
  if (!Number.isFinite(since) || !Number.isFinite(fullAt)) return null;
  if (nowMs - fullAt >= FULL_PULL_INTERVAL_MS) return null;
  if (since > nowMs + CURSOR_FUTURE_TOLERANCE_MS) return null;
  return { updatedAfter: new Date(since - INCREMENTAL_LOOKBACK_MS).toISOString() };
};

// ── pullAllData ─────────────────────────────────────────────────────────────

export interface PullOptions {
  /** Ignore the cursors and read every table in full (an explicit "pull from cloud"). */
  full?: boolean;
}

/**
 * A pull that finds the sync lock taken (another tab, or this tab's own queue
 * replay — Web Locks are per origin) is retried ONCE after this delay instead of
 * being dropped. Once: if the lock is still busy, the next routine trigger runs.
 */
const BUSY_RETRY_DELAY_MS = 5_000;
let busyRetryTimer: ReturnType<typeof setTimeout> | null = null;
let busyRetryFull = false;

/** When each user's last pull attempt started (this page load). See pullAllDataIfStale. */
const lastPullAttemptAt = new Map<string, number>();

const scheduleBusyRetry = (full: boolean): void => {
  busyRetryFull = busyRetryFull || full;
  if (busyRetryTimer) return;
  busyRetryTimer = setTimeout(() => {
    const retryFull = busyRetryFull;
    busyRetryTimer = null;
    busyRetryFull = false;
    runPull({ full: retryFull }, true).catch((err) => {
      logger.sync.warn('Retried pull failed', err);
    });
  }, BUSY_RETRY_DELAY_MS);
};

const runPull = async (options: PullOptions, isBusyRetry: boolean): Promise<SyncResult> => {
  const full = options.full === true;
  // Identity BEFORE coalescing: across an account change the incoming user must
  // never receive the outgoing user's in-flight pull.
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };

  const inFlight = pullAllInFlight;
  if (inFlight?.userId === userId) {
    if (inFlight.full || !full) return inFlight.promise;
    // A full pull must not be answered by an incremental one already running.
    await inFlight.promise.catch(() => undefined);
    return runPull(options, isBusyRetry);
  }

  lastPullAttemptAt.set(userId, Date.now());
  // Merges must not interleave with another tab's push of the same stores.
  const promise = withSyncLock(() => pullAllDataImpl(userId, full)).then((outcome) => {
    if (outcome === BUSY) {
      if (isBusyRetry) {
        logger.sync.info('Sync lock still busy; leaving the pull to the next trigger');
      } else {
        logger.sync.info('Sync lock busy; retrying the pull shortly');
        scheduleBusyRetry(full);
      }
      return LOCK_BUSY_RESULT;
    }
    return outcome;
  });
  pullAllInFlight = { userId, full, promise };
  let result: SyncResult;
  try {
    result = await promise;
  } finally {
    if (pullAllInFlight?.promise === promise) pullAllInFlight = null;
  }
  // The server answered every table: release writes only an outage held back,
  // then hand it the workouts that are on the unsynced ledger but in no queue.
  if (result.success) {
    import('./offlineQueue')
      .then(async (queue) => {
        await queue.retryOutageDelayedNow();
        await queue.drainUnsyncedLedger();
      })
      .catch((err) => logger.sync.warn('Could not resume writes after a pull', err));
  }
  return result;
};

/**
 * Pull the cloud into the local store — incrementally where that is safe (see
 * the policy at the top of this section), in full with `{ full: true }`.
 */
export const pullAllData = (options: PullOptions = {}): Promise<SyncResult> =>
  runPull(options, false);

/** How long a successful pull keeps the local store fresh enough for routine triggers. */
export const PULL_FRESH_FOR_MS = 15 * 60 * 1000;

/** Minimum gap between routine attempts, so an outage is not met with a pull per foreground. */
const PULL_ATTEMPT_GAP_MS = 2 * 60 * 1000;

/**
 * The pull for ROUTINE triggers (app shell mount, return to the foreground,
 * sign-in events): skipped when the last fully successful pull for this user is
 * younger than `maxAgeMs`, or when an attempt started in the last two minutes.
 * An explicit user action should call `pullAllData` instead.
 */
export const pullAllDataIfStale = async (maxAgeMs = PULL_FRESH_FOR_MS): Promise<SyncResult> => {
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };

  // Share a pull already running rather than skipping it, so the caller can
  // react when it lands.
  const inFlight = pullAllInFlight;
  if (inFlight?.userId === userId) return inFlight.promise;

  const cursors = await readPullCursors(userId);
  const lastSuccess = cursors?.lastSuccessAt ? Date.parse(cursors.lastSuccessAt) : Number.NaN;
  const age = Date.parse(serverNowIso()) - lastSuccess;
  if (Number.isFinite(age) && age >= 0 && age < maxAgeMs) {
    return { success: true, skipped: true, syncedItems: 0 };
  }

  const lastAttempt = lastPullAttemptAt.get(userId);
  if (lastAttempt !== undefined && Date.now() - lastAttempt < PULL_ATTEMPT_GAP_MS) {
    return { success: false, skipped: true, error: 'pull_attempted_recently' };
  }

  return pullAllData();
};

const pullAllDataImpl = async (userId: string, forceFull: boolean): Promise<SyncResult> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  // Same one-time legacy-id repair as the push path — pull is the first sync
  // entry point on sign-in (AuthContext auto-pull), so this guarantees the
  // pass runs before any later push. Never throws (logs inside).
  await normalizeLegacyLocalIds();

  try {
    const tables = await loadPullTables();
    // Server-clock time, read BEFORE any fetch: a row written while the fetches
    // run has `updated_at` after this and is read again next time.
    const startedAt = serverNowIso();
    const nowMs = Date.parse(startedAt);
    const cursors = await readPullCursors(userId);
    const localRows = await countLocalRows(tables.map((spec) => spec.store));

    const filters = new Map<string, PullFilter>();
    tables.forEach((spec, i) => {
      const filter = planTable(
        spec,
        cursors?.tables[spec.table],
        nowMs,
        forceFull,
        localRows[i] ?? null
      );
      if (filter) filters.set(spec.table, filter);
    });

    // Fetch each table independently: a single failed fetch must not discard
    // the tables that succeeded (DA fix #2). Fetch funcs throw on a real error,
    // so a rejected result is a genuine failure — distinct from an empty
    // (successful) one.
    const fetchResults = await Promise.allSettled(
      withPullFilters(filters, () => tables.map((spec) => startFetch(spec, userId)))
    );

    const failedStores: string[] = [];
    fetchResults.forEach((result, i) => {
      const spec = tables[i];
      if (result.status === 'rejected' && spec) {
        failedStores.push(spec.label);
        logger.sync.error(`Fetch failed for ${spec.label} during pull`, result.reason);
      }
    });

    // Identity re-check, immediately before anything touches local storage: if
    // the account changed while the fetches were in flight, the wipe has already
    // run and merging would write the PREVIOUS user's rows into the new store.
    const stillCurrentUser = await getUserId();
    if (stillCurrentUser !== userId) {
      logger.sync.warn('Identity changed during pull; discarding fetched rows without merging', {
        startedAs: userId,
        nowIs: stillCurrentUser,
      });
      return { success: false, error: 'identity_changed_during_pull' };
    }

    // Merge each table independently: one failed merge must not discard the
    // others. A table whose fetch failed merges nothing — and is NOT success.
    const mergeResults = await Promise.allSettled(
      tables.map((spec, i) => {
        const fetched = fetchResults[i];
        return fetched?.status === 'fulfilled' ? spec.merge(fetched.value) : Promise.resolve(null);
      })
    );
    const mergeFailed = mergeResults.filter((r) => r.status === 'rejected');
    if (mergeFailed.length) {
      logger.sync.error(
        `${mergeFailed.length} merge operations failed during pull`,
        mergeFailed.map((f) => (f as PromiseRejectedResult).reason)
      );
    }

    const counts: FullSyncCounts = {
      templates: 0,
      sessions: 0,
      exercises: 0,
      bodyWeight: 0,
      bodyMeasurements: 0,
      personalRecords: 0,
      recoveryLogs: 0,
      nutritionLogs: 0,
      userSettings: 0,
      aiConversations: 0,
    };
    const nextCursors: Partial<Record<PulledTableName, TableCursor>> = {
      ...(cursors?.tables ?? {}),
    };
    let everyTableLanded = true;
    tables.forEach((spec, i) => {
      const fetched = fetchResults[i];
      const landed = fetched?.status === 'fulfilled' && mergeResults[i]?.status === 'fulfilled';
      if (spec.countKey && fetched?.status === 'fulfilled') {
        counts[spec.countKey] = fetched.value.length;
      }
      if (!landed) {
        // The cursor stays where it was, so the next pull asks for these rows again.
        everyTableLanded = false;
        return;
      }
      const previous = nextCursors[spec.table];
      const wasFull = !filters.has(spec.table) || !previous;
      nextCursors[spec.table] = { since: startedAt, fullAt: wasFull ? startedAt : previous.fullAt };
    });

    // Only advance the cursors for the identity the rows were merged for.
    if ((await getUserId()) === userId) {
      await writePullCursors({
        tag: `${PULL_CURSOR_TAG_PREFIX}${userId}`,
        userId,
        tables: nextCursors,
        lastSuccessAt: everyTableLanded ? startedAt : cursors?.lastSuccessAt,
        createdAt: cursors?.createdAt ?? startedAt,
        retryCount: 0,
      });
    }

    // The 12-week program keeps its pointer in localStorage, which sign-out and
    // expiry wipe. Rehydrate it from the merged user_settings store (LWW, so a
    // newer local copy wins) — otherwise the trainee restarts at week 1.
    // Best-effort: it must not downgrade an otherwise successful pull.
    try {
      const { restoreProgramProgressFromCloud } = await import('./programProgressService');
      if (await restoreProgramProgressFromCloud()) {
        logger.sync.info('Restored program progress from the cloud');
      }
    } catch (err) {
      logger.sync.warn('Could not restore program progress from the cloud', err);
    }

    // Same for the other localStorage-only state an account switch destroys
    // (body profile, workout prefs, nutrition goals, app settings). See ./localStateMirror.
    try {
      const { restoreMirroredLocalKeys } = await import('./localStateMirror');
      const restoredKeys = await restoreMirroredLocalKeys();
      if (restoredKeys.length > 0) {
        logger.sync.info('Restored mirrored local settings from the cloud', { restoredKeys });
      }
    } catch (err) {
      logger.sync.warn('Could not restore mirrored local settings', err);
    }

    const totalItems = Object.values(counts).reduce((sum, count) => sum + count, 0);

    logger.sync.info('Pulled data from cloud and saved to IndexedDB', {
      userId,
      counts,
      incremental: [...filters.keys()],
    });

    // A partial pull (any fetch or merge failure) is NOT a success — reporting
    // it as such let callers believe the local store mirrors the cloud.
    const errorParts: string[] = [];
    if (failedStores.length > 0) {
      errorParts.push(`fetch failed: ${failedStores.join(', ')}`);
    }
    if (mergeFailed.length > 0) {
      errorParts.push(`${mergeFailed.length} merge operations failed`);
    }

    return {
      success: failedStores.length === 0 && mergeFailed.length === 0,
      syncedItems: totalItems,
      counts,
      ...(errorParts.length > 0 && { error: errorParts.join('; ') }),
    };
  } catch (error) {
    logger.sync.error('Error pulling all data', error);
    return { success: false, error: String(error) };
  }
};

// ==================== TARGETED PULLS ====================

/** Ids per request in a targeted pull — keeps the URL far below server limits. */
const TARGETED_PULL_CHUNK = 100;

/**
 * Pull and merge only some rows of one table: `ids` when known (a realtime
 * event names the row that changed), otherwise the rows changed since the
 * table's cursor (a full table when there is none). Does not take the sync lock
 * and does not move the cursors — it is a narrow catch-up, not a pull. Returns
 * how many rows arrived; throws when the fetch fails.
 */
export const pullTableRows = async (
  table: PulledTableName,
  ids?: readonly string[]
): Promise<number> => {
  if (!isSupabaseConfigured() || !supabase) return 0;
  const userId = await getUserId();
  if (!userId) return 0;
  const spec = (await loadPullTables()).find((candidate) => candidate.table === table);
  if (!spec) return 0;

  const wanted = [...new Set((ids ?? []).filter((id) => typeof id === 'string' && id))];
  let rows: unknown[];
  if (wanted.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < wanted.length; i += TARGETED_PULL_CHUNK) {
      chunks.push(wanted.slice(i, i + TARGETED_PULL_CHUNK));
    }
    const pages = await Promise.all(
      chunks.map((chunk) =>
        withPullFilters(new Map([[table, { ids: chunk }]]), () => startFetch(spec, userId))
      )
    );
    rows = pages.flat();
  } else {
    const [cursors, [localRows]] = await Promise.all([
      readPullCursors(userId),
      countLocalRows([spec.store]),
    ]);
    const filter = planTable(
      spec,
      cursors?.tables[table],
      Date.parse(serverNowIso()),
      false,
      localRows ?? null
    );
    rows = await (filter
      ? withPullFilters(new Map([[table, filter]]), () => startFetch(spec, userId))
      : startFetch(spec, userId));
  }

  if ((await getUserId()) !== userId) {
    logger.sync.warn('Identity changed during a targeted pull; discarding rows', { table });
    return 0;
  }
  await spec.merge(rows);
  return rows.length;
};

/** How long "start" waits for a coach-assigned template that is not on this device yet. */
export const TEMPLATE_START_WAIT_MS = 8_000;

const isUsableTemplate = (template: WorkoutTemplate | null): template is WorkoutTemplate =>
  Boolean(template && !(template as { deletedAt?: string | null }).deletedAt);

/**
 * Make a coach-assigned template ready for a workout start.
 *
 * Already on this device → resolves at once with 'local', and the coach's
 * latest version is fetched in the background for next time. Starting used to
 * wait for a full fetch of every template first, so on a slow server the
 * button spun for up to the whole request timeout.
 *
 * Not on this device → ONE targeted fetch of that template, capped at
 * `waitMs`; resolves 'fetched' once it is stored locally, rejects otherwise so
 * the caller can show an error with a retry.
 */
export const prepareTemplateForStart = async (
  templateId: string,
  waitMs: number = TEMPLATE_START_WAIT_MS
): Promise<'local' | 'fetched'> => {
  if (!templateId) throw new Error('A template id is required to start a workout');

  const local = await getWorkoutTemplate(templateId).catch(() => null);
  if (isUsableTemplate(local)) {
    pullTableRows('workout_templates', [templateId])
      .then((arrived) => {
        if (arrived > 0) emitTemplatesChanged();
      })
      .catch((err) => {
        logger.sync.warn('Background refresh of the assigned template failed', err);
      });
    return 'local';
  }

  await withTimeout(
    pullTableRows('workout_templates', [templateId]),
    waitMs,
    'assigned template fetch'
  );
  const fetched = await getWorkoutTemplate(templateId);
  if (!isUsableTemplate(fetched)) {
    throw new Error('The assigned template is not available in the cloud');
  }
  emitTemplatesChanged();
  return 'fetched';
};

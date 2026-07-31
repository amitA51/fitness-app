/**
 * Supabase Full-Sync Orchestration
 * SPARKOS Fitness App - push/pull of the entire local store to/from the cloud.
 *
 * Extracted from supabaseSync.ts to keep that module focused on per-record CRUD.
 * The per-record fetch helpers it composes live in ./supabaseSync.
 */

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { normalizeLegacyLocalIds } from './idNormalization';
import { STORES } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import {
  toBodyWeightRow,
  toConversationRow,
  toExerciseRow,
  toMeasurementRow,
  toNutritionRow,
  toPersonalRecordRow,
  toRecoveryRow,
  toSessionRow,
  toSettingRow,
  toTemplateRow,
  toWaterRow,
} from './supabaseRowMappers';
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
import { BUSY, withSyncLock } from './syncLock';
import {
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

// ==================== FULL SYNC ====================

export interface SyncResult {
  success: boolean;
  error?: string;
  syncedItems?: number;
  /** Records that failed to push (a rejected upsert batch). >0 means silent data loss was avoided. */
  failedItems?: number;
  counts?: {
    templates?: number;
    sessions?: number;
    exercises?: number;
    bodyWeight?: number;
    bodyMeasurements?: number;
    personalRecords?: number;
    recoveryLogs?: number;
    nutritionLogs?: number;
    userSettings?: number;
    aiConversations?: number;
  };
}

export interface FullSyncCounts {
  templates: number;
  sessions: number;
  exercises: number;
  bodyWeight: number;
  bodyMeasurements: number;
  personalRecords: number;
  recoveryLogs: number;
  nutritionLogs: number;
  userSettings: number;
  aiConversations: number;
}

// Re-entrancy guards: concurrent calls coalesce onto the in-flight promise.
// These are per-tab; cross-tab exclusion comes from withSyncLock below. Two tabs
// running blind bulk upserts at the same time would let network timing decide the
// last-write-wins outcome.
//
// The guards are keyed BY USER ID. They used to be bare promises, which made
// coalescing unsound across an account change: sign in as A, start a pull, switch
// to B before it resolves, and B's auto-pull received A's in-flight promise. B
// therefore never pulled its own data, and A's response merged into the store
// AFTER the wipe. Keying means a different identity always starts its own pass.
let syncAllInFlight: { userId: string; promise: Promise<SyncResult> } | null = null;
let pullAllInFlight: { userId: string; promise: Promise<SyncResult> } | null = null;

/** Uniform result when another tab owns the sync lock: not a failure, just deferred. */
const LOCK_BUSY_RESULT: SyncResult = {
  success: false,
  error: 'sync_in_progress_in_another_tab',
};

export const syncAllData = async (): Promise<SyncResult> => {
  // Resolve the identity BEFORE coalescing, so the guard can tell one account's
  // in-flight pass from another's.
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };

  if (syncAllInFlight?.userId === userId) return syncAllInFlight.promise;

  const promise = withSyncLock(() => syncAllDataImpl(userId)).then((outcome) => {
    if (outcome === BUSY) {
      logger.sync.info('Another tab is syncing, skipping full push');
      return LOCK_BUSY_RESULT;
    }
    return outcome;
  });
  syncAllInFlight = { userId, promise };
  try {
    return await promise;
  } finally {
    // Only clear if we are still the current holder — a newer pass for another
    // identity must not be cancelled by ours finishing.
    if (syncAllInFlight?.promise === promise) syncAllInFlight = null;
  }
};

const syncAllDataImpl = async (userId: string): Promise<SyncResult> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  // One-time legacy-id repair BEFORE reading the stores: records minted with
  // prefixed ids (session_<ts>, meal-…, bw-…, …) can never pass the cloud's
  // uuid columns — every push 400s (22P02) forever. Never throws (logs inside).
  await normalizeLegacyLocalIds();

  try {
    const { dbGetAll } = await import('./indexedDBCore');

    // Read each local store independently: one failed read must not abort the
    // entire push. A failed read yields an empty array HERE so the other stores
    // still upload, but it is recorded in `readFailed` and downgrades the final
    // result to a failure — an unreadable store must never look like a backup.
    const readResults = await Promise.allSettled([
      dbGetAll<WorkoutTemplate>(STORES.WORKOUT_TEMPLATES),
      dbGetAll<WorkoutSession>(STORES.WORKOUT_SESSIONS),
      dbGetAll<PersonalExercise>(STORES.PERSONAL_EXERCISES),
      dbGetAll<BodyWeightEntry>(STORES.BODY_WEIGHT),
      dbGetAll<BodyMeasurement>(STORES.BODY_MEASUREMENTS),
      dbGetAll<PersonalRecordRow>(STORES.PERSONAL_RECORDS),
      dbGetAll<RecoveryLog>(STORES.RECOVERY_LOGS),
      dbGetAll<NutritionLog>(STORES.NUTRITION_LOGS),
      dbGetAll<UserSetting>(STORES.USER_SETTINGS),
      dbGetAll<AIConversation>(STORES.AI_CONVERSATIONS),
      dbGetAll<{ id: string; date: string; amountMl: number; createdAt: string }>(
        STORES.WATER_LOGS
      ),
    ]);
    const readFailed = readResults.filter((r) => r.status === 'rejected');
    if (readFailed.length) {
      logger.sync.error(
        `${readFailed.length} local store reads failed during push`,
        readFailed.map((f) => (f as PromiseRejectedResult).reason)
      );
    }
    const unwrapRead = <T>(r: PromiseSettledResult<unknown> | undefined): T[] =>
      r && r.status === 'fulfilled' ? (r.value as T[]) : [];

    /**
     * Drop locally-tombstoned rows from the bulk push.
     *
     * The bulk mappers deliberately omit `deleted_at` (see the note below), so a
     * row that is deleted locally but whose deletion has not yet reached the
     * cloud would be pushed as if it were still LIVE — and with a fresh
     * `updated_at`, since the tombstone bumps it. Deletions travel through the
     * offline queue's `*:delete` mutations, which stamp `deleted_at` explicitly;
     * the bulk push must simply leave them alone.
     */
    const liveOnly = <T>(rows: T[]): T[] =>
      rows.filter((row) => !(row as { deletedAt?: string | null }).deletedAt);

    // Exclude the internal program-day scratch template (fixed non-UUID id,
    // isProgramHidden): pushing it burns a row every sync, conflicts LWW on a
    // fixed id, and — since WORKOUT_TEMPLATES ids are NOT uuid-normalized — a
    // uuid id column would 22P02-reject the whole 50-row batch, blocking the
    // user's real templates. It is regenerated on demand by startProgramDay.
    const localTemplates = liveOnly(
      unwrapRead<WorkoutTemplate>(readResults[0]).filter((t) => !t.isProgramHidden)
    );
    const localSessions = liveOnly(unwrapRead<WorkoutSession>(readResults[1]));
    const localExercises = liveOnly(unwrapRead<PersonalExercise>(readResults[2]));
    const localBodyWeight = liveOnly(unwrapRead<BodyWeightEntry>(readResults[3]));
    const localBodyMeasurements = liveOnly(unwrapRead<BodyMeasurement>(readResults[4]));
    const localPersonalRecords = liveOnly(unwrapRead<PersonalRecordRow>(readResults[5]));
    const localRecoveryLogs = liveOnly(unwrapRead<RecoveryLog>(readResults[6]));
    const localNutritionLogs = liveOnly(unwrapRead<NutritionLog>(readResults[7]));
    const localUserSettings = unwrapRead<UserSetting>(readResults[8]);
    const localAIConversations = unwrapRead<AIConversation>(readResults[9]);
    const localWaterLogs = unwrapRead<{
      id: string;
      date: string;
      amountMl: number;
      createdAt: string;
    }>(readResults[10]);

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

    // DA-5: Batch upserts in groups of 50 with concurrency limit of 3
    const BATCH_SIZE = 50;
    const CONCURRENCY = 3;

    async function batchUpsert<T>(
      table: string,
      items: T[],
      mapFn: (item: T) => Record<string, unknown>,
      onConflict?: string
    ): Promise<{ synced: number; failed: number }> {
      let synced = 0;
      let failed = 0;
      const batches: T[][] = [];
      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        batches.push(items.slice(i, i + BATCH_SIZE));
      }
      // Process batches with concurrency limiter
      for (let i = 0; i < batches.length; i += CONCURRENCY) {
        const chunk = batches.slice(i, i + CONCURRENCY);
        const results = await Promise.allSettled(
          chunk.map(async (batch) => {
            const rows = batch.map(mapFn);
            const opts = onConflict ? { onConflict } : undefined;
            const { error } = await supabase!.from(table).upsert(rows, opts);
            if (error) throw error;
            return batch.length;
          })
        );
        // A rejected batch is silent data loss: those records never reached the
        // cloud. Count them and log each rejection so the push failure surfaces
        // instead of being swallowed (the count rides up into SyncResult below).
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled') {
            synced += r.value;
          } else {
            const lost = chunk[idx]?.length ?? 0;
            failed += lost;
            logger.sync.error(
              `batchUpsert ${table}: batch failed, ${lost} record(s) not pushed`,
              r.reason
            );
          }
        });
      }
      return { synced, failed };
    }

    // Records lost to a rejected upsert batch, accumulated across all tables.
    // A non-zero total means the push was partial — never report it as success.
    let failedItems = 0;
    const pushResults = await Promise.allSettled([
      // NOTE: deleted_at is intentionally OMITTED from every bulk-push mapper.
      // Verified empirically against this project's PostgREST (2026-06-09): a
      // partial upsert does NOT null omitted columns on the ON CONFLICT UPDATE
      // branch — it leaves them untouched, so omitting deleted_at PRESERVES a
      // remote tombstone. Local records never carry a deletedAt (the cloud
      // merges hard-delete tombstoned rows), so sending `deleted_at: x.deletedAt
      // ?? null` would always send null and CLEAR remote tombstones on a blind
      // push — resurrecting records that were deleted on another device. Omission
      // is the correct, safe behavior. (CODE-AUDIT-2026-06-08 item #1 mis-modeled
      // the upsert semantics; do not "fix" this by adding deleted_at here.)
      // Every mapper below is the SAME function the immediate/queue path uses
      // (./supabaseRowMappers). They used to be separate inline copies, and three
      // of them had silently drifted onto fields that do not exist on the
      // canonical IndexedDB record — personal_records read `recordType` instead
      // of `type` and NOT-NULL-killed whole 50-row chunks, body_measurements read
      // a nested `measurements` off a flat row and sent NULL, nutrition_logs read
      // flat macros instead of `totalMacros` and overwrote correct cloud values
      // with NULL. Sharing the mapper is what stops that recurring.
      batchUpsert('workout_templates', localTemplates, (t) => toTemplateRow(userId, t)).then(
        (res) => {
          counts.templates = res.synced;
          failedItems += res.failed;
        }
      ),

      batchUpsert('workout_sessions', localSessions, (s) => toSessionRow(userId, s)).then((res) => {
        counts.sessions = res.synced;
        failedItems += res.failed;
      }),

      batchUpsert('personal_exercises', localExercises, (e) => toExerciseRow(userId, e)).then(
        (res) => {
          counts.exercises = res.synced;
          failedItems += res.failed;
        }
      ),

      batchUpsert('body_weight', localBodyWeight, (b) => toBodyWeightRow(userId, b)).then((res) => {
        counts.bodyWeight = res.synced;
        failedItems += res.failed;
      }),

      batchUpsert('body_measurements', localBodyMeasurements, (m) =>
        toMeasurementRow(userId, m)
      ).then((res) => {
        counts.bodyMeasurements = res.synced;
        failedItems += res.failed;
      }),

      batchUpsert('personal_records', localPersonalRecords, (r) =>
        toPersonalRecordRow(userId, r)
      ).then((res) => {
        counts.personalRecords = res.synced;
        failedItems += res.failed;
      }),

      batchUpsert('recovery_logs', localRecoveryLogs, (l) => toRecoveryRow(userId, l)).then(
        (res) => {
          counts.recoveryLogs = res.synced;
          failedItems += res.failed;
        }
      ),

      batchUpsert('nutrition_logs', localNutritionLogs, (l) => toNutritionRow(userId, l)).then(
        (res) => {
          counts.nutritionLogs = res.synced;
          failedItems += res.failed;
        }
      ),

      batchUpsert(
        'user_settings',
        localUserSettings,
        (s) => toSettingRow(userId, s),
        'user_id,key'
      ).then((res) => {
        counts.userSettings = res.synced;
        failedItems += res.failed;
      }),

      batchUpsert('ai_conversations', localAIConversations, (c) =>
        toConversationRow(userId, c)
      ).then((res) => {
        counts.aiConversations = res.synced;
        failedItems += res.failed;
      }),

      batchUpsert('water_logs', localWaterLogs, (w) => toWaterRow(userId, w), 'id').then((res) => {
        failedItems += res.failed;
      }),
    ]);

    const pushFailed = pushResults.filter((r) => r.status === 'rejected');
    if (pushFailed.length) {
      logger.sync.error(
        `${pushFailed.length} push operations failed`,
        pushFailed.map((f) => (f as PromiseRejectedResult).reason)
      );
    }

    const totalSynced = Object.values(counts).reduce((sum, count) => sum + count, 0);

    logger.sync.info('Pushed all data to cloud', { userId, counts, failedItems });

    // A partial push (operation rejected OR any batch lost records OR a local
    // store we could not even read) is NOT a success — reporting it as such
    // would let callers believe the cloud mirrors local state when records were
    // silently dropped or never read.
    const pushErrorParts: string[] = [];
    if (pushFailed.length > 0) {
      pushErrorParts.push(`${pushFailed.length} push operations failed`);
    }
    if (failedItems > 0) {
      pushErrorParts.push(`${failedItems} record(s) failed to push`);
    }
    // Previously a rejected dbGetAll() was silently substituted with an empty
    // array, so a store that failed to read (quota, corruption, blocked upgrade)
    // pushed nothing and the sync still returned success: the user was told
    // their data was backed up when an entire store had been skipped.
    if (readFailed.length > 0) {
      pushErrorParts.push(`${readFailed.length} local store(s) could not be read`);
    }

    return {
      success: pushFailed.length === 0 && failedItems === 0 && readFailed.length === 0,
      syncedItems: totalSynced,
      failedItems,
      counts,
      ...(pushErrorParts.length > 0 && { error: pushErrorParts.join('; ') }),
    };
  } catch (error) {
    logger.sync.error('Error syncing all data', error);
    return { success: false, error: String(error) };
  }
};

export const pullAllData = async (): Promise<SyncResult> => {
  // Identity is resolved BEFORE coalescing. Sharing an un-keyed promise across an
  // account change meant the incoming user received the outgoing user's pull:
  // they never fetched their own data, and the old response merged in after the
  // wipe had already run.
  const userId = await getUserId();
  if (!userId) return { success: false, error: 'Not authenticated' };

  if (pullAllInFlight?.userId === userId) return pullAllInFlight.promise;

  // Pull merges cloud rows into IndexedDB, so it must not interleave with another
  // tab's push of the same stores.
  const promise = withSyncLock(() => pullAllDataImpl(userId)).then((outcome) => {
    if (outcome === BUSY) {
      logger.sync.info('Another tab is syncing, skipping pull');
      return LOCK_BUSY_RESULT;
    }
    return outcome;
  });
  pullAllInFlight = { userId, promise };
  try {
    return await promise;
  } finally {
    if (pullAllInFlight?.promise === promise) pullAllInFlight = null;
  }
};

const pullAllDataImpl = async (userId: string): Promise<SyncResult> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  // Same one-time legacy-id repair as the push path — pull is the first sync
  // entry point on sign-in (AuthContext auto-pull), so this guarantees the
  // pass runs before any later push. Never throws (logs inside).
  await normalizeLegacyLocalIds();

  try {
    // Fetch each store independently: a single failed fetch must not discard
    // the stores that succeeded (DA fix #2). Fetch funcs now throw on a real
    // error, so a rejected result means a genuine failure — distinct from an
    // empty (but successful) result.
    const fetchSpecs = [
      { store: 'templates', run: () => fetchWorkoutTemplates(userId) },
      { store: 'sessions', run: () => fetchWorkoutSessions(userId) },
      { store: 'exercises', run: () => fetchPersonalExercises(userId) },
      { store: 'bodyWeight', run: () => fetchBodyWeight(userId) },
      { store: 'bodyMeasurements', run: () => fetchBodyMeasurements(userId) },
      { store: 'personalRecords', run: () => fetchPersonalRecords(userId) },
      { store: 'recoveryLogs', run: () => fetchRecoveryLogs(userId) },
      { store: 'nutritionLogs', run: () => fetchNutritionLogs(userId) },
      { store: 'userSettings', run: () => fetchUserSettings(userId) },
      { store: 'aiConversations', run: () => fetchAIConversations(userId) },
      {
        store: 'waterLogs',
        run: () => import('./waterService').then((m) => m.fetchWaterLogs(userId)),
      },
    ] as const;

    const fetchResults = await Promise.allSettled(fetchSpecs.map((spec) => spec.run()));

    const failedStores: string[] = [];
    fetchResults.forEach((result, i) => {
      if (result.status === 'rejected') {
        const spec = fetchSpecs[i];
        if (spec) {
          failedStores.push(spec.store);
          logger.sync.error(`Fetch failed for ${spec.store} during pull`, result.reason);
        }
      }
    });

    const pickResult = <T>(i: number): T[] => {
      const r = fetchResults[i];
      return r && r.status === 'fulfilled' ? (r.value as T[]) : [];
    };
    const templates = pickResult<WorkoutTemplate>(0);
    const sessions = pickResult<WorkoutSession>(1);
    const exercises = pickResult<PersonalExercise>(2);
    const bodyWeight = pickResult<BodyWeightEntry>(3);
    const bodyMeasurements = pickResult<BodyMeasurement>(4);
    const personalRecords = pickResult<PersonalRecordRow>(5);
    const recoveryLogs = pickResult<RecoveryLog>(6);
    const nutritionLogs = pickResult<NutritionLog>(7);
    const userSettings = pickResult<UserSetting>(8);
    const aiConversations = pickResult<AIConversation>(9);
    const waterLogs = pickResult<{
      id: string;
      date: string;
      amountMl: number;
      createdAt: string;
    }>(10);

    // Identity re-check, immediately before anything touches local storage.
    //
    // The fetches above are network round-trips. If the account changed while
    // they were in flight — sign-out, account switch, expiry — then the wipe has
    // already run and merging these rows would write the PREVIOUS user's data
    // back into a store that is now supposed to belong to someone else. Keying
    // the in-flight promise stops the wrong caller from receiving this pull; this
    // check stops the pull itself from writing after the ground moved.
    const stillCurrentUser = await getUserId();
    if (stillCurrentUser !== userId) {
      logger.sync.warn('Identity changed during pull; discarding fetched rows without merging', {
        startedAs: userId,
        nowIs: stillCurrentUser,
      });
      return { success: false, error: 'identity_changed_during_pull' };
    }

    // Merge each store independently: one failed merge must not discard the
    // others (they have already been fetched from the cloud). A store whose
    // fetch failed yields an empty array above, so nothing is merged for it —
    // crucially we do NOT treat that as success.
    const mergeResults = await Promise.allSettled([
      mergeWorkoutTemplatesFromCloud(templates.map(toCanonicalTemplate)),
      mergeWorkoutSessionsFromCloud(sessions.map(toCanonicalSession)),
      mergePersonalExercisesFromCloud(exercises.map(toCanonicalPersonalExercise)),
      mergeBodyWeightFromCloud(bodyWeight.map(toCanonicalBodyWeight)),
      mergeBodyMeasurementsFromCloud(bodyMeasurements.map(toCanonicalBodyMeasurement)),
      mergePersonalRecordsFromCloud(personalRecords),
      mergeRecoveryLogsFromCloud(recoveryLogs),
      mergeNutritionLogsFromCloud(nutritionLogs.map(toCanonicalNutritionLog)),
      mergeUserSettingsFromCloud(userSettings),
      mergeAIConversationsFromCloud(aiConversations),
      import('./waterService').then((m) => m.mergeWaterLogsFromCloud(waterLogs)),
    ]);
    const mergeFailed = mergeResults.filter((r) => r.status === 'rejected');
    if (mergeFailed.length) {
      logger.sync.error(
        `${mergeFailed.length} merge operations failed during pull`,
        mergeFailed.map((f) => (f as PromiseRejectedResult).reason)
      );
    }

    const counts = {
      templates: templates.length,
      sessions: sessions.length,
      exercises: exercises.length,
      bodyWeight: bodyWeight.length,
      bodyMeasurements: bodyMeasurements.length,
      personalRecords: personalRecords.length,
      recoveryLogs: recoveryLogs.length,
      nutritionLogs: nutritionLogs.length,
      userSettings: userSettings.length,
      aiConversations: aiConversations.length,
    };

    // The 12-week program keeps its pointer in localStorage, which sign-out and
    // session-expiry both wipe (USER_SCOPED_STORAGE_REGISTRY). Now that the
    // cloud copy has been merged into the user_settings store, rehydrate it —
    // otherwise the trainee is silently restarted at week 1. Last-write-wins, so
    // a newer local copy is preserved. Best-effort: a failure here must not
    // downgrade an otherwise successful pull.
    try {
      const { restoreProgramProgressFromCloud } = await import('./programProgressService');
      if (await restoreProgramProgressFromCloud()) {
        logger.sync.info('Restored program progress from the cloud');
      }
    } catch (err) {
      logger.sync.warn('Could not restore program progress from the cloud', err);
    }

    // Same treatment for the other localStorage-only state that an account switch
    // destroys: body profile (drives TDEE and every macro target), workout
    // preferences, nutrition goals, app settings. See ./localStateMirror.
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

// ==================== CONNECTION TEST ====================

export const testConnection = async (): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const { error } = await supabase.from('workout_templates').select('id').limit(1);
    if (error) {
      logger.sync.error('Connection test failed', error);
      return false;
    }
    logger.sync.info('Supabase connection successful');
    return true;
  } catch (error) {
    logger.sync.error('Connection test error', error);
    return false;
  }
};

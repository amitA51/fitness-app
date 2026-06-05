/**
 * Supabase Full-Sync Orchestration
 * SPARKOS Fitness App - push/pull of the entire local store to/from the cloud.
 *
 * Extracted from supabaseSync.ts to keep that module focused on per-record CRUD.
 * The per-record fetch helpers it composes live in ./supabaseSync.
 */

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { STORES } from './indexedDBCore';
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
let syncAllInFlight: Promise<SyncResult> | null = null;
let pullAllInFlight: Promise<SyncResult> | null = null;

export const syncAllData = async (): Promise<SyncResult> => {
  if (syncAllInFlight) return syncAllInFlight;
  syncAllInFlight = syncAllDataImpl();
  try {
    return await syncAllInFlight;
  } finally {
    syncAllInFlight = null;
  }
};

const syncAllDataImpl = async (): Promise<SyncResult> => {
  const userId = await getUserId();
  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { dbGetAll } = await import('./indexedDBCore');

    // Read each local store independently: one failed read must not abort the
    // entire push. Failed reads default to an empty array (nothing to push).
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
    const localTemplates = unwrapRead<WorkoutTemplate>(readResults[0]);
    const localSessions = unwrapRead<WorkoutSession>(readResults[1]);
    const localExercises = unwrapRead<PersonalExercise>(readResults[2]);
    const localBodyWeight = unwrapRead<BodyWeightEntry>(readResults[3]);
    const localBodyMeasurements = unwrapRead<BodyMeasurement>(readResults[4]);
    const localPersonalRecords = unwrapRead<PersonalRecordRow>(readResults[5]);
    const localRecoveryLogs = unwrapRead<RecoveryLog>(readResults[6]);
    const localNutritionLogs = unwrapRead<NutritionLog>(readResults[7]);
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
    ): Promise<number> {
      let synced = 0;
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
        for (const r of results) {
          if (r.status === 'fulfilled') synced += r.value;
        }
      }
      return synced;
    }

    const pushResults = await Promise.allSettled([
      batchUpsert('workout_templates', localTemplates, (t) => ({
        id: t.id,
        user_id: userId,
        name: t.name,
        description: t.description || null,
        exercises: t.exercises,
        created_at: t.createdAt || new Date().toISOString(),
        updated_at: t.updatedAt || new Date().toISOString(),
      })).then((n) => {
        counts.templates = n;
      }),

      batchUpsert('workout_sessions', localSessions, (s) => ({
        id: s.id,
        user_id: userId,
        title: s.title || null,
        date: s.date || new Date().toISOString(),
        start_time: s.startTime,
        end_time: s.endTime || null,
        duration: s.duration || 0,
        exercises: s.exercises,
        total_volume: s.totalVolume || 0,
        notes: s.notes || null,
        created_at: s.startTime,
        updated_at: s.updatedAt || s.startTime || new Date().toISOString(),
      })).then((n) => {
        counts.sessions = n;
      }),

      batchUpsert('personal_exercises', localExercises, (e) => ({
        id: e.id,
        user_id: userId,
        name: e.name,
        muscle_group: e.muscleGroup || null,
        category: e.category || 'strength',
        tempo: e.tempo || null,
        default_rest_time: e.defaultRestTime || 60,
        default_sets: e.defaultSets || 3,
        notes: e.notes || null,
        tutorial_text: e.tutorialText || null,
        is_favorite: e.isFavorite || false,
        use_count: e.useCount || 0,
        last_used: e.lastUsed || null,
        created_at: e.createdAt || new Date().toISOString(),
        updated_at: e.updatedAt || e.createdAt || new Date().toISOString(),
      })).then((n) => {
        counts.exercises = n;
      }),

      batchUpsert('body_weight', localBodyWeight, (b) => ({
        id: b.id,
        user_id: userId,
        weight: b.weight,
        date: b.date,
        created_at: b.createdAt ?? new Date().toISOString(),
        updated_at: b.updatedAt ?? b.createdAt ?? new Date().toISOString(),
      })).then((n) => {
        counts.bodyWeight = n;
      }),

      batchUpsert('body_measurements', localBodyMeasurements, (m) => ({
        id: m.id,
        user_id: userId,
        date: m.date,
        measurements: m.measurements,
        notes: m.notes || null,
        created_at: m.createdAt || new Date().toISOString(),
        updated_at: m.updatedAt ?? m.createdAt ?? new Date().toISOString(),
      })).then((n) => {
        counts.bodyMeasurements = n;
      }),

      batchUpsert('personal_records', localPersonalRecords, (r) => ({
        id: r.id,
        user_id: userId,
        exercise_id: r.exerciseId,
        exercise_name: r.exerciseName,
        weight: r.weight,
        reps: r.reps,
        date: r.date,
        record_type: r.recordType,
        created_at: r.createdAt || new Date().toISOString(),
        updated_at: r.updatedAt ?? r.createdAt ?? new Date().toISOString(),
      })).then((n) => {
        counts.personalRecords = n;
      }),

      batchUpsert('recovery_logs', localRecoveryLogs, (l) => ({
        id: l.id,
        user_id: userId,
        date: l.date,
        sleep_hours: l.sleepHours ?? null,
        sleep_quality: l.sleepQuality ?? null,
        soreness_level: l.sorenessLevel ?? null,
        energy_level: l.energyLevel ?? null,
        stress_level: l.stressLevel ?? null,
        tight_areas: l.tightAreas ?? [],
        overall_score: l.overallScore ?? null,
        session_id: l.sessionId ?? null,
        notes: l.notes || null,
        created_at: l.createdAt || new Date().toISOString(),
        updated_at: l.updatedAt ?? l.createdAt ?? new Date().toISOString(),
      })).then((n) => {
        counts.recoveryLogs = n;
      }),

      batchUpsert('nutrition_logs', localNutritionLogs, (l) => ({
        id: l.id,
        user_id: userId,
        date: l.date,
        calories: l.calories || null,
        protein: l.protein || null,
        carbs: l.carbs || null,
        fat: l.fat || null,
        meals: l.meals,
        notes: l.notes || null,
        created_at: l.createdAt || new Date().toISOString(),
        updated_at: l.updatedAt ?? l.createdAt ?? new Date().toISOString(),
      })).then((n) => {
        counts.nutritionLogs = n;
      }),

      batchUpsert(
        'user_settings',
        localUserSettings,
        (s) => ({
          id: s.id || `${userId}:${s.key}`,
          user_id: userId,
          key: s.key,
          value: s.value,
          created_at: s.createdAt || new Date().toISOString(),
          updated_at: s.updatedAt || new Date().toISOString(),
        }),
        'user_id,key'
      ).then((n) => {
        counts.userSettings = n;
      }),

      batchUpsert('ai_conversations', localAIConversations, (c) => ({
        id: c.id,
        user_id: userId,
        title: c.title || null,
        messages: c.messages,
        context: c.context || {},
        created_at: c.createdAt || new Date().toISOString(),
        updated_at: c.updatedAt || c.createdAt || new Date().toISOString(),
      })).then((n) => {
        counts.aiConversations = n;
      }),

      batchUpsert(
        'water_logs',
        localWaterLogs,
        (w) => ({
          id: w.id,
          user_id: userId,
          date: w.date,
          amount_ml: w.amountMl,
          created_at: w.createdAt,
        }),
        'id'
      ).then(() => {}),
    ]);

    const pushFailed = pushResults.filter((r) => r.status === 'rejected');
    if (pushFailed.length) {
      logger.sync.error(
        `${pushFailed.length} push operations failed`,
        pushFailed.map((f) => (f as PromiseRejectedResult).reason)
      );
    }

    const totalSynced = Object.values(counts).reduce((sum, count) => sum + count, 0);

    logger.sync.info('Pushed all data to cloud', { userId, counts });

    return {
      success: pushFailed.length === 0,
      syncedItems: totalSynced,
      counts,
      ...(pushFailed.length > 0 && { error: `${pushFailed.length} push operations failed` }),
    };
  } catch (error) {
    logger.sync.error('Error syncing all data', error);
    return { success: false, error: String(error) };
  }
};

export const pullAllData = async (): Promise<SyncResult> => {
  if (pullAllInFlight) return pullAllInFlight;
  pullAllInFlight = pullAllDataImpl();
  try {
    return await pullAllInFlight;
  } finally {
    pullAllInFlight = null;
  }
};

const pullAllDataImpl = async (): Promise<SyncResult> => {
  const userId = await getUserId();
  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  if (!isSupabaseConfigured() || !supabase) {
    return { success: false, error: 'Supabase not configured' };
  }

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

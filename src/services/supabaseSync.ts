/**
 * Supabase Sync Service
 * SPARKOS Fitness App - Cloud Sync with Supabase
 */

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import {
  toBodyWeightRow,
  toExerciseRow,
  toMeasurementRow,
  toNutritionRow,
  toPersonalRecordRow,
  toRecoveryRow,
  toSessionRow,
  toTemplateRow,
} from './supabaseRowMappers';
import type {
  BodyMeasurement,
  BodyWeightEntry,
  NutritionLog,
  PersonalExercise,
  PersonalRecordRow,
  RecoveryLog,
  WorkoutSession,
  WorkoutTemplate,
} from './supabaseSyncMappers';
import { fetchAllPages } from './supabaseSyncPagination';

// Row interfaces and row->canonical mappers live in ./supabaseSyncMappers.
// The range-pagination helper (fetchAllPages) lives in ./supabaseSyncPagination.
//
// The local->cloud row shape for every table lives in ./supabaseRowMappers and is
// shared with the bulk push in supabaseSyncOrchestrator. That sharing is the point:
// the two paths used to hold separate copies of the same mapping and drifted, which
// silently corrupted personal_records, body_measurements and nutrition_logs.

// ==================== WORKOUT TEMPLATES ====================

export const syncWorkoutTemplate = async (
  userId: string,
  template: WorkoutTemplate
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('workout_templates')
    .upsert(toTemplateRow(userId, template));

  if (error) {
    logger.sync.error('Error syncing workout template', error);
    throw error;
  }
};

export const fetchWorkoutTemplates = async (userId: string): Promise<WorkoutTemplate[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const data = await fetchAllPages('workout_templates', (from, to) =>
    supabase!
      .from('workout_templates')
      .select(
        'id, name, description, exercises, last_used, times_used, is_favorite, muscle_groups, is_builtin, created_at, updated_at, deleted_at'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    exercises: row.exercises,
    // Recovered by 20260728150000. `isBuiltin` matters most: without it
    // dataService.initializeData() cannot tell built-ins apart and re-seeds
    // them, so a restore produced duplicate standard templates.
    lastUsed: row.last_used ?? null,
    timesUsed: row.times_used ?? 0,
    isFavorite: row.is_favorite ?? false,
    muscleGroups: row.muscle_groups ?? undefined,
    isBuiltin: row.is_builtin ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

/**
 * Soft-delete a cloud workout template by stamping `deleted_at`.
 *
 * This used to be a hard `.delete()`, which made deletions non-convergent: once
 * the row was physically gone the cloud had no record that it had ever been
 * deleted, so any device still holding a live copy re-inserted it on its next
 * full push and the user's deletion silently reverted. A tombstone is the only
 * representation that can propagate a deletion to devices that were offline when
 * it happened.
 */
export const deleteCloudWorkoutTemplate = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('workout_templates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error deleting cloud workout template', error);
    throw error;
  }
};

// ==================== WORKOUT SESSIONS ====================

export const syncWorkoutSession = async (
  userId: string,
  session: WorkoutSession
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase.from('workout_sessions').upsert(toSessionRow(userId, session));

  if (error) {
    logger.sync.error('Error syncing workout session', error);
    throw error;
  }
};

export const fetchWorkoutSessions = async (userId: string): Promise<WorkoutSession[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const data = await fetchAllPages('workout_sessions', (from, to) =>
    supabase!
      .from('workout_sessions')
      .select(
        'id, title, date, start_time, end_time, duration, exercises, total_volume, notes, status, template_id, rating, calories_burned, created_at, updated_at, deleted_at'
      )
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    exercises: row.exercises,
    totalVolume: row.total_volume,
    notes: row.notes,
    // `toCanonicalSession` still supplies its end_time-derived fallback for rows
    // written before these columns existed.
    status: row.status ?? undefined,
    templateId: row.template_id ?? null,
    // Recovered by 20260728150000. `rating` is the user's own post-workout score,
    // written by WorkoutSummary and displayed by WorkoutDetail.
    rating: row.rating ?? null,
    caloriesBurned: row.calories_burned ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

/**
 * Soft-delete a cloud workout session by stamping `deleted_at` (the house
 * pattern — see deleteCloudWaterEntry). A targeted UPDATE never touches the
 * other columns, so it cannot trip NOT NULL / timestamp validation the way an
 * empty-field tombstone upsert did, and the tombstone-aware merge propagates
 * the deletion to other devices instead of resurrecting the row.
 */
export const deleteCloudWorkoutSession = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('workout_sessions')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error deleting cloud workout session', error);
    throw error;
  }
};

// ==================== PERSONAL EXERCISES ====================

export const syncPersonalExercise = async (
  userId: string,
  exercise: PersonalExercise
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('personal_exercises')
    .upsert(toExerciseRow(userId, exercise));

  if (error) {
    logger.sync.error('Error syncing personal exercise', error);
    throw error;
  }
};

export const fetchPersonalExercises = async (userId: string): Promise<PersonalExercise[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const data = await fetchAllPages('personal_exercises', (from, to) =>
    supabase!
      .from('personal_exercises')
      .select(
        'id, name, muscle_group, category, tempo, default_rest_time, default_sets, notes, tutorial_text, is_favorite, use_count, last_used, created_at, updated_at, deleted_at'
      )
      .eq('user_id', userId)
      .order('last_used', { ascending: false, nullsFirst: false })
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    category: row.category,
    tempo: row.tempo,
    defaultRestTime: row.default_rest_time,
    defaultSets: row.default_sets,
    notes: row.notes,
    tutorialText: row.tutorial_text,
    isFavorite: row.is_favorite,
    useCount: row.use_count,
    lastUsed: row.last_used,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

/** Soft-delete — see deleteCloudWorkoutTemplate for why a hard delete cannot converge. */
export const deleteCloudPersonalExercise = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('personal_exercises')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error deleting cloud personal exercise', error);
    throw error;
  }
};

// ==================== BODY WEIGHT ====================

export const syncBodyWeight = async (userId: string, entry: BodyWeightEntry): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase.from('body_weight').upsert(toBodyWeightRow(userId, entry));

  if (error) {
    logger.sync.error('Error syncing body weight', error);
    throw error;
  }
};

export const fetchBodyWeight = async (userId: string): Promise<BodyWeightEntry[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const data = await fetchAllPages('body_weight', (from, to) =>
    supabase!
      .from('body_weight')
      .select('id, weight, date, notes, created_at, updated_at, deleted_at')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    weight: row.weight,
    date: row.date,
    // The column existed since 20260608000500 but was never read or written.
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

/** Soft-delete (tombstone) — see deleteCloudWorkoutSession. */
export const deleteCloudBodyWeight = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('body_weight')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error deleting cloud body weight', error);
    throw error;
  }
};

// ==================== BODY MEASUREMENTS ====================

export const syncBodyMeasurement = async (
  userId: string,
  measurement: BodyMeasurement
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('body_measurements')
    .upsert(toMeasurementRow(userId, measurement));

  if (error) {
    logger.sync.error('Error syncing body measurement', error);
    throw error;
  }
};

export const fetchBodyMeasurements = async (userId: string): Promise<BodyMeasurement[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const data = await fetchAllPages('body_measurements', (from, to) =>
    supabase!
      .from('body_measurements')
      .select('id, date, measurements, notes, created_at, updated_at, deleted_at')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    date: row.date,
    measurements: row.measurements,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

/** Soft-delete — see deleteCloudWorkoutTemplate for why a hard delete cannot converge. */
export const deleteCloudBodyMeasurement = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('body_measurements')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error deleting cloud body measurement', error);
    throw error;
  }
};

// ==================== PERSONAL RECORDS ====================

export const syncPersonalRecord = async (
  userId: string,
  record: PersonalRecordRow
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('personal_records')
    .upsert(toPersonalRecordRow(userId, record));

  if (error) {
    logger.sync.error('Error syncing personal record', error);
    throw error;
  }
};

export const fetchPersonalRecords = async (userId: string): Promise<PersonalRecordRow[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const data = await fetchAllPages('personal_records', (from, to) =>
    supabase!
      .from('personal_records')
      .select(
        'id, exercise_id, exercise_name, weight, reps, date, record_type, notes, created_at, updated_at, deleted_at'
      )
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .range(from, to)
  );

  // Local PR identity is the normalized exercise name (mirrors prService.
  // stableExerciseKey — duplicated here because prService imports this module,
  // so importing it back would create a cycle). Cloud exercise_id is uuid|null
  // and no longer carries identity; deriving the local key from exercise_name
  // keeps the `exerciseId` IDB index lookups working for rows pulled with a
  // null (or legacy-uuid) exercise_id.
  const localExerciseKey = (row: {
    exercise_id?: string | null;
    exercise_name?: string | null;
    id: string;
  }): string =>
    (row.exercise_name ?? '').trim().replace(/\s+/g, ' ').toLowerCase() ||
    row.exercise_id ||
    row.id;

  return data.map((row) => ({
    id: row.id,
    exerciseId: localExerciseKey(row),
    exerciseName: row.exercise_name,
    weight: row.weight,
    reps: row.reps,
    date: row.date,
    // BOTH names on purpose. `mergePersonalRecordsFromCloud` writes these rows
    // straight into IndexedDB with no canonical conversion, and every consumer
    // (prService, the PR screens, progression) filters on `pr.type` — the field
    // name on the canonical `PersonalRecord`. Emitting only `recordType` meant a
    // PR restored from the cloud matched no category filter and disappeared from
    // the UI even though the row was present locally.
    type: row.record_type,
    recordType: row.record_type,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

/** Soft-delete — see deleteCloudWorkoutTemplate for why a hard delete cannot converge. */
export const deleteCloudPersonalRecord = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('personal_records')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error deleting cloud personal record', error);
    throw error;
  }
};

// ==================== RECOVERY LOGS ====================

export const syncRecoveryLog = async (userId: string, log: RecoveryLog): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase.from('recovery_logs').upsert(toRecoveryRow(userId, log));

  if (error) {
    logger.sync.error('Error syncing recovery log', error);
    throw error;
  }
};

export const fetchRecoveryLogs = async (userId: string): Promise<RecoveryLog[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const data = await fetchAllPages('recovery_logs', (from, to) =>
    supabase!
      .from('recovery_logs')
      .select(
        'id, date, sleep_hours, sleep_quality, soreness_level, energy_level, stress_level, tight_areas, overall_score, session_id, notes, created_at, updated_at, deleted_at'
      )
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    date: row.date,
    sleepHours: row.sleep_hours,
    sleepQuality: row.sleep_quality,
    sorenessLevel: row.soreness_level,
    energyLevel: row.energy_level,
    stressLevel: row.stress_level,
    tightAreas: row.tight_areas || [],
    overallScore: row.overall_score,
    sessionId: row.session_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

/** Soft-delete (tombstone) — see deleteCloudWorkoutSession. */
export const deleteCloudRecoveryLog = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('recovery_logs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error deleting cloud recovery log', error);
    throw error;
  }
};

// ==================== NUTRITION LOGS ====================

export const syncNutritionLog = async (userId: string, log: NutritionLog): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase.from('nutrition_logs').upsert(toNutritionRow(userId, log));

  if (error) {
    logger.sync.error('Error syncing nutrition log', error);
    throw error;
  }
};

export const fetchNutritionLogs = async (userId: string): Promise<NutritionLog[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const data = await fetchAllPages('nutrition_logs', (from, to) =>
    supabase!
      .from('nutrition_logs')
      .select(
        'id, date, name, calories, protein, carbs, fat, meals, notes, created_at, updated_at, deleted_at'
      )
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    date: row.date,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    meals: row.meals || [],
    // Column added by 20260728150000; previously the entry title was rebuilt
    // as '' on every pull because there was nowhere to store it.
    name: row.name ?? undefined,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

/** Soft-delete (tombstone) — see deleteCloudWorkoutSession. */
export const deleteCloudNutritionLog = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('nutrition_logs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error deleting cloud nutrition log', error);
    throw error;
  }
};

// ==================== USER SETTINGS & AI CONVERSATIONS ====================
// syncUserSetting / fetchUserSettings / deleteCloudUserSetting and
// syncAIConversation / fetchAIConversations / deleteCloudAIConversation /
// softDeleteCloudAIConversation were extracted to ./supabaseMiscSync and are
// re-exported here for backward compatibility.
export * from './supabaseMiscSync';

// ==================== REAL-TIME SYNC ====================
// subscribeToWorkoutTemplates / subscribeToWorkoutSessions were extracted to
// ./supabaseRealtime and are re-exported here for backward compatibility.
export * from './supabaseRealtime';

// ==================== FULL SYNC ORCHESTRATION ====================
// syncAllData / pullAllData / testConnection were extracted to
// ./supabaseSyncOrchestrator and are re-exported here for backward compatibility.
export * from './supabaseSyncOrchestrator';

/**
 * Supabase Sync Service
 * SPARKOS Fitness App - Cloud Sync with Supabase
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import type {
  AIConversation,
  BodyMeasurement,
  BodyWeightEntry,
  NutritionLog,
  PersonalExercise,
  PersonalRecordRow,
  RecoveryLog,
  UserSetting,
  WorkoutSession,
  WorkoutTemplate,
} from './supabaseSyncMappers';

// Row interfaces and row->canonical mappers live in ./supabaseSyncMappers.

// ==================== SYNC HELPERS ====================

// Page size for keyset/range pagination. Supabase caps a single response at
// ~1000 rows; without paging, history beyond this was silently truncated.
const PAGE_SIZE = 1000;

/**
 * Pull every row of a query via range pagination, looping until a short page
 * (< PAGE_SIZE) is returned. The `build` callback receives a [from, to] window
 * and must apply `.range(from, to)` to the query.
 *
 * Throws on any page error so callers can distinguish a genuine fetch failure
 * from a legitimately empty result set (see DA fix #2). Tombstoned rows are
 * intentionally NOT filtered here: the tombstone-aware merges rely on receiving
 * `deleted_at` rows to propagate deletions on pull (see DA fix #1). With full
 * pagination there is no fixed row budget for tombstones to exhaust.
 */
async function fetchAllPages<T>(
  label: string,
  build: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await build(from, to);
    if (error) {
      throw new Error(`fetch ${label} failed: ${error.message}`);
    }
    const page = data ?? [];
    all.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return all;
}

// ==================== WORKOUT TEMPLATES ====================

export const syncWorkoutTemplate = async (
  userId: string,
  template: WorkoutTemplate
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase.from('workout_templates').upsert({
    id: template.id,
    user_id: userId,
    name: template.name,
    description: template.description || null,
    exercises: template.exercises,
    created_at: template.createdAt || new Date().toISOString(),
    updated_at: template.updatedAt || new Date().toISOString(),
    deleted_at: template.deletedAt || null,
  });

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
      .select('id, name, description, exercises, created_at, updated_at, deleted_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    exercises: row.exercises,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

export const deleteCloudWorkoutTemplate = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('workout_templates')
    .delete()
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

  const { error } = await supabase.from('workout_sessions').upsert({
    id: session.id,
    user_id: userId,
    title: session.title || null,
    date: session.date || new Date().toISOString(),
    start_time: session.startTime,
    end_time: session.endTime || null,
    duration: session.duration || 0,
    exercises: session.exercises,
    total_volume: session.totalVolume || 0,
    notes: session.notes || null,
    created_at: session.startTime,
    updated_at: session.updatedAt || session.startTime || new Date().toISOString(),
    deleted_at: session.deletedAt || null,
  });

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
        'id, title, date, start_time, end_time, duration, exercises, total_volume, notes, created_at, updated_at, deleted_at'
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

export const deleteCloudWorkoutSession = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('workout_sessions')
    .delete()
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

  const { error } = await supabase.from('personal_exercises').upsert({
    id: exercise.id,
    user_id: userId,
    name: exercise.name,
    muscle_group: exercise.muscleGroup || null,
    category: exercise.category || 'strength',
    tempo: exercise.tempo || null,
    default_rest_time: exercise.defaultRestTime || 60,
    default_sets: exercise.defaultSets || 3,
    notes: exercise.notes || null,
    tutorial_text: exercise.tutorialText || null,
    is_favorite: exercise.isFavorite || false,
    use_count: exercise.useCount || 0,
    last_used: exercise.lastUsed || null,
    created_at: exercise.createdAt || new Date().toISOString(),
    updated_at: exercise.updatedAt || exercise.createdAt || new Date().toISOString(),
    deleted_at: exercise.deletedAt || null,
  });

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

export const deleteCloudPersonalExercise = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('personal_exercises')
    .delete()
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

  const { error } = await supabase.from('body_weight').upsert({
    id: entry.id,
    user_id: userId,
    weight: entry.weight,
    date: entry.date,
    created_at: entry.createdAt ?? new Date().toISOString(),
    updated_at: entry.updatedAt ?? entry.createdAt ?? new Date().toISOString(),
    deleted_at: entry.deletedAt || null,
  });

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
      .select('id, weight, date, created_at, updated_at, deleted_at')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    weight: row.weight,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

export const deleteCloudBodyWeight = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase.from('body_weight').delete().eq('id', id).eq('user_id', userId);

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

  const { error } = await supabase.from('body_measurements').upsert({
    id: measurement.id,
    user_id: userId,
    date: measurement.date,
    measurements: measurement.measurements,
    notes: measurement.notes || null,
    created_at: measurement.createdAt || new Date().toISOString(),
    updated_at: measurement.updatedAt ?? measurement.createdAt ?? new Date().toISOString(),
    deleted_at: measurement.deletedAt || null,
  });

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

export const deleteCloudBodyMeasurement = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('body_measurements')
    .delete()
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

  const { error } = await supabase.from('personal_records').upsert({
    id: record.id,
    user_id: userId,
    exercise_id: record.exerciseId,
    exercise_name: record.exerciseName,
    weight: record.weight,
    reps: record.reps,
    date: record.date,
    record_type: record.recordType,
    created_at: record.createdAt || new Date().toISOString(),
    updated_at: record.updatedAt ?? record.createdAt ?? new Date().toISOString(),
    deleted_at: record.deletedAt || null,
  });

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
        'id, exercise_id, exercise_name, weight, reps, date, record_type, created_at, updated_at, deleted_at'
      )
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    weight: row.weight,
    reps: row.reps,
    date: row.date,
    recordType: row.record_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

export const deleteCloudPersonalRecord = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('personal_records')
    .delete()
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

  const { error } = await supabase.from('recovery_logs').upsert({
    id: log.id,
    user_id: userId,
    date: log.date,
    sleep_hours: log.sleepHours ?? null,
    sleep_quality: log.sleepQuality ?? null,
    soreness_level: log.sorenessLevel ?? null,
    energy_level: log.energyLevel ?? null,
    stress_level: log.stressLevel ?? null,
    tight_areas: log.tightAreas ?? [],
    overall_score: log.overallScore ?? null,
    session_id: log.sessionId ?? null,
    notes: log.notes || null,
    created_at: log.createdAt || new Date().toISOString(),
    updated_at: log.updatedAt ?? log.createdAt ?? new Date().toISOString(),
    deleted_at: log.deletedAt || null,
  });

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

export const deleteCloudRecoveryLog = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('recovery_logs')
    .delete()
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

  const { error } = await supabase.from('nutrition_logs').upsert({
    id: log.id,
    user_id: userId,
    date: log.date,
    calories: log.calories || null,
    protein: log.protein || null,
    carbs: log.carbs || null,
    fat: log.fat || null,
    meals: log.meals,
    notes: log.notes || null,
    created_at: log.createdAt || new Date().toISOString(),
    updated_at: log.updatedAt ?? log.createdAt ?? new Date().toISOString(),
    deleted_at: log.deletedAt || null,
  });

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
        'id, date, calories, protein, carbs, fat, meals, notes, created_at, updated_at, deleted_at'
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
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

export const deleteCloudNutritionLog = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('nutrition_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error deleting cloud nutrition log', error);
    throw error;
  }
};

// ==================== USER SETTINGS ====================

export const syncUserSetting = async (userId: string, setting: UserSetting): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase.from('user_settings').upsert(
    {
      id: setting.id || `${userId}:${setting.key}`,
      user_id: userId,
      key: setting.key,
      value: setting.value,
      created_at: setting.createdAt || new Date().toISOString(),
      updated_at: setting.updatedAt || new Date().toISOString(),
    },
    { onConflict: 'user_id,key' }
  );

  if (error) {
    logger.sync.error('Error syncing user setting', error);
    throw error;
  }
};

export const fetchUserSettings = async (userId: string): Promise<UserSetting[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const data = await fetchAllPages('user_settings', (from, to) =>
    supabase!
      .from('user_settings')
      .select('id, key, value, created_at, updated_at')
      .eq('user_id', userId)
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    key: row.key,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const deleteCloudUserSetting = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  // INTENTIONAL hard delete (no tombstone). Unlike sessions/templates/water,
  // user_settings rows are keyed by (user_id, key) and treated as upsert-only
  // state — a setting is overwritten via `syncUserSetting`, not deleted, during
  // normal use. There is therefore no local delete path that needs to propagate
  // to other devices, and the `UserSetting` shape carries no `deletedAt`.
  // mergeUserSettingsFromCloud already routes through the tombstone-aware
  // generic merge, so if a `deleted_at` column is added server-side later, a
  // soft-delete here would propagate without further merge changes.
  const { error } = await supabase
    .from('user_settings')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error deleting cloud user setting', error);
    throw error;
  }
};

// ==================== AI CONVERSATIONS ====================

export const syncAIConversation = async (
  userId: string,
  conversation: AIConversation
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase.from('ai_conversations').upsert({
    id: conversation.id,
    user_id: userId,
    title: conversation.title || null,
    messages: conversation.messages,
    context: conversation.context || {},
    created_at: conversation.createdAt || new Date().toISOString(),
    updated_at: conversation.updatedAt || conversation.createdAt || new Date().toISOString(),
  });

  if (error) {
    logger.sync.error('Error syncing AI conversation', error);
    throw error;
  }
};

export const fetchAIConversations = async (userId: string): Promise<AIConversation[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const data = await fetchAllPages('ai_conversations', (from, to) =>
    supabase!
      .from('ai_conversations')
      .select('id, title, messages, context, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    messages: row.messages || [],
    context: row.context || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const deleteCloudAIConversation = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error deleting cloud AI conversation', error);
    throw error;
  }
};

// ==================== REAL-TIME SYNC ====================

type RealtimeCallback = (payload: unknown) => void;
const realtimeChannels: Map<string, RealtimeChannel> = new Map();

export const subscribeToWorkoutTemplates = (
  userId: string,
  onInsert: RealtimeCallback,
  onUpdate: RealtimeCallback,
  onDelete: RealtimeCallback
): (() => void) => {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  const channelName = `workout_templates:${userId}`;

  if (realtimeChannels.has(channelName)) {
    realtimeChannels.get(channelName)?.unsubscribe();
  }

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'workout_templates',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(payload)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'workout_templates',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onUpdate(payload)
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'workout_templates',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onDelete(payload)
    )
    .subscribe();

  realtimeChannels.set(channelName, channel);

  return () => {
    channel.unsubscribe();
    realtimeChannels.delete(channelName);
  };
};

export const subscribeToWorkoutSessions = (
  userId: string,
  onInsert: RealtimeCallback,
  onUpdate: RealtimeCallback,
  onDelete: RealtimeCallback
): (() => void) => {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  const channelName = `workout_sessions:${userId}`;

  if (realtimeChannels.has(channelName)) {
    realtimeChannels.get(channelName)?.unsubscribe();
  }

  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'workout_sessions',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(payload)
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'workout_sessions',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onUpdate(payload)
    )
    .on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: 'workout_sessions',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onDelete(payload)
    )
    .subscribe();

  realtimeChannels.set(channelName, channel);

  return () => {
    channel.unsubscribe();
    realtimeChannels.delete(channelName);
  };
};

// ==================== FULL SYNC ====================

// ==================== FULL SYNC ORCHESTRATION ====================
// syncAllData / pullAllData / testConnection were extracted to
// ./supabaseSyncOrchestrator and are re-exported here for backward compatibility.
export * from './supabaseSyncOrchestrator';

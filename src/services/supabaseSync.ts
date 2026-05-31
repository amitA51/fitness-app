/**
 * Supabase Sync Service
 * SPARKOS Fitness App - Cloud Sync with Supabase
 */

import type { RealtimeChannel } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { STORES } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import {
  type AIConversation,
  type BodyMeasurement,
  type BodyWeightEntry,
  type NutritionLog,
  type PersonalExercise,
  type PersonalRecord,
  type RecoveryLog,
  type UserSetting,
  type WorkoutSession,
  type WorkoutTemplate,
  toCanonicalBodyWeight,
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

// Row interfaces and row->canonical mappers live in ./supabaseSyncMappers.

// ==================== SYNC HELPERS ====================

const getUserId = async (): Promise<string | null> => {
  const user = await getCurrentUser();
  return user?.id || null;
};

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
  });

  if (error) {
    logger.sync.error('Error syncing workout template', error);
    throw error;
  }
};

export const fetchWorkoutTemplates = async (userId: string): Promise<WorkoutTemplate[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from('workout_templates')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    logger.sync.error('Error fetching workout templates', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    exercises: row.exercises,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
  });

  if (error) {
    logger.sync.error('Error syncing workout session', error);
    throw error;
  }
};

export const fetchWorkoutSessions = async (userId: string): Promise<WorkoutSession[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', userId)
    .order('start_time', { ascending: false });

  if (error) {
    logger.sync.error('Error fetching workout sessions', error);
    return [];
  }

  return (data || []).map((row) => ({
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
  });

  if (error) {
    logger.sync.error('Error syncing personal exercise', error);
    throw error;
  }
};

export const fetchPersonalExercises = async (userId: string): Promise<PersonalExercise[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from('personal_exercises')
    .select('*')
    .eq('user_id', userId)
    .order('last_used', { ascending: false, nullsFirst: false });

  if (error) {
    logger.sync.error('Error fetching personal exercises', error);
    return [];
  }

  return (data || []).map((row) => ({
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
  });

  if (error) {
    logger.sync.error('Error syncing body weight', error);
    throw error;
  }
};

export const fetchBodyWeight = async (userId: string): Promise<BodyWeightEntry[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from('body_weight')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    logger.sync.error('Error fetching body weight', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    weight: row.weight,
    date: row.date,
    createdAt: row.created_at,
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
  });

  if (error) {
    logger.sync.error('Error syncing body measurement', error);
    throw error;
  }
};

export const fetchBodyMeasurements = async (userId: string): Promise<BodyMeasurement[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    logger.sync.error('Error fetching body measurements', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    date: row.date,
    measurements: row.measurements,
    notes: row.notes,
    createdAt: row.created_at,
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

export const syncPersonalRecord = async (userId: string, record: PersonalRecord): Promise<void> => {
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
  });

  if (error) {
    logger.sync.error('Error syncing personal record', error);
    throw error;
  }
};

export const fetchPersonalRecords = async (userId: string): Promise<PersonalRecord[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    logger.sync.error('Error fetching personal records', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: row.exercise_name,
    weight: row.weight,
    reps: row.reps,
    date: row.date,
    recordType: row.record_type,
    createdAt: row.created_at,
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
  });

  if (error) {
    logger.sync.error('Error syncing recovery log', error);
    throw error;
  }
};

export const fetchRecoveryLogs = async (userId: string): Promise<RecoveryLog[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from('recovery_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    logger.sync.error('Error fetching recovery logs', error);
    return [];
  }

  return (data || []).map((row) => ({
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
  });

  if (error) {
    logger.sync.error('Error syncing nutrition log', error);
    throw error;
  }
};

export const fetchNutritionLogs = async (userId: string): Promise<NutritionLog[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    logger.sync.error('Error fetching nutrition logs', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    date: row.date,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    meals: row.meals || [],
    notes: row.notes,
    createdAt: row.created_at,
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

  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId);

  if (error) {
    logger.sync.error('Error fetching user settings', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    key: row.key,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const deleteCloudUserSetting = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

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

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) {
    logger.sync.error('Error fetching AI conversations', error);
    return [];
  }

  return (data || []).map((row) => ({
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
      dbGetAll<PersonalRecord>(STORES.PERSONAL_RECORDS),
      dbGetAll<RecoveryLog>(STORES.RECOVERY_LOGS),
      dbGetAll<NutritionLog>(STORES.NUTRITION_LOGS),
      dbGetAll<UserSetting>(STORES.USER_SETTINGS),
      dbGetAll<AIConversation>(STORES.AI_CONVERSATIONS),
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
    const localPersonalRecords = unwrapRead<PersonalRecord>(readResults[5]);
    const localRecoveryLogs = unwrapRead<RecoveryLog>(readResults[6]);
    const localNutritionLogs = unwrapRead<NutritionLog>(readResults[7]);
    const localUserSettings = unwrapRead<UserSetting>(readResults[8]);
    const localAIConversations = unwrapRead<AIConversation>(readResults[9]);

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

    const syncPromises: Promise<void>[] = [];

    for (const template of localTemplates) {
      syncPromises.push(
        syncWorkoutTemplate(userId, template).then(() => {
          counts.templates++;
        })
      );
    }

    for (const session of localSessions) {
      syncPromises.push(
        syncWorkoutSession(userId, session).then(() => {
          counts.sessions++;
        })
      );
    }

    for (const exercise of localExercises) {
      syncPromises.push(
        syncPersonalExercise(userId, exercise).then(() => {
          counts.exercises++;
        })
      );
    }

    for (const entry of localBodyWeight) {
      syncPromises.push(
        syncBodyWeight(userId, entry).then(() => {
          counts.bodyWeight++;
        })
      );
    }

    for (const measurement of localBodyMeasurements) {
      syncPromises.push(
        syncBodyMeasurement(userId, measurement).then(() => {
          counts.bodyMeasurements++;
        })
      );
    }

    for (const record of localPersonalRecords) {
      syncPromises.push(
        syncPersonalRecord(userId, record).then(() => {
          counts.personalRecords++;
        })
      );
    }

    for (const log of localRecoveryLogs) {
      syncPromises.push(
        syncRecoveryLog(userId, log).then(() => {
          counts.recoveryLogs++;
        })
      );
    }

    for (const log of localNutritionLogs) {
      syncPromises.push(
        syncNutritionLog(userId, log).then(() => {
          counts.nutritionLogs++;
        })
      );
    }

    for (const setting of localUserSettings) {
      syncPromises.push(
        syncUserSetting(userId, setting).then(() => {
          counts.userSettings++;
        })
      );
    }

    for (const conversation of localAIConversations) {
      syncPromises.push(
        syncAIConversation(userId, conversation).then(() => {
          counts.aiConversations++;
        })
      );
    }

    const pushResults = await Promise.allSettled(syncPromises);
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
    const [
      templates,
      sessions,
      exercises,
      bodyWeight,
      bodyMeasurements,
      personalRecords,
      recoveryLogs,
      nutritionLogs,
      userSettings,
      aiConversations,
    ] = await Promise.all([
      fetchWorkoutTemplates(userId),
      fetchWorkoutSessions(userId),
      fetchPersonalExercises(userId),
      fetchBodyWeight(userId),
      fetchBodyMeasurements(userId),
      fetchPersonalRecords(userId),
      fetchRecoveryLogs(userId),
      fetchNutritionLogs(userId),
      fetchUserSettings(userId),
      fetchAIConversations(userId),
    ]);

    // Merge each store independently: one failed merge must not discard the
    // others (they have already been fetched from the cloud).
    const mergeResults = await Promise.allSettled([
      mergeWorkoutTemplatesFromCloud(templates.map(toCanonicalTemplate)),
      mergeWorkoutSessionsFromCloud(sessions.map(toCanonicalSession)),
      mergePersonalExercisesFromCloud(exercises.map(toCanonicalPersonalExercise)),
      mergeBodyWeightFromCloud(bodyWeight.map(toCanonicalBodyWeight)),
      mergeBodyMeasurementsFromCloud(bodyMeasurements),
      mergePersonalRecordsFromCloud(personalRecords),
      mergeRecoveryLogsFromCloud(recoveryLogs),
      mergeNutritionLogsFromCloud(nutritionLogs),
      mergeUserSettingsFromCloud(userSettings),
      mergeAIConversationsFromCloud(aiConversations),
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

    return {
      success: mergeFailed.length === 0,
      syncedItems: totalItems,
      counts,
      ...(mergeFailed.length > 0 && { error: `${mergeFailed.length} merge operations failed` }),
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

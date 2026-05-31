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
  type PersonalRecordRow,
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
    .select('id, name, description, exercises, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);

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
    .select(
      'id, title, date, start_time, end_time, duration, exercises, total_volume, notes, created_at, updated_at'
    )
    .eq('user_id', userId)
    .order('start_time', { ascending: false })
    .limit(500);

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
    updatedAt: row.updated_at,
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
    .select(
      'id, name, muscle_group, category, tempo, default_rest_time, default_sets, notes, tutorial_text, is_favorite, use_count, last_used, created_at, updated_at'
    )
    .eq('user_id', userId)
    .order('last_used', { ascending: false, nullsFirst: false })
    .limit(500);

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
    updated_at: entry.updatedAt ?? entry.createdAt ?? new Date().toISOString(),
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
    .select('id, weight, date, created_at, updated_at')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(500);

  if (error) {
    logger.sync.error('Error fetching body weight', error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    weight: row.weight,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
    .select('id, date, measurements, notes, created_at, updated_at')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(500);

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
    updatedAt: row.updated_at,
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
  });

  if (error) {
    logger.sync.error('Error syncing personal record', error);
    throw error;
  }
};

export const fetchPersonalRecords = async (userId: string): Promise<PersonalRecordRow[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const { data, error } = await supabase
    .from('personal_records')
    .select(
      'id, exercise_id, exercise_name, weight, reps, date, record_type, created_at, updated_at'
    )
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(500);

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
    updatedAt: row.updated_at,
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
    .select(
      'id, date, sleep_hours, sleep_quality, soreness_level, energy_level, stress_level, tight_areas, overall_score, session_id, notes, created_at, updated_at'
    )
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(500);

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
    updatedAt: row.updated_at,
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
    .select('id, date, calories, protein, carbs, fat, meals, notes, created_at, updated_at')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(500);

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
    updatedAt: row.updated_at,
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

  const { data, error } = await supabase
    .from('user_settings')
    .select('id, key, value, created_at, updated_at')
    .eq('user_id', userId);

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
    .select('id, title, messages, context, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(100);

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
      waterLogs,
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
      import('./waterService').then((m) => m.fetchWaterLogs(userId)),
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

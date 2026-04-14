/**
 * Supabase Sync Service
 * SPARKOS Fitness App - Cloud Sync with Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getCurrentUser } from './supabaseAuth';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ==================== TYPE DEFINITIONS ====================

interface WorkoutTemplate {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  exercises: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

interface WorkoutSession {
  id: string;
  user_id?: string;
  title?: string;
  date?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  exercises: unknown[];
  totalVolume?: number;
  notes?: string;
  createdAt?: string;
}

interface PersonalExercise {
  id: string;
  user_id?: string;
  name: string;
  muscleGroup?: string;
  category?: string;
  tempo?: string;
  defaultRestTime?: number;
  defaultSets?: number;
  notes?: string;
  tutorialText?: string;
  isFavorite?: boolean;
  useCount?: number;
  lastUsed?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface BodyWeightEntry {
  id: string;
  user_id?: string;
  weight: number;
  date: string;
  createdAt?: string;
}

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

  const { error } = await supabase
    .from('workout_templates')
    .upsert({
      id: template.id,
      user_id: userId,
      name: template.name,
      description: template.description || null,
      exercises: template.exercises,
      created_at: template.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error syncing workout template:', error);
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
    console.error('Error fetching workout templates:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    exercises: row.exercises,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
};

export const deleteCloudWorkoutTemplate = async (
  userId: string,
  id: string
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting cloud workout template:', error);
    throw error;
  }
};

// ==================== WORKOUT SESSIONS ====================

export const syncWorkoutSession = async (
  userId: string,
  session: WorkoutSession
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('workout_sessions')
    .upsert({
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
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error syncing workout session:', error);
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
    console.error('Error fetching workout sessions:', error);
    return [];
  }

  return (data || []).map(row => ({
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

export const deleteCloudWorkoutSession = async (
  userId: string,
  id: string
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('workout_sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting cloud workout session:', error);
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
    .upsert({
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
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error syncing personal exercise:', error);
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
    console.error('Error fetching personal exercises:', error);
    return [];
  }

  return (data || []).map(row => ({
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

export const deleteCloudPersonalExercise = async (
  userId: string,
  id: string
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('personal_exercises')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting cloud personal exercise:', error);
    throw error;
  }
};

// ==================== BODY WEIGHT ====================

export const syncBodyWeight = async (
  userId: string,
  entry: BodyWeightEntry
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('body_weight')
    .upsert({
      id: entry.id,
      user_id: userId,
      weight: entry.weight,
      date: entry.date,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error syncing body weight:', error);
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
    console.error('Error fetching body weight:', error);
    return [];
  }

  return (data || []).map(row => ({
    id: row.id,
    weight: row.weight,
    date: row.date,
    createdAt: row.created_at,
  }));
};

export const deleteCloudBodyWeight = async (
  userId: string,
  id: string
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('body_weight')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    console.error('Error deleting cloud body weight:', error);
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
}

export const syncAllData = async (): Promise<SyncResult> => {
  const userId = await getUserId();
  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // This would be called from the app's sync logic
    // to push all local IndexedDB data to Supabase
    console.log('Syncing all data for user:', userId);
    return { success: true, syncedItems: 0 };
  } catch (error) {
    console.error('Error syncing all data:', error);
    return { success: false, error: String(error) };
  }
};

export const pullAllData = async (): Promise<SyncResult> => {
  const userId = await getUserId();
  if (!userId) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Fetch all data from Supabase
    const [templates, sessions, exercises, bodyWeight] = await Promise.all([
      fetchWorkoutTemplates(userId),
      fetchWorkoutSessions(userId),
      fetchPersonalExercises(userId),
      fetchBodyWeight(userId),
    ]);

    console.log('Pulled data:', {
      templates: templates.length,
      sessions: sessions.length,
      exercises: exercises.length,
      bodyWeight: bodyWeight.length,
    });

    return {
      success: true,
      syncedItems: templates.length + sessions.length + exercises.length + bodyWeight.length,
    };
  } catch (error) {
    console.error('Error pulling all data:', error);
    return { success: false, error: String(error) };
  }
};

// ==================== CONNECTION TEST ====================

export const testConnection = async (): Promise<boolean> => {
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const { error } = await supabase.from('workout_templates').select('id').limit(1);
    if (error) {
      console.error('Connection test failed:', error);
      return false;
    }
    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Connection test error:', error);
    return false;
  }
};

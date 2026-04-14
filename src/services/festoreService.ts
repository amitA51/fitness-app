/**
 * Supabase Service - Replaces Firebase Firestore Service
 * SPARKOS Fitness App - Cloud Sync with Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ==================== TYPE DEFINITIONS ====================

interface WorkoutTemplate {
  id: string;
  name: string;
  description?: string;
  exercises: unknown[];
  createdAt?: string;
  updatedAt?: string;
}

interface WorkoutSession {
  id: string;
  title?: string;
  date?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  exercises: unknown[];
  totalVolume?: number;
  notes?: string;
}

interface PersonalExercise {
  id: string;
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
  weight: number;
  date: string;
}

// ==================== WORKOUT TEMPLATES ====================

export const syncWorkoutTemplate = async (
  _userId: string,
  template: WorkoutTemplate
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('workout_templates')
    .upsert({
      id: template.id,
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

export const deleteWorkoutTemplate = async (
  _userId: string,
  id: string
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting cloud workout template:', error);
    throw error;
  }
};

// ==================== WORKOUT SESSIONS ====================

export const syncWorkoutSession = async (
  _userId: string,
  session: WorkoutSession
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('workout_sessions')
    .upsert({
      id: session.id,
      title: session.title || null,
      date: session.date || new Date().toISOString(),
      start_time: session.startTime,
      end_time: session.endTime || null,
      duration: session.duration || 0,
      exercises: session.exercises,
      total_volume: session.totalVolume || 0,
      notes: session.notes || null,
    });

  if (error) {
    console.error('Error syncing workout session:', error);
    throw error;
  }
};

export const deleteWorkoutSession = async (
  _userId: string,
  id: string
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('workout_sessions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting cloud workout session:', error);
    throw error;
  }
};

// ==================== PERSONAL EXERCISES ====================

export const syncPersonalExercise = async (
  _userId: string,
  exercise: PersonalExercise
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('personal_exercises')
    .upsert({
      id: exercise.id,
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

export const deletePersonalExercise = async (
  _userId: string,
  id: string
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('personal_exercises')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting cloud personal exercise:', error);
    throw error;
  }
};

// ==================== BODY WEIGHT ====================

export const syncBodyWeight = async (
  _userId: string,
  entry: BodyWeightEntry
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('body_weight')
    .upsert({
      id: entry.id,
      weight: entry.weight,
      date: entry.date,
    });

  if (error) {
    console.error('Error syncing body weight:', error);
    throw error;
  }
};

export const deleteBodyWeight = async (
  _userId: string,
  id: string
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('body_weight')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting cloud body weight:', error);
    throw error;
  }
};

// ==================== LEGACY EXPORTS ====================

export const initFirebase = async (): Promise<void> => {
  console.log('Firebase is deprecated - using Supabase instead');
};

export const auth = null;
export const db = null;

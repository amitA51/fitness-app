// ============================================================================
// COACH PLATFORM — coachApi (the coach-side data path)
// ============================================================================
// Direct-to-Supabase reads/writes of a TRAINEE's data, parameterized by
// clientId. This deliberately bypasses the local-first IndexedDB layer (which
// is wiped on logout and only holds the current user's own data). RLS enforces
// that the caller is an ACTIVE coach of `clientId`; writes stamp `updated_by`
// for audit and reflect to the trainee via their normal pull/Realtime path.

import type { BodyWeightEntry, WorkoutSession, WorkoutTemplate } from '../../types';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import type { BodyMeasurement, NutritionLog, PersonalRecord } from '../supabaseSyncMappers';
import {
  toCanonicalBodyWeight,
  toCanonicalSession,
  toCanonicalTemplate,
} from '../supabaseSyncMappers';
import { requireClient } from './mappers';

// ---- READS -----------------------------------------------------------------

export const getClientSessions = async (
  clientId: string,
  limit = 100
): Promise<WorkoutSession[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', clientId)
    .order('start_time', { ascending: false })
    .limit(limit);
  if (error) {
    logger.db.error('getClientSessions failed', error);
    return [];
  }
  return (data ?? []).map((r) =>
    toCanonicalSession({
      id: r.id,
      title: r.title,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      duration: r.duration,
      exercises: r.exercises ?? [],
      totalVolume: r.total_volume,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })
  );
};

export const getClientTemplates = async (clientId: string): Promise<WorkoutTemplate[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('workout_templates')
    .select('*')
    .eq('user_id', clientId)
    .order('created_at', { ascending: false });
  if (error) {
    logger.db.error('getClientTemplates failed', error);
    return [];
  }
  return (data ?? []).map((r) =>
    toCanonicalTemplate({
      id: r.id,
      name: r.name,
      description: r.description,
      exercises: r.exercises ?? [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })
  );
};

export const getClientBodyWeight = async (clientId: string): Promise<BodyWeightEntry[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('body_weight')
    .select('*')
    .eq('user_id', clientId)
    .order('date', { ascending: false });
  if (error) {
    logger.db.error('getClientBodyWeight failed', error);
    return [];
  }
  return (data ?? []).map((r) =>
    toCanonicalBodyWeight({
      id: r.id,
      weight: r.weight,
      date: r.date,
      createdAt: r.created_at,
      notes: r.notes,
    })
  );
};

export const getClientPRs = async (clientId: string): Promise<PersonalRecord[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('personal_records')
    .select('*')
    .eq('user_id', clientId)
    .order('date', { ascending: false });
  if (error) {
    logger.db.error('getClientPRs failed', error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    exerciseId: r.exercise_id,
    exerciseName: r.exercise_name,
    weight: r.weight,
    reps: r.reps,
    date: r.date,
    recordType: r.record_type,
    createdAt: r.created_at,
  }));
};

export const getClientNutrition = async (clientId: string, limit = 60): Promise<NutritionLog[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('*')
    .eq('user_id', clientId)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) {
    logger.db.error('getClientNutrition failed', error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    meals: r.meals ?? [],
    notes: r.notes,
    createdAt: r.created_at,
  }));
};

export const getClientMeasurements = async (clientId: string): Promise<BodyMeasurement[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('body_measurements')
    .select('*')
    .eq('user_id', clientId)
    .order('date', { ascending: false });
  if (error) {
    logger.db.error('getClientMeasurements failed', error);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    measurements: r.measurements ?? {},
    notes: r.notes,
    createdAt: r.created_at,
  }));
};

// ---- WRITES (full control, audited) ----------------------------------------

/** Create or update a template owned by the trainee. Stamps updated_by = coach. */
export const upsertClientTemplate = async (
  clientId: string,
  template: WorkoutTemplate
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const coach = await getCurrentUser();
  const { error } = await supabase.from('workout_templates').upsert({
    id: template.id,
    user_id: clientId,
    name: template.name,
    description: template.description || null,
    exercises: template.exercises,
    created_at: template.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updated_by: coach?.id ?? null,
  });
  if (error) {
    logger.db.error('upsertClientTemplate failed', error);
    return { error: error.message };
  }
  return { error: null };
};

export const deleteClientTemplate = async (
  clientId: string,
  templateId: string
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const { error } = await supabase
    .from('workout_templates')
    .delete()
    .eq('id', templateId)
    .eq('user_id', clientId);
  return { error: error?.message ?? null };
};

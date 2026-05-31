// ============================================================================
// Supabase sync mappers & row types
// ============================================================================
// The file-local "row" interfaces that describe records flowing through the
// sync layer, plus the mappers that convert them to the canonical domain types
// in ../types. Extracted from supabaseSync.ts to keep that module focused on
// the actual sync/transport logic.
//
// These interfaces are intentionally a superset — all fields beyond the
// canonical DB columns are optional so callers can pass richer domain objects
// from src/types without a cast, and mappers can safely ignore the extras.
// Rather than importing the canonical types wholesale (which require non-null
// fields we don't always fetch from the DB), we keep structurally-compatible
// local interfaces with the extra fields marked optional.

import type {
  BodyWeightEntry as CanonicalBodyWeightEntry,
  PersonalExercise as CanonicalPersonalExercise,
  WorkoutSession as CanonicalWorkoutSession,
  WorkoutTemplate as CanonicalWorkoutTemplate,
} from '../types';

export interface WorkoutTemplate {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  exercises: unknown[];
  createdAt?: string;
  updatedAt?: string;
  // Canonical fields (optional here — present on domain objects from ../types)
  lastUsed?: string | null;
  timesUsed?: number;
  isFavorite?: boolean;
  muscleGroups?: string[];
  isBuiltin?: boolean;
}

export interface WorkoutSession {
  id: string;
  user_id?: string;
  title?: string;
  date?: string;
  startTime: string;
  endTime?: string | null;
  duration?: number;
  exercises: unknown[];
  totalVolume?: number;
  notes?: string;
  createdAt?: string;
  // Canonical fields (optional here)
  updatedAt?: string;
  status?: 'active' | 'completed' | 'cancelled';
  templateId?: string | null;
  rating?: number | null;
  caloriesBurned?: number | null;
  userId?: string;
  workoutItemId?: string;
  goalType?: string;
  lastUsed?: string | null;
  timesUsed?: number;
  isFavorite?: boolean;
  muscleGroups?: string[];
  isBuiltin?: boolean;
}

export interface PersonalExercise {
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
  // Canonical fields (optional — see ../types PersonalExercise/Exercise)
  userId?: string;
  targetMuscle?: string;
  secondaryMuscles?: string[];
  equipment?: string;
  instructions?: string;
  videoUrl?: string | null;
  imageUrl?: string | null;
  isCustom?: boolean;
  isTimed?: boolean;
  targetRestTime?: number;
  lastWeight?: number | null;
  lastReps?: number | null;
}

export interface BodyWeightEntry {
  id: string;
  user_id?: string;
  weight: number;
  date: string;
  createdAt?: string;
  updatedAt?: string;
  // Canonical field (optional)
  notes?: string;
}

export interface BodyMeasurement {
  id: string;
  user_id?: string;
  date: string;
  measurements: {
    chest?: number;
    waist?: number;
    hips?: number;
    biceps?: number;
    thighs?: number;
    [key: string]: number | undefined;
  };
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Supabase row shape for personal_records table */
export interface PersonalRecordRow {
  id: string;
  user_id?: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  date: string;
  recordType: 'weight' | '1rm' | 'volume' | 'reps';
  createdAt?: string;
  updatedAt?: string;
}

export interface RecoveryLog {
  id: string;
  user_id?: string;
  date: string;
  sleepHours?: number;
  sleepQuality?: number;
  sorenessLevel?: number;
  energyLevel?: number;
  stressLevel?: number;
  tightAreas?: string[];
  overallScore?: number;
  sessionId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface NutritionMeal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  time?: string;
}

export interface NutritionLog {
  id: string;
  user_id?: string;
  date: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  meals: NutritionMeal[];
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserSetting {
  id?: string;
  user_id?: string;
  key: string;
  value: unknown;
  createdAt?: string;
  updatedAt?: string;
}

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface AIConversation {
  id: string;
  user_id?: string;
  title?: string;
  messages: AIMessage[];
  context?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== ROW -> CANONICAL MAPPERS ====================
// Fill in required canonical-type fields with safe defaults when pulling from
// Supabase. Columns we don't persist server-side (e.g. lastUsed on templates,
// status on sessions) get reasonable defaults so the result satisfies the
// canonical types in ../types without an unsafe cast.

export const toCanonicalTemplate = (t: WorkoutTemplate): CanonicalWorkoutTemplate => ({
  id: t.id,
  name: t.name,
  description: t.description ?? '',
  exercises: (t.exercises ?? []) as CanonicalWorkoutTemplate['exercises'],
  createdAt: t.createdAt ?? new Date().toISOString(),
  updatedAt: t.updatedAt ?? t.createdAt ?? new Date().toISOString(),
  lastUsed: t.lastUsed ?? null,
  timesUsed: t.timesUsed ?? 0,
  isFavorite: t.isFavorite ?? false,
  ...(t.muscleGroups !== undefined && { muscleGroups: t.muscleGroups }),
  ...(t.isBuiltin !== undefined && { isBuiltin: t.isBuiltin }),
});

export const toCanonicalSession = (s: WorkoutSession): CanonicalWorkoutSession => ({
  id: s.id,
  date: s.date ?? (s.startTime ? s.startTime.slice(0, 10) : new Date().toISOString().slice(0, 10)),
  startTime: s.startTime,
  endTime: s.endTime ?? null,
  exercises: (s.exercises ?? []) as CanonicalWorkoutSession['exercises'],
  duration: s.duration ?? 0,
  status: s.status ?? (s.endTime ? 'completed' : 'active'),
  templateId: s.templateId ?? null,
  notes: s.notes ?? '',
  rating: s.rating ?? null,
  totalVolume: s.totalVolume ?? 0,
  caloriesBurned: s.caloriesBurned ?? null,
  createdAt: s.createdAt ?? s.startTime ?? new Date().toISOString(),
  updatedAt: s.updatedAt ?? s.createdAt ?? s.startTime ?? new Date().toISOString(),
});

export const toCanonicalPersonalExercise = (e: PersonalExercise): CanonicalPersonalExercise => ({
  ...e,
  id: e.id,
  name: e.name,
});

export const toCanonicalBodyWeight = (b: BodyWeightEntry): CanonicalBodyWeightEntry => ({
  id: b.id,
  date: b.date,
  weight: b.weight,
  notes: b.notes,
  createdAt: b.createdAt ?? new Date().toISOString(),
});

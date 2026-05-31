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
import { toLocalDateStr } from '../utils/dateUtils';
import { logger } from '../utils/logger';

export interface WorkoutTemplate {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  exercises: unknown[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
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
  deletedAt?: string | null;
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
  deletedAt?: string | null;
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
  deletedAt?: string | null;
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
  deletedAt?: string | null;
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
  deletedAt?: string | null;
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
  deletedAt?: string | null;
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
  deletedAt?: string | null;
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

// ---------------------------------------------------------------------------
// Runtime guards for the Supabase boundary.
// zod is not a dependency, so these small hand-rolled checks stand in for a
// schema: they verify `exercises` is an array and each `sets` entry carries the
// expected primitive fields, coercing bad values to a safe shape rather than
// blindly casting unknown[] from the DB into the canonical types.
// ---------------------------------------------------------------------------

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Coerce a value to a finite number, falling back to `fallback` otherwise. */
const toFiniteNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/** Sanitize a single set: keep known fields, coerce numerics, drop garbage. */
const sanitizeSet = (raw: unknown): Record<string, unknown> => {
  if (!isPlainObject(raw)) return { weight: 0, reps: 0 };
  return {
    ...raw,
    weight: toFiniteNumber(raw.weight, 0),
    reps: toFiniteNumber(raw.reps, 0),
  };
};

/**
 * Validate and sanitize the `exercises[].sets[]` structure coming from the DB.
 * Non-array input falls back to `[]`; non-object exercises are dropped; each
 * exercise's `sets` is normalized to an array of well-formed set objects.
 * Malformed input is reported via logger.warn (never silently swallowed).
 */
const sanitizeExercises = (raw: unknown, context: string): Record<string, unknown>[] => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    logger.sync.warn(`${context}: exercises is not an array, defaulting to []`, {
      received: typeof raw,
    });
    return [];
  }
  return raw.reduce<Record<string, unknown>[]>((acc, entry) => {
    if (!isPlainObject(entry)) {
      logger.sync.warn(`${context}: dropping non-object exercise entry`, { entry });
      return acc;
    }
    const rawSets = entry.sets;
    let sets: Record<string, unknown>[];
    if (rawSets === undefined || rawSets === null) {
      sets = [];
    } else if (Array.isArray(rawSets)) {
      sets = rawSets.map(sanitizeSet);
    } else {
      logger.sync.warn(`${context}: exercise.sets is not an array, defaulting to []`, {
        received: typeof rawSets,
      });
      sets = [];
    }
    acc.push({ ...entry, sets });
    return acc;
  }, []);
};

export const toCanonicalTemplate = (t: WorkoutTemplate): CanonicalWorkoutTemplate => ({
  id: t.id,
  name: t.name,
  description: t.description ?? '',
  exercises: sanitizeExercises(
    t.exercises,
    'toCanonicalTemplate'
  ) as unknown as CanonicalWorkoutTemplate['exercises'],
  createdAt: t.createdAt ?? new Date().toISOString(),
  updatedAt: t.updatedAt ?? t.createdAt ?? new Date().toISOString(),
  lastUsed: t.lastUsed ?? null,
  timesUsed: t.timesUsed ?? 0,
  isFavorite: t.isFavorite ?? false,
  ...(t.muscleGroups !== undefined && { muscleGroups: t.muscleGroups }),
  ...(t.isBuiltin !== undefined && { isBuiltin: t.isBuiltin }),
  ...(t.deletedAt !== undefined && { deletedAt: t.deletedAt }),
});

export const toCanonicalSession = (s: WorkoutSession): CanonicalWorkoutSession => ({
  id: s.id,
  date: s.date ?? (s.startTime ? s.startTime.slice(0, 10) : toLocalDateStr(new Date())),
  startTime: s.startTime,
  endTime: s.endTime ?? null,
  exercises: sanitizeExercises(
    s.exercises,
    'toCanonicalSession'
  ) as unknown as CanonicalWorkoutSession['exercises'],
  duration: s.duration ?? 0,
  status: s.status ?? (s.endTime ? 'completed' : 'active'),
  templateId: s.templateId ?? null,
  notes: s.notes ?? '',
  rating: s.rating ?? null,
  totalVolume: s.totalVolume ?? 0,
  caloriesBurned: s.caloriesBurned ?? null,
  createdAt: s.createdAt ?? s.startTime ?? new Date().toISOString(),
  updatedAt: s.updatedAt ?? s.createdAt ?? s.startTime ?? new Date().toISOString(),
  ...(s.deletedAt !== undefined && { deletedAt: s.deletedAt }),
});

export const toCanonicalPersonalExercise = (e: PersonalExercise): CanonicalPersonalExercise => ({
  ...e,
  id: e.id,
  name: e.name,
  ...(e.deletedAt !== undefined && { deletedAt: e.deletedAt }),
});

export const toCanonicalBodyWeight = (b: BodyWeightEntry): CanonicalBodyWeightEntry => ({
  id: b.id,
  date: b.date,
  weight: b.weight,
  notes: b.notes,
  createdAt: b.createdAt ?? new Date().toISOString(),
  ...(b.deletedAt !== undefined && { deletedAt: b.deletedAt }),
});

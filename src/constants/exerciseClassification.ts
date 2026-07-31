// ============================================================================
// Exercise classification — Hebrew vocabulary + fine→coarse muscle mapping
// ============================================================================
// The catalog classifies every exercise on three axes borrowed from the standard
// free-exercise-db vocabulary (mechanic / force / level) plus a fine-grained
// prime mover. `constants/muscleNames` already owns the COARSE muscle group that
// groups the library into tabs (חזה / גב / רגליים…); this module owns everything
// one level below it, and is the single place that turns those keys into Hebrew.
//
// Terms are the ones used in an Israeli gym rather than literal translations: a
// compound lift is a "תרגיל מורכב", lats are "גב רחב", calves are "תאומים".
// ============================================================================

import type { ExerciseForce, ExerciseLevel, ExerciseMechanic } from '../types';
import { muscleLabel, translateMuscle } from './muscleNames';

// ----------------------------------------------------------------------------
// Mechanic — how many joints the movement drives
// ----------------------------------------------------------------------------

export const MECHANIC_KEYS: readonly ExerciseMechanic[] = ['compound', 'isolation'] as const;

const MECHANIC_HE: Record<ExerciseMechanic, string> = {
  compound: 'מורכב',
  isolation: 'בידוד',
};

/** Short explanation shown next to the filter so the term teaches itself. */
const MECHANIC_HINT_HE: Record<ExerciseMechanic, string> = {
  compound: 'כמה מפרקים יחד, מתאים לתחילת האימון',
  isolation: 'מפרק אחד, שריר ממוקד לסיום האימון',
};

export const translateMechanic = (key?: string | null): string =>
  key ? (MECHANIC_HE[key as ExerciseMechanic] ?? key) : '';

export const mechanicHint = (key?: string | null): string =>
  key ? (MECHANIC_HINT_HE[key as ExerciseMechanic] ?? '') : '';

/**
 * Compound before isolation. This is the programming convention — heavy
 * multi-joint work belongs early in a session, while you are fresh.
 */
const MECHANIC_ORDER: Record<ExerciseMechanic, number> = { compound: 0, isolation: 1 };

export const mechanicRank = (key?: string | null): number =>
  MECHANIC_ORDER[key as ExerciseMechanic] ?? 2;

// ----------------------------------------------------------------------------
// Force — direction of resistance
// ----------------------------------------------------------------------------

export const FORCE_KEYS: readonly ExerciseForce[] = ['push', 'pull', 'static'] as const;

const FORCE_HE: Record<ExerciseForce, string> = {
  push: 'דחיפה',
  pull: 'משיכה',
  static: 'החזקה',
};

export const translateForce = (key?: string | null): string =>
  key ? (FORCE_HE[key as ExerciseForce] ?? key) : '';

// ----------------------------------------------------------------------------
// Level — skill and control required
// ----------------------------------------------------------------------------

export const LEVEL_KEYS: readonly ExerciseLevel[] = ['beginner', 'intermediate', 'expert'] as const;

const LEVEL_HE: Record<ExerciseLevel, string> = {
  beginner: 'מתחיל',
  intermediate: 'בינוני',
  expert: 'מתקדם',
};

export const translateLevel = (key?: string | null): string =>
  key ? (LEVEL_HE[key as ExerciseLevel] ?? key) : '';

/** Easiest first, so "sort by level" walks a sensible progression. */
const LEVEL_ORDER: Record<ExerciseLevel, number> = {
  beginner: 0,
  intermediate: 1,
  expert: 2,
};

export const levelRank = (key?: string | null): number => LEVEL_ORDER[key as ExerciseLevel] ?? 3;

// ----------------------------------------------------------------------------
// Fine-grained prime movers
// ----------------------------------------------------------------------------
// Keys match free-exercise-db exactly so catalog data stays comparable with the
// public dataset. Hebrew labels are the gym-floor terms.

export const PRIMARY_MUSCLE_KEYS = [
  'chest',
  'lats',
  'middle back',
  'lower back',
  'traps',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abdominals',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'adductors',
  'abductors',
  'neck',
  'cardio',
] as const;

export type PrimaryMuscleKey = (typeof PRIMARY_MUSCLE_KEYS)[number];

const PRIMARY_MUSCLE_HE: Record<string, string> = {
  chest: 'חזה',
  lats: 'גב רחב',
  'middle back': 'גב אמצעי',
  'lower back': 'גב תחתון',
  traps: 'טרפזים',
  shoulders: 'כתפיים',
  biceps: 'יד קדמית',
  triceps: 'יד אחורית',
  forearms: 'אמות',
  abdominals: 'בטן',
  quadriceps: 'ארבע ראשי',
  hamstrings: 'מיתרי הירך',
  glutes: 'ישבן',
  calves: 'תאומים',
  adductors: 'מקרבי הירך',
  abductors: 'מרחיקי הירך',
  neck: 'צוואר',
  cardio: 'לב-ריאה',
};

/**
 * Hebrew label for a fine-grained muscle key. Falls back to the shared muscle
 * vocabulary (constants/muscleNames) rather than returning the raw English key,
 * so a value this map does not list still reaches the user in Hebrew. Empty
 * returns '' so callers can skip rendering entirely.
 */
export const translatePrimaryMuscle = (key?: string | null): string => {
  if (!key) return '';
  return PRIMARY_MUSCLE_HE[key.toLowerCase()] ?? translateMuscle(key);
};

/**
 * Fine-grained key → the coarse `muscleGroup` the library groups by. Keeping the
 * relationship here (rather than duplicating muscleGroup on every record by
 * hand) is what lets a catalog test prove the two fields never disagree.
 */
const MUSCLE_GROUP_OF: Record<string, string> = {
  chest: 'Chest',
  lats: 'Back',
  'middle back': 'Back',
  'lower back': 'Back',
  traps: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Biceps',
  abdominals: 'Core',
  quadriceps: 'Legs',
  hamstrings: 'Legs',
  glutes: 'Legs',
  calves: 'Legs',
  adductors: 'Legs',
  abductors: 'Legs',
  neck: 'Other',
  cardio: 'Cardio',
};

/** The coarse muscle group a fine-grained prime mover belongs to. */
export const muscleGroupOfPrimary = (key?: string | null): string | undefined =>
  key ? MUSCLE_GROUP_OF[key.toLowerCase()] : undefined;

/**
 * The most specific Hebrew muscle name available for an exercise.
 *
 * Prefers the classified prime mover ("גב רחב", "טרפזים") over the coarse group
 * ("גב"), because the coarse group is a filing category while this is the answer
 * to "what does this actually work". Falls back to the coarse label for
 * user-authored exercises, which are created from a short form and carry no
 * classification.
 */
export const preciseMuscleLabel = (ex: {
  primaryMuscle?: string;
  targetMuscle?: string;
  muscleGroup?: string;
}): string => translatePrimaryMuscle(ex.primaryMuscle) || muscleLabel(ex);

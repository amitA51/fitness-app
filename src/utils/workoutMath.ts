// ============================================================================
// Workout math - shared volume calculations
// ============================================================================
// Single source of truth for set/exercise/session volume so the formula
// (and its warmup-exclusion + null-guard rules) lives in one place.

interface VolumeSet {
  weight?: number;
  reps?: number;
  isWarmup?: boolean;
}

interface VolumeExercise {
  sets?: VolumeSet[];
}

interface VolumeSession {
  exercises?: VolumeExercise[];
}

/**
 * Volume contributed by a single set. Warmup sets contribute 0; missing
 * weight/reps are treated as 0.
 */
export const setVolume = (set: VolumeSet): number =>
  set.isWarmup ? 0 : (set.weight || 0) * (set.reps || 0);

/** Total working-set volume across an exercise's sets. */
export const exerciseVolume = (exercise: VolumeExercise): number =>
  (exercise.sets || []).reduce((sum, set) => sum + setVolume(set), 0);

/** Total working-set volume across all exercises in a session. */
export const sessionVolume = (session: VolumeSession): number =>
  (session.exercises || []).reduce((sum, ex) => sum + exerciseVolume(ex), 0);

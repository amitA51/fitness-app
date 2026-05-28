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

// ============================================================================
// Per-session stats (shared by WorkoutSummary / WorkoutHistoryScreen /
// PerformanceAnalytics). Single source of truth for "how many sets, how much
// volume, how long" so the three screens cannot drift apart.
// ============================================================================

/**
 * Minimal structural shape of a set for stats purposes. Completion is read
 * from EITHER `completedAt` (persisted sessions, a timestamp) OR `completed`
 * (the live in-workout shape, a boolean) — whichever a given call site
 * provides. `rpe` is optional and only used when present.
 */
export interface StatsSet {
  weight?: number;
  reps?: number;
  isWarmup?: boolean;
  /** Persisted shape: a timestamp string (or null) once the set is done. */
  completedAt?: string | null;
  /** Live in-workout shape: a boolean completion flag. */
  completed?: boolean;
  rpe?: number | null;
}

/** Minimal structural shape of an exercise for stats purposes. */
export interface StatsExercise {
  name?: string;
  sets?: StatsSet[];
  /** Live in-workout shape: planned set count (drives total/progress). */
  targetSets?: number;
}

/** Minimal structural shape of a session for stats purposes. */
export interface StatsSession {
  exercises?: StatsExercise[];
}

export interface SessionStatsOptions {
  /**
   * When true, warmup sets are excluded from every metric (the WorkoutSummary
   * behavior). When false, warmup sets are counted (the WorkoutHistoryScreen
   * behavior). Defaults to false.
   */
  excludeWarmup?: boolean;
  /**
   * When true, a set only contributes its volume/reps if it ALSO has a truthy
   * weight and reps (the persisted-session behavior). The set still counts
   * toward `completedSets`. Defaults to true.
   */
  requireWeightAndReps?: boolean;
  /**
   * How `totalSets` is computed. `'completed'` returns the number of completed
   * sets; `'target'` returns the sum of each exercise's `targetSets` (the live
   * PerformanceAnalytics behavior). Defaults to `'completed'`.
   */
  totalSetsMode?: 'completed' | 'target';
}

/** Per-exercise breakdown returned alongside the session totals. */
export interface ExerciseStats {
  name: string | undefined;
  /** Number of completed sets in this exercise (after warmup filtering). */
  setsCompleted: number;
  /** Working volume of this exercise's completed sets. */
  totalVolume: number;
  /** Heaviest-by-volume completed set, if any. */
  bestSet?: { weight: number; reps: number };
}

export interface SessionStats {
  totalVolume: number;
  /** Completed sets, or sum of targetSets when `totalSetsMode: 'target'`. */
  totalSets: number;
  completedSets: number;
  totalReps: number;
  /** Number of exercises with at least one completed set. */
  exerciseCount: number;
  /** Average RPE across completed sets that carry an rpe, else null. */
  avgRPE: number | null;
  exerciseStats: ExerciseStats[];
}

/** True when a set counts as "completed" under either data shape. */
const isSetCompleted = (set: StatsSet): boolean =>
  set.completed === true || Boolean(set.completedAt);

/**
 * Compute per-session stats from a session-like object, reproducing each call
 * site's existing numbers via the documented options. Reuses `setVolume` for
 * the per-set volume rule (warmup => 0, missing weight/reps => 0).
 */
export const computeSessionStats = (
  session: StatsSession,
  options: SessionStatsOptions = {}
): SessionStats => {
  const {
    excludeWarmup = false,
    requireWeightAndReps = true,
    totalSetsMode = 'completed',
  } = options;

  const exercises = session.exercises || [];
  const consideredSets = (ex: StatsExercise): StatsSet[] =>
    (ex.sets || []).filter((s) => !excludeWarmup || !s.isWarmup);

  const countsForVolume = (set: StatsSet): boolean =>
    isSetCompleted(set) && (!requireWeightAndReps || Boolean(set.weight && set.reps));

  const rpes: number[] = [];
  let totalVolume = 0;
  let completedSets = 0;
  let totalReps = 0;
  let targetSetsTotal = 0;

  const exerciseStats: ExerciseStats[] = [];

  for (const ex of exercises) {
    targetSetsTotal += ex.targetSets || 0;
    const sets = consideredSets(ex);

    let exerciseVolumeSum = 0;
    let exerciseCompleted = 0;
    let bestSet: { weight: number; reps: number } | undefined;
    let bestVolume = 0;

    for (const set of sets) {
      if (!isSetCompleted(set)) continue;
      exerciseCompleted += 1;
      completedSets += 1;

      if (typeof set.rpe === 'number') rpes.push(set.rpe);

      // Reps are counted whenever the completed set has reps, independent of
      // the weight requirement that gates volume (matches WorkoutSummary).
      if (set.reps) totalReps += set.reps;

      if (countsForVolume(set)) {
        const vol = setVolume(set);
        totalVolume += vol;
        exerciseVolumeSum += vol;
        if (set.weight && set.reps && vol > bestVolume) {
          bestVolume = vol;
          bestSet = { weight: set.weight, reps: set.reps };
        }
      }
    }

    exerciseStats.push({
      name: ex.name,
      setsCompleted: exerciseCompleted,
      totalVolume: exerciseVolumeSum,
      bestSet,
    });
  }

  const completedExerciseStats = exerciseStats.filter((e) => e.setsCompleted > 0);
  const avgRPE = rpes.length > 0 ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;

  return {
    totalVolume,
    totalSets: totalSetsMode === 'target' ? targetSetsTotal : completedSets,
    completedSets,
    totalReps,
    exerciseCount: completedExerciseStats.length,
    avgRPE,
    exerciseStats: completedExerciseStats,
  };
};

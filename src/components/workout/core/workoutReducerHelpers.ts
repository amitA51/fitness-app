import type { WorkoutSet } from '../../../types';
import type { WorkoutSettings } from '../../../types';
import { DEFAULT_WORKOUT_SETTINGS } from '../hooks/useWorkoutSettings';
import { resolveActiveSet } from './setHelpers';

// ============================================================
// CONSTANTS
// ============================================================

/**
 * Short transitional rest (seconds) inserted between exercises of a superset
 * round, before the full `restBetweenRounds` rest at the end of a round.
 * Named constant — replaces the former magic 15.
 */
export const SUPERSET_TRANSITION_REST = 15;

/** Fallback rest (seconds) between superset rounds when none is configured. */
export const DEFAULT_SUPERSET_ROUND_REST = 60;

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Parse rest time strings from program data (e.g. "2-3 min", "90 sec", "3 דק'")
 * Returns seconds. For ranges, uses the average.
 */
const parseRestTimeString = (str: string): number => {
  const s = str.toLowerCase().trim();

  // Match patterns like "2-3 min", "2-3 דקות", "90-120 sec"
  const rangeMatch = s.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(min|sec|דק|שנ)/i);
  if (rangeMatch) {
    const low = Number.parseFloat(rangeMatch[1]!);
    const high = Number.parseFloat(rangeMatch[2]!);
    const unit = rangeMatch[3]!;
    const avg = (low + high) / 2;
    if (unit.startsWith('min') || unit.startsWith('דק')) return Math.round(avg * 60);
    return Math.round(avg);
  }

  // Match patterns like "3 min", "90 sec", "2 דקות"
  const singleMatch = s.match(/(\d+(?:\.\d+)?)\s*(min|sec|דק|שנ)/i);
  if (singleMatch) {
    const val = Number.parseFloat(singleMatch[1]!);
    const unit = singleMatch[2]!;
    if (unit.startsWith('min') || unit.startsWith('דק')) return Math.round(val * 60);
    return Math.round(val);
  }

  // Plain number (assume seconds)
  const num = Number.parseFloat(s);
  if (!Number.isNaN(num)) return Math.round(num);

  return 0;
};

/**
 * Calculate smart rest time based on priority: superset > programExtras > targetRestTime > smartRest > default
 */
export const calculateRestTime = (
  settings: WorkoutSettings | undefined,
  exercise: {
    muscleGroup?: string;
    targetRestTime?: number;
    programExtras?: { restTime?: unknown };
  },
  supersetShortRest: number | null,
  isDropSet: boolean
): number => {
  if (isDropSet) return 0;

  let restTime = settings?.defaultRestTime ?? DEFAULT_WORKOUT_SETTINGS.defaultRestTime;

  if (supersetShortRest !== null) {
    restTime = supersetShortRest;
  }
  // 1. Program-prescribed rest time
  else if (exercise.programExtras?.restTime) {
    const parsed = parseRestTimeString(String(exercise.programExtras.restTime));
    if (parsed > 0) restTime = parsed;
  }
  // 2. Exercise-specific target rest
  else if (exercise.targetRestTime) {
    restTime = exercise.targetRestTime;
  }
  // 3. Smart Rest Logic based on muscle group
  else if (settings?.smartRestEnabled) {
    if (exercise.muscleGroup === 'Legs' || exercise.muscleGroup === 'Back') {
      restTime = settings?.longRestTime ?? DEFAULT_WORKOUT_SETTINGS.longRestTime;
    } else if (exercise.muscleGroup === 'Arms' || exercise.muscleGroup === 'Shoulders') {
      restTime = settings?.shortRestTime ?? DEFAULT_WORKOUT_SETTINGS.shortRestTime;
    } else {
      restTime = settings?.mediumRestTime ?? DEFAULT_WORKOUT_SETTINGS.mediumRestTime;
    }

    // 4. Scale by training goal — INTENTIONALLY scoped to the smart-rest path
    // only. The plain `defaultRestTime` (and program/target rest) are explicit
    // user/coach choices, so we don't second-guess them by goal. Goal scaling
    // applies solely to the auto-derived smart-rest base computed just above.
    const goal = settings?.defaultWorkoutGoal;
    const factor = goal === 'strength' ? 1.8 : goal === 'endurance' ? 0.5 : 1.0; // hypertrophy/maintenance/general
    restTime = Math.round(restTime * factor);
    // Sanity clamp
    if (restTime < 30) restTime = 30;
    if (restTime > 600) restTime = 600;
  }

  return restTime;
};

export const createNextSet = (
  currentSet: WorkoutSet,
  nextSetNumber: number,
  isTimed = false
): WorkoutSet => {
  const base: WorkoutSet = {
    id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    setNumber: nextSetNumber,
    reps: isTimed ? 0 : currentSet.reps, // reps don't apply to timed sets
    weight: currentSet.weight, // weight still applies (e.g., loaded carry, weighted plank)
    notes: '',
    rpe: null,
    isWarmup: false,
    isCompleted: false,
    completedAt: null,
  };
  if (isTimed) {
    base.duration = currentSet.duration ?? 0; // inherit previous duration
  }
  return base;
};

/**
 * Create a new empty set with all required fields
 */
export const createEmptySet = (setNumber: number, isTimed = false): WorkoutSet => {
  const base: WorkoutSet = {
    id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    setNumber,
    reps: 0,
    weight: 0,
    rpe: null,
    isWarmup: false,
    isCompleted: false,
    notes: '',
    completedAt: null,
  };
  if (isTimed) {
    base.duration = 0;
  }
  return base;
};

export const getActiveSetIndex = (sets: WorkoutSet[]): number =>
  resolveActiveSet(sets).activeSetIndex;

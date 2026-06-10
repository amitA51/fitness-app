// workoutSessionBuilder - Pure business logic for building a WorkoutSession.
// Platform-agnostic: no DOM, no window, no localStorage. Reusable in React Native.

import type { ActiveExercise, WorkoutExercise, WorkoutSession } from '../types';
import { toLocalDateStr } from '../utils/dateUtils';
import { generateId } from '../utils/id';
import { setVolume } from '../utils/workoutMath';

export interface BuildSessionInput {
  exercises: ActiveExercise[];
  startTimestamp: number;
  totalPausedTime: number;
  itemId: string;
  goalType?: string;
  /** Override "now" for testability; defaults to Date.now() */
  now?: number;
}

export interface BuildSessionResult {
  session: WorkoutSession;
  completedExercises: WorkoutExercise[];
}

/**
 * Filters exercises to those with at least one completed set,
 * transforms them to WorkoutExercise[], and assembles a full WorkoutSession.
 *
 * Returns null if no exercises have completed sets.
 */
export function buildWorkoutSession(input: BuildSessionInput): BuildSessionResult | null {
  const { exercises, startTimestamp, totalPausedTime, itemId, goalType, now = Date.now() } = input;

  const completedExercises = exercises.filter((ex) => (ex.sets ?? []).some((s) => s.completedAt));

  if (completedExercises.length === 0) return null;

  const workoutExercises: WorkoutExercise[] = completedExercises.map(
    (ex: ActiveExercise, index: number) => ({
      id: ex.id || `ex_${index}`,
      exerciseId: ex.exerciseId || ex.id || `exercise_${index}`,
      exerciseName: ex.name || 'Unknown Exercise',
      targetMuscle: ex.muscleGroup || ex.targetMuscle || 'Other',
      sets: (ex.sets ?? [])
        .filter((s) => s.completedAt)
        .map((s) => ({ ...s, isCompleted: !!s.completedAt })),
      notes: '',
      restSeconds: ex.defaultRestTime || ex.targetRestTime || 90,
      isCompleted: true,
      order: index,
      name: ex.name,
      muscleGroup: ex.muscleGroup,
      tempo: ex.tempo,
      targetRestTime: ex.targetRestTime,
    })
  );

  const sessionDurationSec = Math.floor((now - startTimestamp - totalPausedTime) / 1000);
  const totalVolume = workoutExercises.reduce(
    (sum, ex) => sum + ex.sets.reduce((setSum, s) => setSum + setVolume(s), 0),
    0
  );

  // Calorie estimate: ~0.04 kcal per kg volume + ~5 kcal/min baseline. Cap 1500.
  const minutes = Math.max(0, sessionDurationSec / 60);
  const estCalories = Math.min(1500, Math.round(totalVolume * 0.04 + minutes * 5));

  const endTimeISO = new Date(now).toISOString();

  const session: WorkoutSession = {
    // UUID, never a prefixed string — cloud workout_sessions.id is uuid and
    // PostgREST rejects `session_<ts>` ids with 22P02 (sync silently dropped).
    id: crypto.randomUUID?.() || generateId('session'),
    userId: 'local_user',
    workoutItemId: itemId,
    startTime: new Date(startTimestamp).toISOString(),
    endTime: endTimeISO,
    // Local calendar day, not endTimeISO.slice(0,10) (UTC) — for users ahead of
    // UTC a late-evening finish would otherwise key to the next calendar day.
    date: toLocalDateStr(new Date(now)),
    // CANONICAL: duration is stored in SECONDS. All consumers must treat
    // session.duration as seconds and format via utils/workoutFormatters
    // (formatDuration) — never render it as raw minutes.
    duration: sessionDurationSec,
    status: 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume,
    caloriesBurned: estCalories > 0 ? estCalories : null,
    goalType,
    exercises: workoutExercises,
    createdAt: endTimeISO,
    updatedAt: endTimeISO,
  };

  return { session, completedExercises: workoutExercises };
}

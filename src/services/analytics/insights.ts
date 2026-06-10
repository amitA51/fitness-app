// ============================================================================
// SPARKOS FITNESS - Analytics Service: useFitnessInsights hook helpers
// ============================================================================

import type { WorkoutSession } from '../../types';
import { todayStr } from '../../utils/dateUtils';
import { completedSetsVolume, oneRepMax } from '../../utils/workoutMath';
import { computeSessionVolume, parseLocalDate } from './shared';

// ============================================================================
// Additional exports for useFitnessInsights hook
// ============================================================================

export interface LastWorkoutSummary {
  date: string;
  duration: number;
  exerciseCount: number;
  totalVolume: number;
  muscleGroups: string[];
}

export interface MuscleGroupLastTrained {
  muscle: string;
  lastDate: string | null;
  daysSince: number;
}

export interface ProgressDelta {
  exerciseName: string;
  exerciseId: string;
  currentVolume: number;
  previousVolume: number;
  change: number;
}

export interface StrengthProgressPoint {
  date: string;
  estimated1RM: number;
  volume: number;
}

export const getLastWorkoutSummary = (sessions: WorkoutSession[]): LastWorkoutSummary | null => {
  const completed = sessions.filter((s) => s.status === 'completed');
  if (completed.length === 0) return null;
  const last = completed.reduce((latest, s) =>
    new Date(s.startTime).getTime() > new Date(latest.startTime).getTime() ? s : latest
  );
  const muscles = new Set<string>();
  last.exercises.forEach((e) => {
    const m = e.muscleGroup || e.targetMuscle;
    if (m) muscles.add(m);
  });
  return {
    date: last.date,
    duration: last.duration,
    exerciseCount: last.exercises.length,
    totalVolume: computeSessionVolume(last),
    muscleGroups: Array.from(muscles),
  };
};

export const getMuscleGroupDaysSince = (sessions: WorkoutSession[]): MuscleGroupLastTrained[] => {
  const muscleLastDate = new Map<string, string>();
  for (const session of sessions) {
    if (session.status !== 'completed') continue;
    for (const exercise of session.exercises) {
      const muscle = exercise.muscleGroup || exercise.targetMuscle;
      if (muscle) {
        const existing = muscleLastDate.get(muscle);
        if (!existing || session.date > existing) {
          muscleLastDate.set(muscle, session.date);
        }
      }
    }
  }
  const today = todayStr();
  return Array.from(muscleLastDate.entries()).map(([muscle, date]) => ({
    muscle,
    lastDate: date,
    daysSince: Math.floor(
      (parseLocalDate(today).getTime() - parseLocalDate(date).getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));
};

export const getAllExerciseNames = (sessions: WorkoutSession[]): string[] => {
  const names = new Set<string>();
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      names.add(exercise.exerciseName);
    }
  }
  return Array.from(names).sort();
};

export const calculateStrengthProgression = (
  sessions: WorkoutSession[],
  exerciseId: string
): StrengthProgressPoint[] => {
  return sessions
    .filter((s) => s.status === 'completed')
    .reduce<StrengthProgressPoint[]>((points, session) => {
      for (const exercise of session.exercises) {
        if (exercise.exerciseId !== exerciseId) continue;
        // Epley 1RM must use weight and reps from the SAME set, so evaluate
        // it per-set and keep the best; taking max(weight) and max(reps)
        // independently across sets inflates the estimate.
        let best1RM = 0;
        for (const set of exercise.sets) {
          if (set.isCompleted && !set.isWarmup) {
            // Canonical Epley (handles reps===1 + 0.1 rounding) so the chart's
            // 1RM matches the PR/AI pipeline for the same set (SM-2).
            const est = oneRepMax(set.weight, set.reps);
            if (est > best1RM) best1RM = est;
          }
        }
        const volume = completedSetsVolume(exercise.sets);
        if (best1RM === 0 && volume === 0) continue;
        points.push({ date: session.date, estimated1RM: best1RM, volume });
      }
      return points;
    }, [])
    .sort((a, b) => a.date.localeCompare(b.date));
};

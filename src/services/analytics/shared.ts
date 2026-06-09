// ============================================================================
// SPARKOS FITNESS - Analytics Service: shared helpers
// ============================================================================

import type { WorkoutSession } from '../../types';
import { pad2 } from '../../utils/dateUtils';
import {
  completedSetsVolume,
  computeSessionStats as computeSessionStatsSSOT,
} from '../../utils/workoutMath';

// ============================================================================
// Helpers
// ============================================================================

/** Parse a YYYY-MM-DD string as local midnight (avoids UTC-shift from `new Date(str)`). */
export const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y!, (m || 1) - 1, d || 1);
};

/** Format a local Date as YYYY-MM-DD string. */
export const formatLocalDateStr = (d: Date): string =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function linearRegression(points: { x: number; y: number }[]): {
  slope: number;
  intercept: number;
  rSquared: number;
} {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };

  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return { slope: 0, intercept: sumY / n, rSquared: 0 };

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const yMean = sumY / n;
  const ssRes = points.reduce((s, p) => s + (p.y - (slope * p.x + intercept)) ** 2, 0);
  const ssTot = points.reduce((s, p) => s + (p.y - yMean) ** 2, 0);
  const rSquared = ssTot === 0 ? 0 : Math.max(0, 1 - ssRes / ssTot);

  return { slope, intercept, rSquared };
}

/** Compute effective volume for a single session from its sets (sets x reps x weight). */
export function computeSessionVolume(session: WorkoutSession): number {
  let total = 0;
  for (const exercise of session.exercises) {
    total += completedSetsVolume(exercise.sets);
  }
  return total;
}

/** Compute total sets, total reps, and volume for a session (only completed, non-warmup sets). */
export function computeSessionStats(session: WorkoutSession): {
  volume: number;
  sets: number;
  reps: number;
} {
  // Delegate to the workoutMath single source of truth so the volume/sets/reps
  // formula (and its warmup-exclusion + completion rules) lives in one place.
  const stats = computeSessionStatsSSOT(session, {
    excludeWarmup: true,
    requireWeightAndReps: true,
  });
  return { volume: stats.totalVolume, sets: stats.completedSets, reps: stats.totalReps };
}

/** Get the muscle key for an exercise: prefer muscleGroup, fallback to targetMuscle. */
export function getMuscleKey(exercise: { muscleGroup?: string; targetMuscle: string }): string {
  return exercise.muscleGroup || exercise.targetMuscle || 'Unknown';
}

/** Filter sessions to the last N weeks from now. */
export function filterByWeeks(sessions: WorkoutSession[], weeks?: number): WorkoutSession[] {
  if (!weeks || weeks <= 0) return sessions;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  const cutoffStr = formatLocalDateStr(cutoff);
  return sessions.filter((s) => s.date >= cutoffStr);
}

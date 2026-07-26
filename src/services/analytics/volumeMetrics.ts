// ============================================================================
// SPARKOS FITNESS - Analytics Service: weekly volume, balance, forecast, progress
// ============================================================================

import type { WorkoutSession } from '../../types';
import { todayStr } from '../../utils/dateUtils';
import { setVolume } from '../../utils/workoutMath';
import { getWorkoutSessions } from '../workoutDb';
import {
  computeSessionStats,
  filterByWeeks,
  formatLocalDateStr,
  getISOWeek,
  getMuscleKey,
  linearRegression,
  parseLocalDate,
} from './shared';

// ============================================================================
// New Exported Interfaces
// ============================================================================

export interface WeeklyVolume {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  sessionCount: number;
  byMuscle: Record<string, number>;
  byExercise: Record<string, number>;
  changeFromPrevious: number | null;
}

export interface MuscleBalanceData {
  muscle: string;
  volume: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
  isWeak: boolean;
}

export interface ForecastData {
  predicted: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  confidence: number;
  dataPoints: { week: string; actual: number }[];
}

export interface ExerciseProgressData {
  dataPoints: { date: string; volume: number; maxWeight: number; maxReps: number }[];
  currentVolume: number;
  previousVolume: number;
  change: number;
}

// ============================================================================
// Helpers
// ============================================================================

/** Absolute slope threshold (kg/week) for classifying volume trend direction. */
const FORECAST_SLOPE_THRESHOLD = 10;

/** Ratio threshold for muscle-balance trend detection (5% change). */
const MUSCLE_BALANCE_TREND_THRESHOLD = 0.05;

// ============================================================================
// New Analytics Functions
// ============================================================================

export const calculateWeeklyVolumes = (
  sessions: WorkoutSession[],
  weeks?: number
): WeeklyVolume[] => {
  const filtered = filterByWeeks(sessions, weeks);
  const completedSessions = filtered.filter((s) => s.status === 'completed');

  // Group sessions by ISO week
  const weekGroupMap = new Map<string, WorkoutSession[]>();
  for (const session of completedSessions) {
    const weekKey = getISOWeek(parseLocalDate(session.date));
    const group = weekGroupMap.get(weekKey);
    if (group) {
      group.push(session);
    } else {
      weekGroupMap.set(weekKey, [session]);
    }
  }

  // Sort weeks chronologically
  const sortedWeeks = Array.from(weekGroupMap.entries()).sort(([a], [b]) => a.localeCompare(b));

  const result: WeeklyVolume[] = [];

  for (let i = 0; i < sortedWeeks.length; i++) {
    const entry = sortedWeeks[i];
    if (!entry) continue;
    const [weekKey, weekSessions] = entry;
    const byMuscle: Record<string, number> = {};
    const byExercise: Record<string, number> = {};
    let totalVolume = 0;
    let totalSets = 0;
    let totalReps = 0;

    for (const session of weekSessions) {
      const stats = computeSessionStats(session);
      totalVolume += stats.volume;
      totalSets += stats.sets;
      totalReps += stats.reps;

      for (const exercise of session.exercises) {
        const muscle = getMuscleKey(exercise);
        let exerciseVolume = 0;
        for (const set of exercise.sets) {
          if (set.isCompleted && !set.isWarmup) {
            const setVol = setVolume(set);
            exerciseVolume += setVol;
            byMuscle[muscle] = (byMuscle[muscle] || 0) + setVol;
          }
        }
        byExercise[exercise.exerciseName] =
          (byExercise[exercise.exerciseName] || 0) + exerciseVolume;
      }
    }

    // Compute week-over-week percentage change
    let changeFromPrevious: number | null = null;
    if (i > 0) {
      const prev = result[i - 1];
      const prevVolume = prev ? prev.totalVolume : 0;
      if (prevVolume > 0) {
        changeFromPrevious = Math.round(((totalVolume - prevVolume) / prevVolume) * 100);
      }
    }

    // Compute week start and end dates from the sessions in the group
    const dates = weekSessions.map((s) => s.date).sort();
    const weekStart = dates[0] ?? '';
    const weekEnd = dates[dates.length - 1] ?? '';

    result.push({
      weekLabel: weekKey,
      weekStart,
      weekEnd,
      totalVolume,
      totalSets,
      totalReps,
      sessionCount: weekSessions.length,
      byMuscle,
      byExercise,
      changeFromPrevious,
    });
  }

  return result;
};

export const calculateMuscleBalance = (
  sessions: WorkoutSession[],
  weeks?: number
): MuscleBalanceData[] => {
  const filtered = filterByWeeks(sessions, weeks);
  const completedSessions = filtered
    .filter((s) => s.status === 'completed')
    .sort((a, b) => a.date.localeCompare(b.date));

  // Split into current and previous halves for trend comparison
  const midpoint = Math.floor(completedSessions.length / 2);
  const previousSessions = completedSessions.slice(0, midpoint);
  const currentSessions = completedSessions.slice(midpoint);

  // Compute muscle volumes for each half
  const computeMuscleVolumes = (list: WorkoutSession[]): Map<string, number> => {
    const map = new Map<string, number>();
    for (const session of list) {
      for (const exercise of session.exercises) {
        const muscle = getMuscleKey(exercise);
        for (const set of exercise.sets) {
          if (set.isCompleted && !set.isWarmup) {
            map.set(muscle, (map.get(muscle) || 0) + setVolume(set));
          }
        }
      }
    }
    return map;
  };

  const currentVolumes = computeMuscleVolumes(currentSessions);
  const previousVolumes = computeMuscleVolumes(previousSessions);

  const currentCount = currentSessions.length || 1;
  const previousCount = previousSessions.length || 1;

  const totalCurrentVolume = Array.from(currentVolumes.values()).reduce((s, v) => s + v, 0);
  const averageVolume =
    totalCurrentVolume > 0 && currentVolumes.size > 0
      ? totalCurrentVolume / currentVolumes.size
      : 0;

  // Collect all muscles from both periods
  const allMuscles = new Set([...currentVolumes.keys(), ...previousVolumes.keys()]);

  const result: MuscleBalanceData[] = [];

  for (const muscle of allMuscles) {
    const current = currentVolumes.get(muscle) || 0;
    const previous = previousVolumes.get(muscle) || 0;
    const percentage =
      totalCurrentVolume > 0 ? Math.round((current / totalCurrentVolume) * 100) : 0;

    // Normalize by session count for fair trend comparison
    const currentAvg = current / currentCount;
    const previousAvg = previous / previousCount;

    let trend: 'up' | 'down' | 'stable';
    if (previousAvg === 0 && currentAvg === 0) {
      trend = 'stable';
    } else if (previousAvg === 0) {
      trend = 'up';
    } else {
      const changeRatio = (currentAvg - previousAvg) / previousAvg;
      if (changeRatio > MUSCLE_BALANCE_TREND_THRESHOLD) {
        trend = 'up';
      } else if (changeRatio < -MUSCLE_BALANCE_TREND_THRESHOLD) {
        trend = 'down';
      } else {
        trend = 'stable';
      }
    }

    const isWeak = averageVolume > 0 && current < averageVolume * 0.8;

    result.push({
      muscle,
      volume: current,
      percentage,
      trend,
      isWeak,
    });
  }

  // Sort by volume descending
  return result.sort((a, b) => b.volume - a.volume);
};

export const forecastProgress = (
  sessions: WorkoutSession[],
  exerciseId?: string,
  weeks?: number
): ForecastData => {
  const filtered = filterByWeeks(sessions, weeks);
  const completedSessions = filtered.filter((s) => s.status === 'completed');

  // Compute volume per week
  const weeklyVolumes = calculateWeeklyVolumes(completedSessions);

  // If exerciseId is provided, compute exercise-specific volume per week
  const dataPoints: { week: string; actual: number }[] = [];

  if (exerciseId) {
    const weekMap = new Map<string, number>();
    for (const session of completedSessions) {
      let exerciseVol = 0;
      for (const exercise of session.exercises) {
        if (exercise.exerciseId === exerciseId) {
          for (const set of exercise.sets) {
            if (set.isCompleted && !set.isWarmup) {
              exerciseVol += setVolume(set);
            }
          }
        }
      }
      if (exerciseVol > 0) {
        const weekKey = getISOWeek(parseLocalDate(session.date));
        weekMap.set(weekKey, (weekMap.get(weekKey) || 0) + exerciseVol);
      }
    }

    const sorted = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (const [week, vol] of sorted) {
      dataPoints.push({ week, actual: vol });
    }
  } else {
    for (const wv of weeklyVolumes) {
      dataPoints.push({ week: wv.weekLabel, actual: wv.totalVolume });
    }
  }

  if (dataPoints.length < 2) {
    const lastActual = dataPoints[dataPoints.length - 1]?.actual ?? 0;
    return {
      predicted: lastActual,
      trend: 'stable',
      confidence: 0,
      dataPoints,
    };
  }

  // Run linear regression
  const points = dataPoints.map((dp, index) => ({ x: index, y: dp.actual }));
  const { slope, intercept, rSquared } = linearRegression(points);

  // Predict next week (volume/1RM cannot be negative, so clamp to 0)
  const nextX = dataPoints.length;
  const predicted = Math.max(0, Math.round(slope * nextX + intercept));

  let trend: 'increasing' | 'decreasing' | 'stable';
  if (slope > FORECAST_SLOPE_THRESHOLD) {
    trend = 'increasing';
  } else if (slope < -FORECAST_SLOPE_THRESHOLD) {
    trend = 'decreasing';
  } else {
    trend = 'stable';
  }

  return {
    predicted,
    trend,
    confidence: Math.max(0, Math.min(1, rSquared)),
    dataPoints,
  };
};

export const getExerciseProgress = (
  sessions: WorkoutSession[],
  exerciseId: string,
  weeks?: number
): ExerciseProgressData => {
  const filtered = filterByWeeks(sessions, weeks);
  const completedSessions = filtered.filter((s) => s.status === 'completed');

  // Find all sessions containing the exercise
  const relevantSessions = completedSessions.filter((session) =>
    session.exercises.some((e) => e.exerciseId === exerciseId)
  );

  // Build data points per session date
  const dataPoints: ExerciseProgressData['dataPoints'] = [];

  for (const session of relevantSessions) {
    let volume = 0;
    let maxWeight = 0;
    let maxReps = 0;

    for (const exercise of session.exercises) {
      if (exercise.exerciseId !== exerciseId) continue;

      for (const set of exercise.sets) {
        if (set.isCompleted && !set.isWarmup) {
          volume += setVolume(set);
          if (set.weight > maxWeight) maxWeight = set.weight;
          if (set.reps > maxReps) maxReps = set.reps;
        }
      }
    }

    dataPoints.push({
      date: session.date,
      volume,
      maxWeight,
      maxReps,
    });
  }

  // Sort by date ascending
  dataPoints.sort((a, b) => a.date.localeCompare(b.date));

  // Compute change: compare current half vs previous half
  const mid = Math.floor(dataPoints.length / 2);
  const previousHalf = dataPoints.slice(0, mid);
  const currentHalf = dataPoints.slice(mid);

  const previousVolume = previousHalf.reduce((s, dp) => s + dp.volume, 0);
  const currentVolume = currentHalf.reduce((s, dp) => s + dp.volume, 0);

  let change = 0;
  if (previousVolume > 0) {
    change = Math.round(((currentVolume - previousVolume) / previousVolume) * 100);
  }

  return {
    dataPoints,
    currentVolume,
    previousVolume,
    change,
  };
};

export const getProgressData = async (
  exerciseId: string,
  weeks = 12
): Promise<{ date: string; value: number }[]> => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  const startDate = formatLocalDateStr(cutoff);
  const endDate = todayStr();

  let sessions: WorkoutSession[];
  try {
    const all = await getWorkoutSessions(1000);
    sessions = all.filter((s: WorkoutSession) => s.date >= startDate && s.date <= endDate);
  } catch {
    sessions = [];
  }

  return getExerciseProgress(sessions, exerciseId, weeks).dataPoints.map((dp) => ({
    date: dp.date,
    value: dp.volume,
  }));
};

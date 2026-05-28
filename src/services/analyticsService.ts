// ============================================================================
// SPARKOS FITNESS - Analytics Service
// ============================================================================

import type { PersonalRecord, WorkoutSession } from '../types';
import { HEBREW_DAYS } from '../utils/dateUtils';
import { setVolume } from '../utils/workoutMath';

// ============================================================================
// Exported Interfaces (original)
// ============================================================================

export interface AnalyticsSummary {
  totalWorkouts: number;
  totalVolume: number;
  totalDuration: number;
  averageDuration: number;
  mostTrainedMuscles: string[];
  weeklyFrequency: number[];
  personalRecords: PersonalRecord[];
}

export interface VolumeDataPoint {
  date: string;
  volume: number;
  sets: number;
}

export interface FrequencyData {
  day: string;
  count: number;
}

export interface MuscleGroupData {
  muscle: string;
  volume: number;
  percentage: number;
}

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

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function linearRegression(points: { x: number; y: number }[]): {
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
  const ssRes = points.reduce((s, p) => s + Math.pow(p.y - (slope * p.x + intercept), 2), 0);
  const ssTot = points.reduce((s, p) => s + Math.pow(p.y - yMean, 2), 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared };
}

/** Compute effective volume for a single session from its sets (sets x reps x weight). */
function computeSessionVolume(session: WorkoutSession): number {
  let total = 0;
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.isCompleted) {
        total += setVolume(set);
      }
    }
  }
  return total;
}

/** Compute total sets, total reps, and volume for a session (only completed, non-warmup sets). */
function computeSessionStats(session: WorkoutSession): {
  volume: number;
  sets: number;
  reps: number;
} {
  let volume = 0;
  let sets = 0;
  let reps = 0;
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.isCompleted && !set.isWarmup) {
        volume += setVolume(set);
        sets += 1;
        reps += set.reps;
      }
    }
  }
  return { volume, sets, reps };
}

/** Get the muscle key for an exercise: prefer muscleGroup, fallback to targetMuscle. */
function getMuscleKey(exercise: { muscleGroup?: string; targetMuscle: string }): string {
  return exercise.muscleGroup || exercise.targetMuscle || 'Unknown';
}

/** Filter sessions to the last N weeks from now. */
function filterByWeeks(sessions: WorkoutSession[], weeks?: number): WorkoutSession[] {
  if (!weeks || weeks <= 0) return sessions;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return sessions.filter((s) => s.date >= cutoffStr);
}

/** Find personal records across sessions. */
function findPersonalRecords(sessions: WorkoutSession[]): PersonalRecord[] {
  const byExercise = new Map<string, PersonalRecord>();

  for (const session of sessions) {
    for (const exercise of session.exercises) {
      for (const set of exercise.sets) {
        if (!set.isCompleted || set.isWarmup) continue;

        const volume = setVolume(set);
        const existing = byExercise.get(`${exercise.exerciseId}-weight`);

        // Weight PR (for same or more reps)
        if (!existing || set.weight > existing.weight) {
          byExercise.set(`${exercise.exerciseId}-weight`, {
            id: `${exercise.exerciseId}-weight-${session.date}`,
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            date: session.date,
            weight: set.weight,
            reps: set.reps,
            type: 'weight',
          });
        }

        // Volume PR
        const existingVolPR = byExercise.get(`${exercise.exerciseId}-volume`);
        const existingVolume = existingVolPR ? existingVolPR.weight * existingVolPR.reps : 0;
        if (volume > existingVolume) {
          byExercise.set(`${exercise.exerciseId}-volume`, {
            id: `${exercise.exerciseId}-volume-${session.date}`,
            exerciseId: exercise.exerciseId,
            exerciseName: exercise.exerciseName,
            date: session.date,
            weight: set.weight,
            reps: set.reps,
            type: 'volume',
          });
        }
      }
    }
  }

  return Array.from(byExercise.values());
}

// ============================================================================
// Original Analytics Functions (full implementations)
// ============================================================================

export const getAnalyticsSummary = async (
  startDate: string,
  endDate: string
): Promise<AnalyticsSummary> => {
  // Fetch sessions from storage
  const { getWorkoutSessions } = await import('./workoutDb');
  let sessions: WorkoutSession[];
  try {
    const all = await getWorkoutSessions(1000);
    sessions = all.filter((s: WorkoutSession) => s.date >= startDate && s.date <= endDate);
  } catch {
    sessions = [];
  }

  const completedSessions = sessions.filter((s) => s.status === 'completed');

  const totalWorkouts = completedSessions.length;
  const totalDuration = completedSessions.reduce((sum, s) => sum + s.duration, 0);
  const averageDuration = totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0;
  const totalVolume = completedSessions.reduce((sum, s) => sum + computeSessionVolume(s), 0);

  // Most trained muscles: sum volume per muscle across all sessions
  const muscleVolumes = new Map<string, number>();
  for (const session of completedSessions) {
    for (const exercise of session.exercises) {
      const muscle = getMuscleKey(exercise);
      for (const set of exercise.sets) {
        if (set.isCompleted && !set.isWarmup) {
          muscleVolumes.set(muscle, (muscleVolumes.get(muscle) || 0) + setVolume(set));
        }
      }
    }
  }
  const sortedMuscles = Array.from(muscleVolumes.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([muscle]) => muscle);
  const mostTrainedMuscles = sortedMuscles.slice(0, 5);

  // Weekly frequency: workouts per day of week (0=Sunday .. 6=Saturday)
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const session of completedSessions) {
    const dayOfWeek = new Date(session.date).getDay();
    dayCounts[dayOfWeek] = (dayCounts[dayOfWeek] ?? 0) + 1;
  }

  const personalRecords = findPersonalRecords(completedSessions);

  return {
    totalWorkouts,
    totalVolume,
    totalDuration,
    averageDuration,
    mostTrainedMuscles,
    weeklyFrequency: dayCounts,
    personalRecords,
  };
};

export const calculateVolumeHistory = (
  sessions: WorkoutSession[],
  weeks = 12
): VolumeDataPoint[] => {
  const filtered = filterByWeeks(sessions, weeks);
  const completedSessions = filtered.filter((s) => s.status === 'completed');

  // Group by ISO week
  const weekMap = new Map<string, { volume: number; sets: number }>();

  for (const session of completedSessions) {
    const weekKey = getISOWeek(new Date(session.date));
    const stats = computeSessionStats(session);
    const existing = weekMap.get(weekKey) || { volume: 0, sets: 0 };
    weekMap.set(weekKey, {
      volume: existing.volume + stats.volume,
      sets: existing.sets + stats.sets,
    });
  }

  // Sort by week key
  const sorted = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b));

  return sorted.map(([week, data]) => ({
    date: week,
    volume: data.volume,
    sets: data.sets,
  }));
};

export const calculateFrequency = (sessions: WorkoutSession[]): FrequencyData[] => {
  const counts = [0, 0, 0, 0, 0, 0, 0];

  for (const session of sessions) {
    if (session.status !== 'completed') continue;
    const dayOfWeek = new Date(session.date).getDay();
    counts[dayOfWeek] = (counts[dayOfWeek] ?? 0) + 1;
  }

  return HEBREW_DAYS.map((day, index) => ({
    day,
    count: counts[index] ?? 0,
  }));
};

export const getAverageVolume = (sessions: WorkoutSession[]): number => {
  const completed = sessions.filter((s) => s.status === 'completed');
  if (completed.length === 0) return 0;
  const total = completed.reduce((sum, s) => sum + computeSessionVolume(s), 0);
  return Math.round(total / completed.length);
};

export const calculateMuscleGroupDistribution = (sessions: WorkoutSession[]): MuscleGroupData[] => {
  const muscleVolumes = new Map<string, number>();

  for (const session of sessions) {
    if (session.status !== 'completed') continue;
    for (const exercise of session.exercises) {
      const muscle = getMuscleKey(exercise);
      for (const set of exercise.sets) {
        if (set.isCompleted && !set.isWarmup) {
          muscleVolumes.set(muscle, (muscleVolumes.get(muscle) || 0) + setVolume(set));
        }
      }
    }
  }

  const totalVolume = Array.from(muscleVolumes.values()).reduce((s, v) => s + v, 0);

  return Array.from(muscleVolumes.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([muscle, volume]) => ({
      muscle,
      volume,
      percentage: totalVolume > 0 ? Math.round((volume / totalVolume) * 100) : 0,
    }));
};

// Alias for compatibility
export const getMuscleGroupDistribution = calculateMuscleGroupDistribution;

export const getProgressData = async (
  exerciseId: string,
  weeks = 12
): Promise<{ date: string; value: number }[]> => {
  const { getWorkoutSessions } = await import('./workoutDb');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - weeks * 7);
  const startDate = cutoff.toISOString().slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);

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
    const weekKey = getISOWeek(new Date(session.date));
    const group = weekGroupMap.get(weekKey) || [];
    weekGroupMap.set(weekKey, [...group, session]);
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
  const completedSessions = filtered.filter((s) => s.status === 'completed');

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

    let trend: 'up' | 'down' | 'stable';
    if (previous === 0 && current === 0) {
      trend = 'stable';
    } else if (previous === 0) {
      trend = 'up';
    } else {
      const changeRatio = (current - previous) / previous;
      if (changeRatio > 0.05) {
        trend = 'up';
      } else if (changeRatio < -0.05) {
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
        const weekKey = getISOWeek(new Date(session.date));
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

  // Predict next week
  const nextX = dataPoints.length;
  const predicted = Math.round(slope * nextX + intercept);

  let trend: 'increasing' | 'decreasing' | 'stable';
  if (slope > 10) {
    trend = 'increasing';
  } else if (slope < -10) {
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
  const last = completed.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
  )[0];
  if (!last) return null;
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
  const today = new Date().toISOString().split('T')[0] ?? '';
  return Array.from(muscleLastDate.entries()).map(([muscle, date]) => ({
    muscle,
    lastDate: date,
    daysSince: Math.floor(
      (new Date(today).getTime() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
    ),
  }));
};

export const getWeekOverWeekProgress = (sessions: WorkoutSession[]): ProgressDelta[] => {
  const now = new Date();
  const thisWeekStart = new Date(now);
  thisWeekStart.setDate(now.getDate() - 7);
  const lastWeekStart = new Date(thisWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const thisWeekStartStr = thisWeekStart.toISOString().split('T')[0] ?? '';
  const lastWeekStartStr = lastWeekStart.toISOString().split('T')[0] ?? '';
  const thisWeek = sessions.filter((s) => s.status === 'completed' && s.date >= thisWeekStartStr);
  const lastWeek = sessions.filter(
    (s) => s.status === 'completed' && s.date >= lastWeekStartStr && s.date < thisWeekStartStr
  );

  const computeExerciseVolume = (
    list: WorkoutSession[]
  ): Map<string, { name: string; volume: number }> => {
    const map = new Map<string, { name: string; volume: number }>();
    for (const session of list) {
      for (const exercise of session.exercises) {
        const vol = exercise.sets
          .filter((s) => s.isCompleted)
          .reduce((sum, s) => sum + setVolume(s), 0);
        const existing = map.get(exercise.exerciseId);
        map.set(exercise.exerciseId, {
          name: exercise.exerciseName,
          volume: (existing?.volume || 0) + vol,
        });
      }
    }
    return map;
  };

  const thisWeekVolumes = computeExerciseVolume(thisWeek);
  const lastWeekVolumes = computeExerciseVolume(lastWeek);

  const allExercises = new Set([...thisWeekVolumes.keys(), ...lastWeekVolumes.keys()]);

  return Array.from(allExercises).map((id) => {
    const current = thisWeekVolumes.get(id);
    const previous = lastWeekVolumes.get(id);
    const currentVolume = current?.volume || 0;
    const previousVolume = previous?.volume || 0;
    return {
      exerciseName: current?.name || previous?.name || 'Unknown',
      exerciseId: id,
      currentVolume,
      previousVolume,
      change:
        previousVolume > 0
          ? Math.round(((currentVolume - previousVolume) / previousVolume) * 100)
          : 0,
    };
  });
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
        let maxWeight = 0;
        let maxReps = 0;
        for (const set of exercise.sets) {
          if (set.isCompleted && !set.isWarmup) {
            if (set.weight > maxWeight) maxWeight = set.weight;
            if (set.reps > maxReps) maxReps = set.reps;
          }
        }
        const est1RM = maxWeight * (1 + maxReps / 30);
        const volume = exercise.sets
          .filter((s) => s.isCompleted)
          .reduce((sum, s) => sum + setVolume(s), 0);
        points.push({ date: session.date, estimated1RM: Math.round(est1RM * 10) / 10, volume });
      }
      return points;
    }, [])
    .sort((a, b) => a.date.localeCompare(b.date));
};

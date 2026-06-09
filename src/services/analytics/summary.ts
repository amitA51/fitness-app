// ============================================================================
// SPARKOS FITNESS - Analytics Service: summary, volume history, frequency
// ============================================================================

import type { PersonalRecord, WorkoutSession } from '../../types';
import { HEBREW_DAYS } from '../../utils/dateUtils';
import { setVolume } from '../../utils/workoutMath';
import { getWorkoutSessions } from '../workoutDb';
import {
  computeSessionStats,
  computeSessionVolume,
  filterByWeeks,
  getISOWeek,
  getMuscleKey,
  parseLocalDate,
} from './shared';

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
// Helpers
// ============================================================================

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
    const dayOfWeek = parseLocalDate(session.date).getDay();
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
    const weekKey = getISOWeek(parseLocalDate(session.date));
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
    const dayOfWeek = parseLocalDate(session.date).getDay();
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

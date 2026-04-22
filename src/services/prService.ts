// ============================================================================
// SPARKOS FITNESS - PR Service (Personal Records)
// ============================================================================

import type { PersonalRecord, WorkoutSession } from '../types';
import { safeJsonParseOr } from '../utils/safeJson';
import { STORES, dbDelete, dbGetAll, dbGetByIndex, dbPut, syncWithRetry } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import { deleteCloudPersonalRecord, syncPersonalRecord } from './supabaseSync';

export type { PersonalRecord };

// ============================================================================
// IndexedDB PR Operations
// ============================================================================

// Get all PRs for a specific exercise
export const getPRsForExercise = async (exerciseId: string): Promise<PersonalRecord[]> => {
  return dbGetByIndex<PersonalRecord>(STORES.PERSONAL_RECORDS, 'exerciseId', exerciseId);
};

// Save a new PR to IndexedDB
export const savePR = async (pr: PersonalRecord): Promise<void> => {
  await dbPut(STORES.PERSONAL_RECORDS, pr);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(
      () =>
        syncPersonalRecord(user.id, {
          id: pr.id,
          exerciseId: pr.exerciseId,
          exerciseName: pr.exerciseName,
          weight: pr.weight,
          reps: pr.reps,
          date: pr.date,
          recordType: pr.type,
        }),
      `savePR:${pr.id}`
    );
  }
};

// Get all PRs
export const getAllPRs = async (): Promise<PersonalRecord[]> => {
  return dbGetAll<PersonalRecord>(STORES.PERSONAL_RECORDS);
};

// Delete a PR
export const deletePR = async (prId: string): Promise<void> => {
  await dbDelete(STORES.PERSONAL_RECORDS, prId);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(() => deleteCloudPersonalRecord(user.id, prId), `deletePR:${prId}`);
  }
};

// Check if a completed set is a new PR - this is the key real-time detection function
export const checkForNewPR = async (
  exerciseId: string,
  exerciseName: string,
  weight: number,
  reps: number
): Promise<PersonalRecord | null> => {
  if (weight <= 0 || reps <= 0) return null;

  const existingPRs = await getPRsForExercise(exerciseId);
  const volume = weight * reps;
  const est1RM = weight * (1 + reps / 30); // Epley formula

  let newPR: PersonalRecord | null = null;

  // Check weight PR
  const weightPR = existingPRs.find((pr) => pr.type === 'weight');
  if (!weightPR || weight > weightPR.weight) {
    newPR = {
      id: `pr-${exerciseId}-weight-${Date.now()}`,
      exerciseId,
      exerciseName,
      date: new Date().toISOString(),
      weight,
      reps,
      type: 'weight',
      maxWeight: weight,
      oneRepMax: est1RM,
    };
  }

  // Check volume PR
  const volumePR = existingPRs.find((pr) => pr.type === 'volume');
  if (!volumePR || volume > (volumePR.maxWeight || 0) * (volumePR.reps || 0)) {
    const pr: PersonalRecord = {
      id: `pr-${exerciseId}-volume-${Date.now()}`,
      exerciseId,
      exerciseName,
      date: new Date().toISOString(),
      weight,
      reps,
      type: 'volume',
      maxWeight: weight,
      oneRepMax: est1RM,
    };
    // If we already found a weight PR, only replace with volume PR if volume PR is "more impressive"
    // Actually, return the best one. If both are new, prefer weight PR.
    if (!newPR) newPR = pr;
  }

  if (newPR) {
    await savePR(newPR);
  }

  return newPR;
};

// ============================================================================
// PR Utility Functions
// ============================================================================

// Calculate estimated 1RM using Epley formula
export const calculateEst1RM = (weight: number, reps: number): number => {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
};

// Get PR history for an exercise (sorted by date)
export const getPRHistory = async (exerciseId: string): Promise<PersonalRecord[]> => {
  const prs = await getPRsForExercise(exerciseId);
  return prs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// Get best PR for each type for an exercise
export const getBestPRs = async (
  exerciseId: string
): Promise<Record<string, PersonalRecord | null>> => {
  const prs = await getPRsForExercise(exerciseId);
  return {
    weight: prs.filter((p) => p.type === 'weight').sort((a, b) => b.weight - a.weight)[0] || null,
    volume:
      prs
        .filter((p) => p.type === 'volume')
        .sort((a, b) => b.weight * b.reps - a.weight * a.reps)[0] || null,
  };
};

// Rebuild PRs from session history (for migration/repair)
export const rebuildPRsFromHistory = async (sessions: WorkoutSession[]): Promise<number> => {
  const prMap = calculatePRsFromHistory(sessions);
  let count = 0;

  for (const pr of prMap.values()) {
    await savePR(pr);
    count++;
  }

  return count;
};

// ============================================================================
// Exercise Names (for workout components)
// ============================================================================

export const getExerciseNames = (): string[] => {
  // Returns a list of exercise names for autocomplete
  const stored = localStorage.getItem('personalExercises');
  if (!stored) return [];

  try {
    const exercises = safeJsonParseOr<{ name: string }[]>(stored, []);
    return exercises.map((e: { name: string }) => e.name);
  } catch {
    return [];
  }
};

export const getExerciseByName = (
  name: string
): { id: string; name: string; muscleGroup?: string } | null => {
  const stored = localStorage.getItem('personalExercises');
  if (!stored) return null;

  try {
    const exercises = safeJsonParseOr<{ id: string; name: string; muscleGroup?: string }[]>(
      stored,
      []
    );
    return exercises.find((e: { name: string }) => e.name === name) ?? null;
  } catch {
    return null;
  }
};

// ============================================================================
// PR Calculation Functions
// ============================================================================

// Calculate PRs from workout history
export const calculatePRsFromHistory = (
  sessions: WorkoutSession[]
): Map<string, PersonalRecord> => {
  const prMap = new Map<string, PersonalRecord>();

  sessions.forEach((session) => {
    session.exercises?.forEach((exercise) => {
      exercise.sets?.forEach((set) => {
        if (!set.completedAt || set.isWarmup) return;

        const key = exercise.exerciseId || exercise.id;
        const volume = set.weight * set.reps;

        // Check weight PR
        if (set.weight > 0) {
          const existing = prMap.get(`${key}-weight`);
          if (!existing || set.weight > existing.weight) {
            prMap.set(`${key}-weight`, {
              id: `pr-${key}-weight-${Date.now()}`,
              exerciseId: key,
              exerciseName: exercise.exerciseName || 'Unknown',
              date: session.date || session.startTime,
              weight: set.weight,
              reps: set.reps,
              type: 'weight',
              maxWeight: set.weight,
            });
          }
        }

        // Check volume PR
        if (volume > 0) {
          const existing = prMap.get(`${key}-volume`);
          if (!existing || volume > (existing.value ?? 0)) {
            prMap.set(`${key}-volume`, {
              id: `pr-${key}-volume-${Date.now()}`,
              exerciseId: key,
              exerciseName: exercise.exerciseName || 'Unknown',
              date: session.date || session.startTime,
              weight: set.weight,
              reps: set.reps,
              type: 'volume',
              value: volume,
              maxWeight: set.weight,
            });
          }
        }
      });
    });
  });

  return prMap;
};

// Check if a set is a new PR
export const isNewPR = (
  exerciseId: string,
  weight: number,
  reps: number,
  existingPRs: Map<string, PersonalRecord>
): { isWeightPR: boolean; isVolumePR: boolean } => {
  const weightKey = `${exerciseId}-weight`;
  const volumeKey = `${exerciseId}-volume`;

  const currentWeightPR = existingPRs.get(weightKey);
  const currentVolumePR = existingPRs.get(volumeKey);

  return {
    isWeightPR: !currentWeightPR || weight > currentWeightPR.weight,
    isVolumePR: !currentVolumePR || weight * reps > (currentVolumePR.value ?? 0),
  };
};

// Export workout history to CSV
export const exportWorkoutHistoryCSV = (sessions: WorkoutSession[]): void => {
  const headers = ['Date', 'Exercise', 'Sets', 'Reps', 'Weight', 'Volume'];
  const rows: string[][] = [];

  sessions.forEach((session) => {
    session.exercises?.forEach((exercise) => {
      exercise.sets?.forEach((set) => {
        if (set.isWarmup) return;
        rows.push([
          session.date || session.startTime,
          exercise.exerciseName || 'Unknown',
          '1',
          set.reps.toString(),
          set.weight.toString(),
          (set.weight * set.reps).toString(),
        ]);
      });
    });
  });

  const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `workout-history-${new Date().toISOString().split('T')[0] ?? ''}.csv`;
  a.click();

  URL.revokeObjectURL(url);
};

// Get display text for a PR
export function getPRDisplayText(pr: PersonalRecord): string {
  const vol = pr.value ?? pr.weight * pr.reps;
  const est1RM = calculateEst1RM(pr.weight, pr.reps);
  const parts: string[] = [];
  if (pr.type === 'weight') {
    parts.push(`${pr.weight} ק"ג`);
  } else if (pr.type === 'volume') {
    parts.push(`${vol.toLocaleString()} ק"ג נפח`);
  }
  if (pr.reps > 1) {
    parts.push(`${pr.reps} חזרות`);
  }
  if (est1RM > pr.weight) {
    parts.push(`1RM ~${est1RM} ק"ג`);
  }
  return parts.join(' | ');
}

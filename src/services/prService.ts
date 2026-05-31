// ============================================================================
// SPARKOS FITNESS - PR Service (Personal Records)
// ============================================================================

import type { PersonalRecord, WorkoutSession } from '../types';
import { safeJsonParseOr } from '../utils/safeJson';
import { oneRepMax, setVolume } from '../utils/workoutMath';
import { STORES, dbDelete, dbGetAll, dbPut, initDB, syncWithRetry } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import { deleteCloudPersonalRecord, syncPersonalRecord } from './supabaseSync';

export type { PersonalRecord };

// ============================================================================
// IndexedDB PR Operations
// ============================================================================

// Local helper: index lookup using IDBKeyRange.only so we hit the `exerciseId`
// index directly without scanning the full personal_records store. Kept in this
// file (not added to indexedDBCore) because the shared `dbGetByIndex` helper
// only accepts IDBValidKey and another agent may be editing that module.
const dbGetByIndexRange = <T>(
  storeName: string,
  indexName: string,
  range: IDBKeyRange
): Promise<T[]> =>
  initDB().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(range);
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      })
  );

// Get all PRs for a specific exercise.
// Uses the `exerciseId` index on STORES.PERSONAL_RECORDS with IDBKeyRange.only(exerciseId),
// so this is an index seek, not a full store scan.
export const getPRsForExercise = async (exerciseId: string): Promise<PersonalRecord[]> => {
  return dbGetByIndexRange<PersonalRecord>(
    STORES.PERSONAL_RECORDS,
    'exerciseId',
    IDBKeyRange.only(exerciseId)
  );
};

// Batched: fetch PRs for multiple exercises in a single readonly transaction.
// Deduplicates ids and does one index lookup per unique exerciseId inside ONE tx,
// instead of N separate transactions (one per set) as the old per-set loop did.
// Returns a Map keyed by exerciseId -> PR[] (missing ids map to []).
export const getPRsForMultipleExercises = async (
  exerciseIds: string[]
): Promise<Map<string, PersonalRecord[]>> => {
  const result = new Map<string, PersonalRecord[]>();
  const uniqueIds = Array.from(new Set(exerciseIds.filter((id) => !!id)));
  if (uniqueIds.length === 0) return result;

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PERSONAL_RECORDS, 'readonly');
    const store = tx.objectStore(STORES.PERSONAL_RECORDS);
    const index = store.index('exerciseId');

    uniqueIds.forEach((id) => {
      const req = index.getAll(IDBKeyRange.only(id));
      req.onsuccess = () => {
        result.set(id, (req.result as PersonalRecord[]) ?? []);
      };
      req.onerror = () => reject(req.error);
    });

    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
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
      `savePR:${pr.id}`,
      3,
      {
        type: 'record:create',
        payload: {
          id: pr.id,
          exerciseId: pr.exerciseId,
          exerciseName: pr.exerciseName,
          weight: pr.weight,
          reps: pr.reps,
          date: pr.date,
          recordType: pr.type,
        },
      }
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
    syncWithRetry(() => deleteCloudPersonalRecord(user.id, prId), `deletePR:${prId}`, 3, {
      type: 'record:delete',
      payload: prId,
    });
  }
};

// Internal: diff a completed set against an in-memory list of existing PRs
// for that exercise. Pure function — no IO. Returns ALL newly-broken PRs,
// plus the updated PR list so a caller iterating sets can keep state in sync
// without re-hitting IndexedDB between sets.
export const diffSetAgainstPRs = (
  exerciseId: string,
  exerciseName: string,
  weight: number,
  reps: number,
  existingPRs: PersonalRecord[],
  date?: string
): { newPR: PersonalRecord | null; newPRs: PersonalRecord[]; nextPRs: PersonalRecord[] } => {
  if (weight <= 0 || reps <= 0) return { newPR: null, newPRs: [], nextPRs: existingPRs };

  const prDate = date ?? new Date().toISOString();
  const volume = weight * reps;
  const est1RM = calculateEst1RM(weight, reps); // canonical: handles reps===1 + rounding
  const newPRs: PersonalRecord[] = [];

  const weightPR = existingPRs.find((pr) => pr.type === 'weight');
  if (!weightPR || weight > weightPR.weight) {
    newPRs.push({
      id: crypto.randomUUID(),
      exerciseId,
      exerciseName,
      date: prDate,
      weight,
      reps,
      type: 'weight',
      maxWeight: weight,
      oneRepMax: est1RM,
    });
  }

  const volumePR = existingPRs.find((pr) => pr.type === 'volume');
  // Defensive: legacy rows may have weight or maxWeight zeroed, so take the
  // larger of (maxWeight*reps) and (weight*reps) as the existing volume.
  const existingVolume = volumePR
    ? Math.max(
        (volumePR.maxWeight || 0) * (volumePR.reps || 0),
        (volumePR.weight || 0) * (volumePR.reps || 0)
      )
    : 0;
  if (!volumePR || volume > existingVolume) {
    newPRs.push({
      id: crypto.randomUUID(),
      exerciseId,
      exerciseName,
      date: prDate,
      weight,
      reps,
      type: 'volume',
      maxWeight: weight,
      oneRepMax: est1RM,
    });
  }

  // Reps PR: highest reps at weight ≥ 0.85 × current weight PR
  // (prevents trivial floods at low load — only "real" rep records register).
  const repsPR = existingPRs.find((pr) => pr.type === 'reps');
  const weightThreshold = (weightPR?.weight || 0) * 0.85;
  if (weight >= weightThreshold && (!repsPR || reps > (repsPR.reps || 0))) {
    newPRs.push({
      id: crypto.randomUUID(),
      exerciseId,
      exerciseName,
      date: prDate,
      weight,
      reps,
      type: 'reps',
      maxWeight: weight,
      oneRepMax: est1RM,
    });
  }

  const newPR = newPRs[0] ?? null;
  const nextPRs = newPRs.length > 0 ? [...existingPRs, ...newPRs] : existingPRs;
  return { newPR, newPRs, nextPRs };
};

// Check if a completed set is a new PR - this is the key real-time detection function.
// Single-call variant: does one index lookup for `exerciseId`, diffs, persists if needed.
export const checkForNewPR = async (
  exerciseId: string,
  exerciseName: string,
  weight: number,
  reps: number
): Promise<PersonalRecord | null> => {
  if (weight <= 0 || reps <= 0) return null;

  const existingPRs = await getPRsForExercise(exerciseId);
  const { newPR, newPRs } = diffSetAgainstPRs(exerciseId, exerciseName, weight, reps, existingPRs);

  for (const pr of newPRs) {
    await savePR(pr);
    import('./notificationService')
      .then(({ showPRNotification }) => {
        showPRNotification(exerciseName, pr.type);
      })
      .catch(() => {});
  }
  return newPR;
};

// Batched PR checker: preload PRs for all exercises touched in a workout in ONE
// transaction, then diff each set in-memory. Replaces the previous per-set
// pattern (10 exercises × 4 sets = 40 IDB transactions) with 1 read transaction
// + at most one write per actually-broken PR.
//
// Usage:
//   const checker = await createBatchedPRChecker(exerciseIds);
//   for (const set of sets) {
//     const pr = await checker.checkSet(exerciseId, exerciseName, weight, reps);
//     if (pr) showToast(pr);
//   }
export interface BatchedPRChecker {
  checkSet: (
    exerciseId: string,
    exerciseName: string,
    weight: number,
    reps: number
  ) => Promise<PersonalRecord | null>;
}

export const createBatchedPRChecker = async (exerciseIds: string[]): Promise<BatchedPRChecker> => {
  const cache = await getPRsForMultipleExercises(exerciseIds);

  const checkSet = async (
    exerciseId: string,
    exerciseName: string,
    weight: number,
    reps: number
  ): Promise<PersonalRecord | null> => {
    if (weight <= 0 || reps <= 0) return null;

    // Lazy-load any exercise we didn't preload (e.g. user added an exercise mid-workout).
    let existingPRs = cache.get(exerciseId);
    if (!existingPRs) {
      existingPRs = await getPRsForExercise(exerciseId);
      cache.set(exerciseId, existingPRs);
    }

    const { newPR, newPRs, nextPRs } = diffSetAgainstPRs(
      exerciseId,
      exerciseName,
      weight,
      reps,
      existingPRs
    );

    if (newPRs.length > 0) {
      cache.set(exerciseId, nextPRs);
      for (const pr of newPRs) {
        await savePR(pr);
      }
    }
    return newPR;
  };

  return { checkSet };
};

// ============================================================================
// PR Utility Functions
// ============================================================================

// Calculate estimated 1RM using Epley formula — delegates to shared oneRepMax.
export const calculateEst1RM = (weight: number, reps: number): number => oneRepMax(weight, reps);

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
        .sort((a, b) => (b.value ?? b.weight * b.reps) - (a.value ?? a.weight * a.reps))[0] || null,
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
        const volume = setVolume(set);

        // Check weight PR
        if (set.weight > 0) {
          const existing = prMap.get(`${key}-weight`);
          if (!existing || set.weight > existing.weight) {
            prMap.set(`${key}-weight`, {
              id: crypto.randomUUID(),
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
              id: crypto.randomUUID(),
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

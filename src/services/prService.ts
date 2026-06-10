// ============================================================================
// SPARKOS FITNESS - PR Service (Personal Records)
// ============================================================================

import type { PersonalRecord, WorkoutSession } from '../types';
import { logger } from '../utils/logger';
import { safeJsonParseOr } from '../utils/safeJson';
import { oneRepMax, setVolume } from '../utils/workoutMath';
import { STORES, dbDelete, dbGet, dbGetAll, dbPut, initDB } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import { syncPersonalRecord } from './supabaseSync';
import { syncWithRetry } from './syncEngine';

export type { PersonalRecord };

// ============================================================================
// Stable Exercise Identity
// ============================================================================
// Active-workout exercise ids are RANDOM per session (the exercise selector and
// the template loader mint fresh UUIDs every workout), so PR identity must
// never key on them — baselines would never match and every workout would
// "break" the same records again. The stable identity is the normalized
// exercise NAME — the same way ghost values resolve previous sets
// (usePreviousData matches sessions by exerciseName).

/** Canonical, comparison-safe form of an exercise name. */
export const normalizeExerciseName = (name: string | null | undefined): string =>
  (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Stable PR identity for an exercise-like object: the normalized name,
 * falling back to exerciseId/id only when the exercise has no usable name.
 */
export const stableExerciseKey = (exercise: {
  exerciseName?: string | null;
  name?: string | null;
  exerciseId?: string | null;
  id?: string | null;
}): string =>
  normalizeExerciseName(exercise.exerciseName ?? exercise.name) ||
  exercise.exerciseId ||
  exercise.id ||
  '';

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

// Delete a PR. Cloud-side this is a SOFT delete (tombstone): we upsert the row
// with `deleted_at` stamped instead of physically deleting it. A hard delete
// gets resurrected by the next full push from any other device that still
// holds the record; the tombstone survives pushes (live saves never send
// deleted_at — see syncPersonalRecord) and propagates the deletion on pull
// (mergeGenericRecords removes tombstoned rows locally). Same pattern as
// deleteCloudWaterEntry in waterService.
export const deletePR = async (prId: string): Promise<void> => {
  // Read the record BEFORE deleting it locally — the tombstone upsert needs
  // the row's fields (and the same payload doubles as the offline-queue
  // fallback, which replays through syncPersonalRecord).
  let existing: PersonalRecord | null = null;
  try {
    existing = (await dbGet<PersonalRecord>(STORES.PERSONAL_RECORDS, prId)) ?? null;
  } catch {
    existing = null;
  }

  await dbDelete(STORES.PERSONAL_RECORDS, prId);

  const user = await getCurrentUser();
  if (!user) return;

  const deletedAt = new Date().toISOString();
  const tombstone = {
    id: prId,
    exerciseId: existing?.exerciseId ?? '',
    exerciseName: existing?.exerciseName ?? '',
    weight: existing?.weight ?? 0,
    reps: existing?.reps ?? 0,
    date: existing?.date ?? deletedAt,
    recordType: existing?.type ?? ('weight' as const),
    updatedAt: deletedAt,
    deletedAt,
  };

  syncWithRetry(() => syncPersonalRecord(user.id, tombstone), `deletePR:${prId}`, 3, {
    // record:create replays through syncPersonalRecord, which writes
    // deleted_at when present — NOT record:delete, whose replay would
    // physically delete the cloud row and reintroduce the resurrection bug.
    type: 'record:create',
    payload: tombstone,
  });
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
      .then(({ getNotificationConfig, showPRNotification }) => {
        // Honor the user's PR-notification toggle (Settings → notifications).
        if (!getNotificationConfig().prNotificationEnabled) return;
        showPRNotification(exerciseName, pr.type);
      })
      .catch((err) => {
        // Best-effort notification: a failure here must not break PR saving,
        // but we log it rather than swallow it silently.
        logger.workout.warn('Failed to show PR notification', err);
      });
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
    reps: number,
    date?: string
  ) => Promise<PersonalRecord | null>;
}

export const createBatchedPRChecker = async (exerciseIds: string[]): Promise<BatchedPRChecker> => {
  const cache = await getPRsForMultipleExercises(exerciseIds);

  const checkSet = async (
    exerciseId: string,
    exerciseName: string,
    weight: number,
    reps: number,
    date?: string
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
      existingPRs,
      date
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

// Persist every genuine PR from a finished session — called from the workout
// save-success path (useWorkoutSave). Identity is stableExerciseKey (normalized
// name), so the baseline read here matches the PRs written by previous
// sessions even though every workout mints fresh random exercise ids.
//
// Idempotent: a retry/re-finish diffs against the records the first run
// already saved, and an equal value is never strictly greater — so re-running
// over the same session cannot duplicate PRs.
export const persistSessionPRs = async (session: WorkoutSession): Promise<PersonalRecord[]> => {
  const exercises = session.exercises ?? [];
  const keys = exercises.map((ex) => stableExerciseKey(ex)).filter(Boolean);
  if (keys.length === 0) return [];

  const checker = await createBatchedPRChecker(keys);
  const newPRs: PersonalRecord[] = [];

  for (const exercise of exercises) {
    const key = stableExerciseKey(exercise);
    if (!key) continue;
    const displayName = exercise.exerciseName || exercise.name || 'Unknown';
    for (const set of exercise.sets ?? []) {
      // Warmup sets never set records; only completed working sets count.
      if (!set.completedAt || set.isWarmup) continue;
      const weight = set.weight || 0;
      const reps = set.reps || 0;
      if (weight <= 0 || reps <= 0) continue;
      const pr = await checker.checkSet(key, displayName, weight, reps, set.completedAt);
      if (pr) newPRs.push(pr);
    }
  }

  return newPRs;
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

// Calculate PRs from workout history.
// Keys are `${stableExerciseKey}-weight|volume` — i.e. the NORMALIZED EXERCISE
// NAME, not the per-session random exercise id. This is what makes baselines
// from previous sessions actually match the current workout's exercises.
export const calculatePRsFromHistory = (
  sessions: WorkoutSession[]
): Map<string, PersonalRecord> => {
  const prMap = new Map<string, PersonalRecord>();

  sessions.forEach((session) => {
    session.exercises?.forEach((exercise) => {
      exercise.sets?.forEach((set) => {
        if (!set.completedAt || set.isWarmup) return;

        const key = stableExerciseKey(exercise);
        if (!key) return;
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

// Single source of truth for "is this set a new PR, and of which type?".
// Used by BOTH the live in-workout detector (usePersonalRecords) and the
// summary count (countSessionPRs) so the two can never disagree.
// First match wins: weight → volume → reps (reps only at ≥85% of the weight
// PR, preventing trivial rep floods at low load).
export const detectNewPRType = (
  exerciseKey: string,
  weight: number,
  reps: number,
  existingPRs: Map<string, PersonalRecord>
): 'weight' | 'volume' | 'reps' | null => {
  if (weight <= 0 || reps <= 0) return null;

  const { isWeightPR, isVolumePR } = isNewPR(exerciseKey, weight, reps, existingPRs);
  if (isWeightPR) return 'weight';
  if (isVolumePR) return 'volume';

  const weightPR = existingPRs.get(`${exerciseKey}-weight`);
  const repsThreshold = (weightPR?.weight || 0) * 0.85;
  if (weight >= repsThreshold && reps > (weightPR?.reps || 0)) return 'reps';

  return null;
};

// Count the exercises in a finished session that broke at least one PR against
// the given baseline map (history BEFORE the session). The summary headline
// number. Warmup sets and uncompleted sets never count.
export const countSessionPRs = (
  exercises: WorkoutSession['exercises'],
  basePrMap: Map<string, PersonalRecord>
): { count: number; prNames: Set<string> } => {
  let count = 0;
  const prNames = new Set<string>();

  for (const exercise of exercises ?? []) {
    const key = stableExerciseKey(exercise);
    if (!key) continue;
    const hasNewPR = (exercise.sets ?? []).some(
      (set) =>
        !!set.completedAt &&
        !set.isWarmup &&
        detectNewPRType(key, set.weight || 0, set.reps || 0, basePrMap) !== null
    );
    if (hasNewPR) {
      count += 1;
      prNames.add(exercise.name ?? '');
    }
  }

  return { count, prNames };
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

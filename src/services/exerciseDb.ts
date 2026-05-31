/**
 * Personal Exercise Database Service
 *
 * CRUD operations for personal exercises (with built-in seeding), plus cloud
 * merge/replace helpers.
 */

import { getBUILT_IN_EXERCISES } from '../data/builtInExercises';
import { NotFoundError } from '../errors';
import type { CreatePersonalExerciseInput, PersonalExercise } from '../types';
import { generateId } from '../utils/id';
import { mergeGenericRecords } from './cloudMerge';
import { STORES, dbDelete, dbGetAll, dbGetByIndex, dbPut, initDB } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import { syncPersonalExercise } from './supabaseSync';
import { syncWithRetry } from './syncEngine';

/**
 * Get all personal exercises, sorted by last used.
 * Seeds built-in exercises if library is empty.
 */
export const getPersonalExercises = async (): Promise<PersonalExercise[]> => {
  let exercises = await dbGetAll<PersonalExercise>(STORES.PERSONAL_EXERCISES);

  // Check for missing built-in exercises and seed them if needed
  const now = new Date().toISOString();
  const builtIn = getBUILT_IN_EXERCISES(now);
  const existingNames = new Set(exercises.map((e) => e.name));
  const missingBuiltIns = builtIn.filter((b) => !existingNames.has(b.name));

  if (missingBuiltIns.length > 0) {
    const newExercises = missingBuiltIns.map((ex) => ({
      ...ex,
      id: crypto.randomUUID?.() || generateId('ex'),
      createdAt: now,
    })) as PersonalExercise[];

    await Promise.all(newExercises.map((ex) => dbPut(STORES.PERSONAL_EXERCISES, ex)));
    exercises = [...exercises, ...newExercises];
  }

  // Sort by last used, then by use count, then by name
  exercises.sort((a, b) => {
    if (a.lastUsed && b.lastUsed) {
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    }
    if (a.lastUsed) return -1;
    if (b.lastUsed) return 1;
    if (a.useCount && b.useCount) return b.useCount - a.useCount;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  return exercises;
};

/**
 * Get a single personal exercise by ID.
 */
export const getPersonalExercise = async (id: string): Promise<PersonalExercise | undefined> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PERSONAL_EXERCISES, 'readonly');
    const store = tx.objectStore(STORES.PERSONAL_EXERCISES);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

/**
 * Create a new personal exercise.
 */
export const createPersonalExercise = async (
  exercise: CreatePersonalExerciseInput
): Promise<PersonalExercise> => {
  const newExercise = {
    ...exercise,
    id: crypto.randomUUID?.() || generateId('ex'),
    createdAt: new Date().toISOString(),
    useCount: 0,
  } as PersonalExercise;

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PERSONAL_EXERCISES, 'readwrite');
    const store = tx.objectStore(STORES.PERSONAL_EXERCISES);
    const request = store.add(newExercise);

    request.onsuccess = () => {
      getCurrentUser().then((user) => {
        if (user) {
          syncWithRetry(
            () => syncPersonalExercise(user.id, { ...newExercise, name: newExercise.name ?? '' }),
            `createPersonalExercise:${newExercise.id}`,
            3,
            { type: 'exercise:update', payload: { ...newExercise, name: newExercise.name ?? '' } }
          );
        }
      });
      resolve(newExercise);
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Update an existing personal exercise.
 */
export const updatePersonalExercise = async (
  id: string,
  updates: Partial<PersonalExercise>
): Promise<void> => {
  const existing = await getPersonalExercise(id);
  if (!existing) throw new NotFoundError('PersonalExercise', id);

  const updated = { ...existing, ...updates, id };

  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PERSONAL_EXERCISES, 'readwrite');
    const store = tx.objectStore(STORES.PERSONAL_EXERCISES);
    const request = store.put(updated);

    request.onsuccess = () => {
      getCurrentUser().then((user) => {
        if (user) {
          syncWithRetry(
            () => syncPersonalExercise(user.id, { ...updated, name: updated.name ?? '' }),
            `updatePersonalExercise:${id}`,
            3,
            { type: 'exercise:update', payload: { ...updated, name: updated.name ?? '' } }
          );
        }
      });
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * Delete a personal exercise and cascade-delete its associated personal records.
 * Uses soft-delete (sets deletedAt) for cloud sync propagation, then removes locally.
 */
export const deletePersonalExercise = async (id: string): Promise<void> => {
  const now = new Date().toISOString();

  // Cascade: remove all personal records linked to this exercise
  const orphanedPRs = await dbGetByIndex<{ id: string; exerciseId: string }>(
    STORES.PERSONAL_RECORDS,
    'exerciseId',
    id
  );
  await Promise.all(orphanedPRs.map((pr) => dbDelete(STORES.PERSONAL_RECORDS, pr.id)));

  // Hard-delete locally
  await dbDelete(STORES.PERSONAL_EXERCISES, id);

  // Soft-delete in cloud (set deleted_at so other devices pick up the tombstone)
  getCurrentUser().then((user) => {
    if (user) {
      syncWithRetry(
        () => syncPersonalExercise(user.id, { id, name: '', deletedAt: now, updatedAt: now }),
        `deletePersonalExercise:${id}`,
        3,
        { type: 'exercise:delete', payload: id }
      );
    }
  });
};

/**
 * Increment use count and update last used timestamp.
 */
export const incrementExerciseUse = async (id: string): Promise<void> => {
  const exercise = await getPersonalExercise(id);
  if (!exercise) return;

  await updatePersonalExercise(id, {
    useCount: (exercise.useCount || 0) + 1,
    lastUsed: new Date().toISOString(),
  });
};

/**
 * Toggle favorite status for an exercise.
 */
export const toggleExerciseFavorite = async (id: string): Promise<boolean> => {
  const exercise = await getPersonalExercise(id);
  if (!exercise) return false;

  const newFavoriteStatus = !exercise.isFavorite;
  await updatePersonalExercise(id, {
    isFavorite: newFavoriteStatus,
  });
  return newFavoriteStatus;
};

/**
 * Remove duplicate exercises based on name (case-insensitive).
 * Keeps the one with the highest useCount or usage data.
 */
export const removeDuplicateExercises = async (): Promise<number> => {
  const exercises = await getPersonalExercises();
  const uniqueMap = new Map<string, PersonalExercise[]>();

  // Group by normalized name
  exercises.forEach((ex) => {
    const key = (ex.name ?? '').trim().toLowerCase();
    const list = uniqueMap.get(key) || [];
    list.push(ex);
    uniqueMap.set(key, list);
  });

  let removedCount = 0;
  const db = await initDB();

  for (const [_key, group] of uniqueMap.entries()) {
    if (group.length > 1) {
      // Sort to find the "best" one to keep
      // Criteria: Built-in preference? usage count? detailed metadata?
      // Let's prefer the one with highest useCount, then most recent lastUsed.
      group.sort((a, b) => {
        const scoreA = (a.useCount || 0) * 100 + (a.lastUsed ? new Date(a.lastUsed).getTime() : 0);
        const scoreB = (b.useCount || 0) * 100 + (b.lastUsed ? new Date(b.lastUsed).getTime() : 0);
        return scoreB - scoreA;
      });

      const [_keep, ...remove] = group;

      // Delete the rest in a single transaction
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORES.PERSONAL_EXERCISES, 'readwrite');
        const store = tx.objectStore(STORES.PERSONAL_EXERCISES);
        for (const ex of remove) {
          store.delete(ex.id);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
      });

      removedCount += remove.length;
    }
  }

  return removedCount;
};

/**
 * Replace all personal exercises with cloud data.
 */
export const replacePersonalExercisesFromCloud = async (
  exercises: PersonalExercise[]
): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.PERSONAL_EXERCISES, 'readwrite');
    const store = tx.objectStore(STORES.PERSONAL_EXERCISES);
    store.clear();
    for (const ex of exercises) {
      store.put(ex);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
};

export const mergePersonalExercisesFromCloud = (
  exercises: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.PERSONAL_EXERCISES, exercises);

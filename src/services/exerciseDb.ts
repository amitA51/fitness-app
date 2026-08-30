/**
 * Personal Exercise Database Service
 *
 * CRUD operations for personal exercises (with built-in seeding), plus cloud
 * merge/replace helpers.
 */

import { NotFoundError } from '../errors';
import { isSupabaseConfigured } from '../lib/supabase';
import type { CreatePersonalExerciseInput, PersonalExercise } from '../types';
import { generateId } from '../utils/id';
import { logger } from '../utils/logger';
import { mergeGenericRecords } from './cloudMerge';
import { STORES, dbDelete, dbGetAll, dbGetByIndex, dbPut, initDB } from './indexedDBCore';
import { type MutationType, queueMutation } from './offlineQueue';
// prService does NOT import this module, so there is no cycle here.
import { deletePR } from './prService';
import { getCurrentUser } from './supabaseAuth';
import { syncPersonalExercise } from './supabaseSync';
import { syncWithRetry } from './syncEngine';

/**
 * Module-level seeding lock. Concurrent first loads (React StrictMode double
 * effects, two components mounting together) used to each see an empty store,
 * each compute the full missing-built-ins list, and each insert it — leaving
 * every exercise duplicated in the selector. Sharing one in-flight pass makes
 * the seed run exactly once per burst.
 */
let seedingPass: Promise<PersonalExercise[]> | null = null;

/** Read the store and insert any built-ins missing by name. Returns the full list. */
const loadAndSeedBuiltIns = async (): Promise<PersonalExercise[]> => {
  const exercises = await dbGetAll<PersonalExercise>(STORES.PERSONAL_EXERCISES);

  const now = new Date().toISOString();
  // Lazy-load the ~38KB built-in catalog: it's only needed when seeding the
  // personal-exercise store, so it stays out of the initial bundle and ships as
  // its own chunk fetched on first exercise-DB read.
  const { getBUILT_IN_EXERCISES } = await import('../data/builtInExercises');
  const builtIn = getBUILT_IN_EXERCISES(now);
  const existingNames = new Set(exercises.map((e) => e.name));
  const missingBuiltIns = builtIn.filter((b) => !existingNames.has(b.name));

  if (missingBuiltIns.length === 0) return exercises;

  const newExercises = missingBuiltIns.map((ex) => ({
    ...ex,
    id: crypto.randomUUID?.() || generateId('ex'),
    createdAt: now,
  })) as PersonalExercise[];

  await Promise.all(newExercises.map((ex) => dbPut(STORES.PERSONAL_EXERCISES, ex)));
  return [...exercises, ...newExercises];
};

/**
 * Self-heal libraries hit by the old concurrent double-seed: collapse extra
 * UNTRAINED copies of a duplicated name down to one. The seeder stamps
 * lastUsed on built-ins, so useCount (only incremented by real workouts) is
 * the usage marker — a copy with useCount > 0 is never deleted. Local-only
 * delete: the legacy duplicates predate any usage, and guests (the common
 * first-run case) have no cloud rows to tombstone.
 */
const healDuplicateBuiltIns = async (
  exercises: PersonalExercise[]
): Promise<PersonalExercise[]> => {
  const byName = new Map<string, PersonalExercise[]>();
  for (const ex of exercises) {
    const key = ex.name ?? '';
    byName.set(key, [...(byName.get(key) ?? []), ex]);
  }

  const removals: PersonalExercise[] = [];
  for (const group of byName.values()) {
    if (group.length < 2) continue;
    // Keep the trained copy (highest useCount, then freshest lastUsed);
    // extras are deletable only if they were never trained.
    const sorted = [...group].sort(
      (a, b) =>
        (b.useCount || 0) - (a.useCount || 0) ||
        new Date(b.lastUsed ?? 0).getTime() - new Date(a.lastUsed ?? 0).getTime()
    );
    removals.push(...sorted.slice(1).filter((ex) => !ex.useCount));
  }

  if (removals.length === 0) return exercises;

  await Promise.all(removals.map((ex) => dbDelete(STORES.PERSONAL_EXERCISES, ex.id)));
  const removedIds = new Set(removals.map((ex) => ex.id));
  return exercises.filter((ex) => !removedIds.has(ex.id));
};

/**
 * Get all personal exercises, sorted by last used.
 * Seeds built-in exercises if library is empty.
 */
export const getPersonalExercises = async (): Promise<PersonalExercise[]> => {
  if (!seedingPass) {
    seedingPass = loadAndSeedBuiltIns().finally(() => {
      seedingPass = null;
    });
  }
  let exercises = await seedingPass;

  exercises = await healDuplicateBuiltIns(exercises);

  // Sort by last used, then by use count, then by name
  exercises = [...exercises].sort((a, b) => {
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
 * Push one personal-exercise write to the cloud, or hand it to the offline queue
 * when there is no account to push it under.
 *
 * THE HOLE THIS CLOSES (T-119), the same one sessionDb closed in T-111 and
 * water / nutrition / body stats in T-115. In this codebase the enqueue IS
 * `syncWithRetry`'s 4th argument (services/syncEngine.ts), so an enqueue that
 * lives INSIDE `if (user)` produces NO QUEUE ROW AT ALL when `getCurrentUser()`
 * answers null — and it answers null not only for a guest but for a real account
 * holder whose token refresh just failed with a 401 (services/supabaseAuth models
 * that path). The exercise then existed only on this device, invisible to the
 * retry engine, the dead-letter store and the sign-out guard — every one of which
 * reads the queue — and the sign-out wipe destroyed it. Built-in exercises
 * re-seed themselves (`loadAndSeedBuiltIns` above); a CUSTOM one is gone.
 *
 * `queueMutation` resolves and stamps ownership itself (real account id, or
 * GUEST_OWNER / UNKNOWN_OWNER), so no user id is needed from the caller. An
 * ownerless entry is quarantined into the dead-letter store on replay (claimable
 * from Settings) and re-stamped by `adoptGuestDataForUser` on a first sign-in.
 *
 * A REJECTED `getCurrentUser()` takes the same road as null instead of becoming
 * an unhandled rejection: the four call sites used to be floating
 * `getCurrentUser().then(...)` chains with no `.catch`, so an auth failure both
 * lost the write and raised an unhandled rejection.
 *
 * Never throws: the local write has already happened and must not be reported as
 * failed because the cloud leg could not be scheduled.
 */
const pushExerciseMutation = async (
  tag: string,
  record: Parameters<typeof syncPersonalExercise>[1],
  queue: { type: MutationType; payload: unknown }
): Promise<void> => {
  // No cloud configured means nothing to sync to and nothing at risk — mirrors
  // syncWithRetry, which returns early in that case rather than queueing.
  if (!isSupabaseConfigured()) return;

  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    logger.sync.warn('Auth lookup failed while pushing an exercise; queueing instead', err);
  }

  try {
    if (user) {
      const userId = user.id;
      void syncWithRetry(() => syncPersonalExercise(userId, record), tag, 3, queue);
    } else {
      await queueMutation(queue.type, queue.payload);
    }
  } catch (err) {
    logger.sync.warn('Could not schedule an exercise cloud write', { tag, err });
  }
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
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.PERSONAL_EXERCISES, 'readwrite');
    const store = tx.objectStore(STORES.PERSONAL_EXERCISES);
    const request = store.add(newExercise);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Local write first, cloud leg second — and AWAITED. It used to be fired from
  // inside `request.onsuccess` and abandoned, so the queue row could still be
  // unwritten when the caller (and the tab) moved on.
  const payload = { ...newExercise, name: newExercise.name ?? '' };
  await pushExerciseMutation(`createPersonalExercise:${newExercise.id}`, payload, {
    type: 'exercise:update',
    payload,
  });

  return newExercise;
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
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.PERSONAL_EXERCISES, 'readwrite');
    const store = tx.objectStore(STORES.PERSONAL_EXERCISES);
    const request = store.put(updated);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  const payload = { ...updated, name: updated.name ?? '' };
  await pushExerciseMutation(`updatePersonalExercise:${id}`, payload, {
    type: 'exercise:update',
    payload,
  });
};

/**
 * Delete a personal exercise and cascade-delete its associated personal records.
 * Uses soft-delete (sets deletedAt) for cloud sync propagation, then removes locally.
 */
export const deletePersonalExercise = async (id: string): Promise<void> => {
  const now = new Date().toISOString();

  // Cascade: remove all personal records linked to this exercise.
  //
  // This used to `dbDelete` them and stop there. The exercise itself got a cloud
  // tombstone, but its PRs did not — so they stayed LIVE in the cloud and the
  // next pull faithfully re-added every one of them (mergeGenericRecords inserts
  // any cloud row missing locally). The user deleted an exercise and its records
  // reappeared, now orphaned from any exercise. `deletePR` is the only correct
  // way to remove a PR: it stamps a tombstone in the cloud before deleting
  // locally, so the deletion actually propagates.
  const orphanedPRs = await dbGetByIndex<{ id: string; exerciseId: string }>(
    STORES.PERSONAL_RECORDS,
    'exerciseId',
    id
  );
  await Promise.all(orphanedPRs.map((pr) => deletePR(pr.id)));

  // Hard-delete locally
  await dbDelete(STORES.PERSONAL_EXERCISES, id);

  // Soft-delete in cloud (set deleted_at so other devices pick up the tombstone).
  //
  // Awaited and unguarded by auth (T-119): the local hard-delete above always
  // happens, so a tombstone that was reachable only with a resolved user meant a
  // null-auth delete removed the row here while the cloud row stayed LIVE — and
  // the next pull re-inserted the exercise the user deleted. `exercise:delete`
  // replays through `deleteCloudPersonalExercise`, which stamps `deleted_at`
  // rather than hard-deleting, so the queued entry really is a tombstone.
  await pushExerciseMutation(
    `deletePersonalExercise:${id}`,
    { id, name: '', deletedAt: now, updatedAt: now },
    { type: 'exercise:delete', payload: id }
  );
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
  /** Ids whose deletion still has to be propagated to the cloud. */
  const cloudTombstones: string[] = [];

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

      // Propagate each removal as a cloud tombstone.
      //
      // Without this the cleanup was purely cosmetic and self-undoing: the rows
      // were still LIVE in the cloud, so the next pull re-inserted every
      // duplicate the user had just cleaned up (mergeGenericRecords adds any
      // cloud row missing locally). The local delete stays inside its single
      // transaction above — this only adds the outbound tombstone, which is
      // queued and therefore survives being offline.
      cloudTombstones.push(...remove.map((ex) => ex.id));

      removedCount += remove.length;
    }
  }

  if (cloudTombstones.length > 0) {
    const now = new Date().toISOString();
    for (const id of cloudTombstones) {
      // Same path as deletePersonalExercise: pushed directly when an account
      // resolves, queued as a tombstone when it does not. The local deletes above
      // are unconditional, so skipping the cloud leg under null auth made this
      // cleanup self-undoing — the next pull re-inserted every duplicate.
      await pushExerciseMutation(
        `removeDuplicateExercise:${id}`,
        { id, name: '', deletedAt: now, updatedAt: now },
        { type: 'exercise:delete', payload: id }
      );
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

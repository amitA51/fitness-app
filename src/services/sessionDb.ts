/**
 * Workout Session Database Service
 *
 * CRUD operations for workout sessions, plus cloud merge/replace helpers.
 */

import { ValidationError } from '../errors';
import type { WorkoutSession } from '../types';
import { safeTimestamp } from './cloudMerge';
import { emitWorkoutSaved } from './dataEvents';
import { STORES, dbDelete, dbGetAll, dbPut, initDB } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import { syncWorkoutSession } from './supabaseSync';
import { syncWithRetry } from './syncEngine';

/**
 * True when a record carries a soft-delete tombstone (deletedAt set).
 * `WorkoutSession` does not declare `deletedAt` in its canonical type, but the
 * cloud mappers attach it at runtime, so we narrow structurally here.
 */
const isTombstoned = (record: unknown): boolean =>
  Boolean((record as { deletedAt?: string | null }).deletedAt);

/**
 * Save a workout session.
 */
export const saveWorkoutSession = async (session: WorkoutSession): Promise<void> => {
  await dbPut(STORES.WORKOUT_SESSIONS, session);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(
      () => syncWorkoutSession(user.id, { ...session, endTime: session.endTime ?? undefined }),
      `saveWorkoutSession:${session.id}`,
      3,
      { type: 'session:update', payload: { ...session, endTime: session.endTime ?? undefined } }
    );
  }

  // Trigger UI Refresh
  emitWorkoutSaved();
};

/**
 * Get a single workout session by ID.
 */
export const getWorkoutSession = async (id: string): Promise<WorkoutSession | null> => {
  if (!id) return null;
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORES.WORKOUT_SESSIONS, 'readonly');
      const store = tx.objectStore(STORES.WORKOUT_SESSIONS);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
};

/**
 * Get workout sessions, sorted by start time (newest first).
 *
 * Uses a reverse cursor on the `startTime` index (added in DB v7) to read
 * only the latest `limit` records — instead of loading the entire store
 * into memory and sorting in JavaScript. Falls back to the previous full
 * scan if the index isn't present (e.g. an older DB connection that
 * hasn't been upgraded yet in this tab).
 */
export const getWorkoutSessions = async (limit = 20): Promise<WorkoutSession[]> => {
  try {
    const db = await initDB();
    const store = db
      .transaction(STORES.WORKOUT_SESSIONS, 'readonly')
      .objectStore(STORES.WORKOUT_SESSIONS);

    if (!store.indexNames.contains('startTime')) {
      throw new Error('startTime index missing — falling back to full scan');
    }

    return await new Promise<WorkoutSession[]>((resolve, reject) => {
      const out: WorkoutSession[] = [];
      const request = store.index('startTime').openCursor(null, 'prev');
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor || out.length >= limit) {
          resolve(out);
          return;
        }
        const session = cursor.value as WorkoutSession;
        // Skip tombstoned rows so they don't consume the limit budget.
        if (!isTombstoned(session)) {
          out.push(session);
        }
        cursor.continue();
      };
    });
  } catch {
    const sessions = await dbGetAll<WorkoutSession>(STORES.WORKOUT_SESSIONS);
    return sessions
      .filter((s) => !isTombstoned(s))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
      .slice(0, limit);
  }
};

/**
 * Get every workout session in storage, sorted by start time descending.
 *
 * Use this when correctness over arbitrary depth matters (e.g. PR detection
 * across full history). Reads via the `startTime` index cursor so memory cost
 * scales with row count, not with any artificial limit. Falls back to a full
 * scan + JS sort if the index is missing.
 */
export const getAllWorkoutSessions = async (): Promise<WorkoutSession[]> => {
  try {
    const db = await initDB();
    const store = db
      .transaction(STORES.WORKOUT_SESSIONS, 'readonly')
      .objectStore(STORES.WORKOUT_SESSIONS);

    if (!store.indexNames.contains('startTime')) {
      throw new Error('startTime index missing — falling back to full scan');
    }

    return await new Promise<WorkoutSession[]>((resolve, reject) => {
      const out: WorkoutSession[] = [];
      const request = store.index('startTime').openCursor(null, 'prev');
      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) {
          resolve(out);
          return;
        }
        const session = cursor.value as WorkoutSession;
        // Exclude tombstoned rows: analytics/PR scans must not see deleted sessions.
        if (!isTombstoned(session)) {
          out.push(session);
        }
        cursor.continue();
      };
    });
  } catch {
    const sessions = await dbGetAll<WorkoutSession>(STORES.WORKOUT_SESSIONS);
    return sessions
      .filter((s) => !isTombstoned(s))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }
};

/**
 * Re-add workout session from cloud (no cloud sync trigger).
 */
export const reAddWorkoutSession = (session: WorkoutSession): Promise<void> =>
  dbPut(STORES.WORKOUT_SESSIONS, session);

/**
 * Replace all workout sessions with cloud data.
 */
export const replaceWorkoutSessionsFromCloud = async (
  sessions: WorkoutSession[]
): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.WORKOUT_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORES.WORKOUT_SESSIONS);
    store.clear();
    for (const session of sessions) {
      store.put(session);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
};

/**
 * Delete a workout session by ID.
 */
export const deleteWorkoutSession = async (sessionId: string): Promise<void> => {
  if (!sessionId) throw new ValidationError('Session ID is required for deletion.');
  const now = new Date().toISOString();
  await dbDelete(STORES.WORKOUT_SESSIONS, sessionId);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(
      () =>
        syncWorkoutSession(user.id, {
          id: sessionId,
          startTime: '',
          exercises: [],
          deletedAt: now,
          updatedAt: now,
        }),
      `deleteWorkoutSession:${sessionId}`,
      3,
      { type: 'session:delete', payload: sessionId }
    );
  }

  // Trigger UI Refresh
  emitWorkoutSaved();
};

/**
 * Merge workout sessions from cloud.
 *
 * Tombstone-aware (mirrors mergeGenericRecords in cloudMerge.ts): a cloud row
 * whose `deletedAt` is set removes the local row and is skipped; otherwise
 * last-writer-wins by `updatedAt` (falling back to `createdAt`). All writes and
 * deletes are applied in a single readwrite IndexedDB transaction so the merge
 * is atomic — it fully succeeds or leaves local data untouched.
 */
export const mergeWorkoutSessionsFromCloud = async (
  cloudSessions: WorkoutSession[]
): Promise<{ added: number; updated: number; kept: number; deleted: number }> => {
  const localSessions = await dbGetAll<WorkoutSession>(STORES.WORKOUT_SESSIONS);
  const localMap = new Map(localSessions.map((s) => [s.id, s]));

  let added = 0;
  let updated = 0;
  let kept = 0;
  let deleted = 0;

  const writes: WorkoutSession[] = [];
  const deletes: string[] = [];

  for (const cloud of cloudSessions) {
    if (!cloud.id) continue; // skip records without a usable key

    // If cloud row is tombstoned, remove it locally and skip.
    if (isTombstoned(cloud)) {
      if (localMap.has(cloud.id)) {
        deletes.push(cloud.id);
        deleted++;
      }
      continue;
    }

    const local = localMap.get(cloud.id);
    if (!local) {
      writes.push(cloud);
      added++;
    } else {
      const localTime = safeTimestamp(local.updatedAt) || safeTimestamp(local.createdAt);
      const cloudTime = safeTimestamp(cloud.updatedAt) || safeTimestamp(cloud.createdAt);
      if (cloudTime > localTime || (cloudTime > 0 && localTime === 0)) {
        writes.push(cloud);
        updated++;
      } else {
        kept++;
      }
    }
  }

  // Atomic transaction — all writes and deletes succeed or none do.
  if (writes.length > 0 || deletes.length > 0) {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.WORKOUT_SESSIONS, 'readwrite');
      const store = tx.objectStore(STORES.WORKOUT_SESSIONS);
      for (const session of writes) {
        store.put(session);
      }
      for (const id of deletes) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Merge transaction aborted'));
    });
  }

  return { added, updated, kept, deleted };
};

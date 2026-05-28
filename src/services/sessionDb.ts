/**
 * Workout Session Database Service
 *
 * CRUD operations for workout sessions, plus cloud merge/replace helpers.
 */

import { LOCAL_STORAGE_KEYS as LS } from '../constants';
import { ValidationError } from '../errors';
import type { WorkoutSession } from '../types';
import { STORES, dbClear, dbDelete, dbGetAll, dbPut, initDB, syncWithRetry } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import { deleteCloudWorkoutSession, syncWorkoutSession } from './supabaseSync';

/**
 * Save a workout session.
 */
export const saveWorkoutSession = async (session: WorkoutSession): Promise<void> => {
  await dbPut(LS.WORKOUT_SESSIONS, session);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(
      () => syncWorkoutSession(user.id, { ...session, endTime: session.endTime ?? undefined }),
      `saveWorkoutSession:${session.id}`
    );
  }

  // Trigger UI Refresh
  window.dispatchEvent(new Event('WORKOUT_SAVED'));
};

/**
 * Get a single workout session by ID.
 */
export const getWorkoutSession = async (id: string): Promise<WorkoutSession | null> => {
  if (!id) return null;
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(LS.WORKOUT_SESSIONS, 'readonly');
      const store = tx.objectStore(LS.WORKOUT_SESSIONS);
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
    const store = db.transaction(LS.WORKOUT_SESSIONS, 'readonly').objectStore(LS.WORKOUT_SESSIONS);

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
        out.push(cursor.value as WorkoutSession);
        cursor.continue();
      };
    });
  } catch {
    const sessions = await dbGetAll<WorkoutSession>(LS.WORKOUT_SESSIONS);
    return sessions
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
    const store = db.transaction(LS.WORKOUT_SESSIONS, 'readonly').objectStore(LS.WORKOUT_SESSIONS);

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
        out.push(cursor.value as WorkoutSession);
        cursor.continue();
      };
    });
  } catch {
    const sessions = await dbGetAll<WorkoutSession>(LS.WORKOUT_SESSIONS);
    return sessions.sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  }
};

/**
 * Re-add workout session from cloud (no cloud sync trigger).
 */
export const reAddWorkoutSession = (session: WorkoutSession): Promise<void> =>
  dbPut(LS.WORKOUT_SESSIONS, session);

/**
 * Replace all workout sessions with cloud data.
 */
export const replaceWorkoutSessionsFromCloud = async (
  sessions: WorkoutSession[]
): Promise<void> => {
  await dbClear(LS.WORKOUT_SESSIONS);
  await Promise.all(sessions.map((session) => dbPut(LS.WORKOUT_SESSIONS, session)));
};

/**
 * Delete a workout session by ID.
 */
export const deleteWorkoutSession = async (sessionId: string): Promise<void> => {
  if (!sessionId) throw new ValidationError('Session ID is required for deletion.');
  await dbDelete(LS.WORKOUT_SESSIONS, sessionId);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(
      () => deleteCloudWorkoutSession(user.id, sessionId),
      `deleteWorkoutSession:${sessionId}`
    );
  }

  // Trigger UI Refresh
  window.dispatchEvent(new Event('WORKOUT_SAVED'));
};

/**
 * Merge workout sessions from cloud.
 */
export const mergeWorkoutSessionsFromCloud = async (
  cloudSessions: WorkoutSession[]
): Promise<{ added: number; updated: number; kept: number }> => {
  const localSessions = await dbGetAll<WorkoutSession>(STORES.WORKOUT_SESSIONS);
  const localMap = new Map(localSessions.map((s) => [s.id, s]));

  let added = 0;
  let updated = 0;
  let kept = 0;

  for (const cloud of cloudSessions) {
    const local = localMap.get(cloud.id);
    if (!local) {
      await dbPut(STORES.WORKOUT_SESSIONS, cloud);
      added++;
    } else {
      const localTime = new Date(local.updatedAt || local.createdAt).getTime();
      const cloudTime = new Date(cloud.updatedAt || cloud.createdAt || '').getTime();
      if (cloudTime > localTime) {
        await dbPut(STORES.WORKOUT_SESSIONS, cloud);
        updated++;
      } else {
        kept++;
      }
    }
  }

  return { added, updated, kept };
};

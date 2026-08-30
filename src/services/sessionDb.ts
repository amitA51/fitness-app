/**
 * Workout Session Database Service
 *
 * CRUD operations for workout sessions, plus cloud merge/replace helpers.
 */

import { ValidationError } from '../errors';
import { isSupabaseConfigured } from '../lib/supabase';
import type { WorkoutSession } from '../types';
import { logger } from '../utils/logger';
import { safeTimestamp } from './cloudMerge';
import { emitWorkoutSaved } from './dataEvents';
import { STORES, dbDelete, dbGetAll, dbPut, initDB } from './indexedDBCore';
import { queueMutation } from './offlineQueue';
import { getCurrentUser } from './supabaseAuth';
import { deleteCloudWorkoutSession, syncWorkoutSession } from './supabaseSync';
import { syncWithRetry } from './syncEngine';

/**
 * True when a record carries a soft-delete tombstone (deletedAt set).
 * `WorkoutSession` does not declare `deletedAt` in its canonical type, but the
 * cloud mappers attach it at runtime, so we narrow structurally here.
 */
const isTombstoned = (record: unknown): boolean =>
  Boolean((record as { deletedAt?: string | null }).deletedAt);

// ── Unsynced-session ledger ─────────────────────────────────────────────────
//
// Every defence this app has against losing a workout — the retry engine, the
// dead-letter store, the owner stamping, the expired-session handling, the
// sign-out guard — reads the OFFLINE QUEUE. A local write that never entered the
// queue is therefore invisible to all of them, which is exactly what used to
// happen when `getCurrentUser()` returned null for somebody who genuinely HAS an
// account (a 401 during token refresh — services/supabaseAuth.ts models that
// path explicitly): the session landed in IndexedDB, the enqueue sat inside
// `if (user)` and never ran, sign-in only PULLS so nothing ever pushed it, and
// the sign-out warning — counting queue depth + dead letters, both zero —
// reassured the user right before the local wipe destroyed the workout.
//
// Two things close that hole. `saveWorkoutSession` below no longer makes the
// enqueue conditional on a resolved user, and this ledger records every session
// that has NOT been confirmed in the cloud — so "is there anything to lose?"
// stops being a question only the queue can answer.
//
// It lives in the EXISTING `pending_sync` store (created at DB v4, keyPath
// 'tag', so far unused) — no schema change and no migration. That store is
// already part of USER_SCOPED_STORAGE_REGISTRY, so it is wiped with the rest of
// the account's local data, and settingsService deliberately excludes it from
// JSON backups as plumbing rather than user data. Both stay correct.

const UNSYNCED_TAG_PREFIX = 'unsynced-session:';

interface UnsyncedSessionMarker {
  tag: string;
  sessionId: string;
  createdAt: string;
  /** Present only to keep the store's `retryCount` index well-formed. */
  retryCount: number;
}

const markerTag = (sessionId: string): string => `${UNSYNCED_TAG_PREFIX}${sessionId}`;

const isUnsyncedMarker = (row: UnsyncedSessionMarker): boolean =>
  typeof row?.tag === 'string' &&
  row.tag.startsWith(UNSYNCED_TAG_PREFIX) &&
  typeof row.sessionId === 'string' &&
  row.sessionId.length > 0;

/**
 * Record that a session exists locally with no confirmed cloud copy.
 * Best-effort: a failure here must never block the local save, which is the
 * write the user actually cares about.
 */
const markSessionUnsynced = async (sessionId: string): Promise<void> => {
  if (!sessionId) return;
  try {
    const marker: UnsyncedSessionMarker = {
      tag: markerTag(sessionId),
      sessionId,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    await dbPut(STORES.PENDING_SYNC, marker);
  } catch (err) {
    logger.sync.warn('Could not record an unsynced session marker', err);
  }
};

/** Drop the marker. Only ever called once the cloud copy is confirmed, or the session is gone. */
const clearUnsyncedSessionMarker = async (sessionId: string): Promise<void> => {
  if (!sessionId) return;
  try {
    await dbDelete(STORES.PENDING_SYNC, markerTag(sessionId));
  } catch (err) {
    logger.sync.warn('Could not clear an unsynced session marker', err);
  }
};

/**
 * Ids of sessions written locally with no confirmed cloud copy, reconciled
 * against what is actually in the sessions store: a marker whose session was
 * deleted (or replaced by a cloud pull) is stale and is NOT reported, so the
 * sign-out warning cannot cry wolf. Read-only — pruning happens in
 * `flushUnsyncedSessions`, because this runs on a UI poll.
 */
export const getUnsyncedSessionIds = async (): Promise<string[]> => {
  try {
    const markers = (await dbGetAll<UnsyncedSessionMarker>(STORES.PENDING_SYNC)).filter(
      isUnsyncedMarker
    );
    if (markers.length === 0) return [];

    const live = new Set(
      (await dbGetAll<WorkoutSession>(STORES.WORKOUT_SESSIONS))
        .filter((session) => !isTombstoned(session))
        .map((session) => session.id)
    );
    return markers.map((marker) => marker.sessionId).filter((id) => live.has(id));
  } catch (err) {
    logger.sync.warn('Could not read the unsynced-session ledger', err);
    return [];
  }
};

/** How many local workouts exist with no confirmed cloud copy. */
export const getUnsyncedSessionCount = async (): Promise<number> =>
  (await getUnsyncedSessionIds()).length;

/**
 * Try to get every ledgered session to the cloud, and drop the markers that are
 * no longer real risk.
 *
 * This is what makes the new warning actionable instead of a dead end: a session
 * that is only in the ledger is in NO queue, so `processQueue` alone can never
 * push it. On failure the write is handed to the offline queue, which is where
 * the rest of the app's recovery machinery can finally see it.
 */
export const flushUnsyncedSessions = async (): Promise<{ pushed: number; queued: number }> => {
  if (!isSupabaseConfigured()) return { pushed: 0, queued: 0 };

  let markers: UnsyncedSessionMarker[];
  try {
    markers = (await dbGetAll<UnsyncedSessionMarker>(STORES.PENDING_SYNC)).filter(isUnsyncedMarker);
  } catch (err) {
    logger.sync.warn('Could not read the unsynced-session ledger', err);
    return { pushed: 0, queued: 0 };
  }
  if (markers.length === 0) return { pushed: 0, queued: 0 };

  const user = await getCurrentUser();
  let pushed = 0;
  let queued = 0;

  for (const marker of markers) {
    const session = await getWorkoutSession(marker.sessionId);
    if (!session) {
      // Stale: the session was deleted or replaced. Not a risk, so stop counting it.
      await clearUnsyncedSessionMarker(marker.sessionId);
      continue;
    }

    const payload = { ...session, endTime: session.endTime ?? undefined };
    if (user) {
      const synced = await syncWithRetry(
        () => syncWorkoutSession(user.id, payload),
        `flushUnsyncedSession:${session.id}`,
        1,
        { type: 'session:update', payload }
      );
      if (synced) {
        await clearUnsyncedSessionMarker(session.id);
        pushed++;
      } else {
        queued++;
      }
    } else {
      await queueMutation('session:update', payload);
      queued++;
    }
  }

  return { pushed, queued };
};

/**
 * Save a workout session.
 */
export const saveWorkoutSession = async (session: WorkoutSession): Promise<void> => {
  await dbPut(STORES.WORKOUT_SESSIONS, session);

  const payload = { ...session, endTime: session.endTime ?? undefined };
  const user = await getCurrentUser();

  // No cloud configured means nothing to sync to, and nothing at risk — mirrors
  // syncWithRetry, which returns early in that case rather than queueing.
  if (isSupabaseConfigured()) {
    // Ledger FIRST. From here until the cloud confirms, this workout exists in
    // exactly one place; recording that is what lets the sign-out guard and the
    // offline indicator see it at all — including if the tab is closed while the
    // request is still in flight.
    await markSessionUnsynced(session.id);

    if (user) {
      void syncWithRetry(
        () => syncWorkoutSession(user.id, payload),
        `saveWorkoutSession:${session.id}`,
        3,
        { type: 'session:update', payload }
      ).then((synced) => {
        if (synced) void clearUnsyncedSessionMarker(session.id);
      });
    } else {
      // THE FIX. This enqueue used to live inside the `if (user)` above, and
      // `getCurrentUser()` returns null not only for a guest but for a
      // signed-in user whose token refresh just failed. That user's workout was
      // written locally with NOTHING scheduled to push it.
      //
      // `queueMutation` resolves and stamps ownership itself — the real account
      // id when auth answers, GUEST_OWNER / UNKNOWN_OWNER when it does not — so
      // the entry does not need a user id from here. An ownerless entry is
      // quarantined into the dead-letter store on replay (claimable from
      // Settings) and re-stamped by `adoptGuestDataForUser` on a first sign-in.
      // Either way it is inside the machinery instead of invisible to it.
      await queueMutation('session:update', payload);
    }
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
  await new Promise<void>((resolve, reject) => {
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

  // Same reasoning as the merge: these rows came FROM the cloud, so they are not
  // unsynced local work any more.
  for (const session of sessions) {
    await clearUnsyncedSessionMarker(session.id);
  }
};

/**
 * Delete a workout session by ID.
 */
export const deleteWorkoutSession = async (sessionId: string): Promise<void> => {
  if (!sessionId) throw new ValidationError('Session ID is required for deletion.');
  await dbDelete(STORES.WORKOUT_SESSIONS, sessionId);
  // The local row is gone, so it is no longer a workout that can be lost.
  await clearUnsyncedSessionMarker(sessionId);

  const user = await getCurrentUser();
  if (user) {
    // Targeted soft-delete UPDATE (house pattern). The previous tombstone
    // upsert sent startTime: '' which Postgres rejected (22007), dropping the
    // tombstone and letting other devices resurrect the session.
    syncWithRetry(
      () => deleteCloudWorkoutSession(user.id, sessionId),
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

  // A row that arrived FROM the cloud demonstrably has a cloud copy, so its
  // ledger marker is no longer real risk. Leaving it would make the sign-out
  // warning fire forever for a workout that is safely stored.
  for (const session of writes) {
    await clearUnsyncedSessionMarker(session.id);
  }

  return { added, updated, kept, deleted };
};

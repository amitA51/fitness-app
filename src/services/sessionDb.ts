/**
 * Workout Session Database Service
 *
 * CRUD operations for workout sessions, plus cloud merge/replace helpers.
 */

import { ValidationError } from '../errors';
import { isSupabaseConfigured, readStoredAuthSession } from '../lib/supabase';
import type { WorkoutSession } from '../types';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/withTimeout';
import { safeTimestamp } from './cloudMerge';
import { emitWorkoutSaved } from './dataEvents';
import { STORES, dbDelete, dbGetAll, dbPut, initDB } from './indexedDBCore';
import {
  type MutationType,
  getQueuedRecordIds,
  queueMutation,
  resolveQueueOwner,
} from './offlineQueue';
import { resolveCurrentUserOrNull } from './supabaseAuth';
import {
  deleteCloudWorkoutSession,
  syncWorkoutSession,
  syncWorkoutSessionsBatch,
} from './supabaseSync';
import { syncWithRetry } from './syncEngine';
import { LAST_SIGNED_IN_USER_ID_KEY } from './userScopedLocalData';

/**
 * True when a record carries a soft-delete tombstone (deletedAt set).
 * `WorkoutSession` does not declare `deletedAt` in its canonical type, but the
 * cloud mappers attach it at runtime, so we narrow structurally here.
 */
const isTombstoned = (record: unknown): boolean =>
  Boolean((record as { deletedAt?: string | null }).deletedAt);

// ── Auth on the write path ──────────────────────────────────────────────────

/**
 * How long a write waits for auth to name the user before treating the answer
 * as "no user" and queueing. `getCurrentUser()` can run a token refresh against
 * the server, and on an overloaded day that took the whole request timeout —
 * while a finished workout sat neither pushed nor queued. Queueing instead is
 * safe: the queue stamps the owner itself (offlineQueue.resolveQueueOwner reads
 * the session stored on this device whenever auth does not name a user) and
 * replays the write once the server answers.
 */
const WRITE_AUTH_LOOKUP_TIMEOUT_MS = 2_000;

type WriteUser = Awaited<ReturnType<typeof resolveCurrentUserOrNull>>;

const resolveUserForWrite = async (): Promise<WriteUser> => {
  try {
    return await withTimeout(
      resolveCurrentUserOrNull(),
      WRITE_AUTH_LOOKUP_TIMEOUT_MS,
      'write-path auth lookup'
    );
  } catch (err) {
    // Only the timeout lands here: resolveCurrentUserOrNull never rejects.
    logger.sync.warn('Auth did not answer in time on a write path; queueing instead', err);
    return null;
  }
};

/**
 * The account signed in on this device right now, from the stored session —
 * synchronous, no network. Null when nobody is stored or it cannot be read.
 */
const storedOwnerId = (): string | null => {
  try {
    return readStoredAuthSession()?.user?.id ?? null;
  } catch {
    return null;
  }
};

/**
 * The account the LOCAL data belongs to: the owner marker authSessionTransition
 * keeps, which moves only once an account switch has wiped the previous
 * account's rows. Null when there is none (a guest, a legacy install).
 */
const localDataOwnerId = (): string | null => {
  try {
    return localStorage.getItem(LAST_SIGNED_IN_USER_ID_KEY);
  } catch {
    return null;
  }
};

/**
 * Queue a session write stamped with `ownerId` when the caller knows it. Without
 * one, queueMutation resolves the owner itself (auth, then the stored session).
 */
const queueSessionWrite = (
  type: MutationType,
  payload: unknown,
  ownerId: string | null
): Promise<void> =>
  ownerId ? queueMutation(type, payload, { ownerId }) : queueMutation(type, payload);

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

// T-115 — the ledger is no longer workouts-only. The identical enqueue hole was
// in waterService, nutritionService and bodyStatsService, so their records need
// the same visibility: a nutrition log or a body-weight row written while auth
// could not answer was counted by NOTHING and then destroyed by the sign-out
// wipe, which walks every store in `Object.values(STORES)`.
//
// ONE mechanism, deliberately: the same `pending_sync` rows, the same
// mark/clear/reconcile code path, keyed by (store, recordId) instead of by
// session id. There is no second per-store scheme, because divergent copies of
// one rule are this project's most repeated defect.

const UNSYNCED_TAG_PREFIX = 'unsynced-session:';

/**
 * Store-qualified tag, used for every store EXCEPT workout_sessions.
 *
 * Workouts keep the original `unsynced-session:<id>` tag on purpose: markers
 * written by the previous version of this ledger already exist on real devices,
 * and re-keying them would silently stop counting a workout that genuinely has
 * no cloud copy — the exact loss this ledger exists to prevent. Two tag SHAPES,
 * one mechanism; both are parsed, reconciled and counted by the code below, and
 * nothing has to be migrated.
 */
const UNSYNCED_RECORD_TAG_PREFIX = 'unsynced-record:';

interface UnsyncedMarkerRow {
  tag: string;
  /** Which object store the record lives in. Absent on legacy workout markers. */
  store?: string;
  /** Legacy field name — workout sessions only, kept so older markers still read. */
  sessionId?: string;
  recordId?: string;
  createdAt: string;
  /** Present only to keep the store's `retryCount` index well-formed. */
  retryCount: number;
}

/** A local record with no confirmed cloud copy. */
export interface UnsyncedRecordRef {
  store: string;
  recordId: string;
}

const markerTag = (store: string, recordId: string): string =>
  store === STORES.WORKOUT_SESSIONS
    ? `${UNSYNCED_TAG_PREFIX}${recordId}`
    : `${UNSYNCED_RECORD_TAG_PREFIX}${store}:${recordId}`;

/**
 * Normalise a `pending_sync` row into (store, recordId), or null when the row is
 * not one of our markers. The id is recovered from the TAG when the explicit
 * fields are missing, so a marker written by any version of this ledger reads.
 */
const parseMarker = (row: UnsyncedMarkerRow): UnsyncedRecordRef | null => {
  if (typeof row?.tag !== 'string') return null;

  if (row.tag.startsWith(UNSYNCED_TAG_PREFIX)) {
    const recordId = row.sessionId || row.tag.slice(UNSYNCED_TAG_PREFIX.length);
    return recordId ? { store: STORES.WORKOUT_SESSIONS, recordId } : null;
  }

  if (row.tag.startsWith(UNSYNCED_RECORD_TAG_PREFIX)) {
    if (row.store && row.recordId) return { store: row.store, recordId: row.recordId };
    const rest = row.tag.slice(UNSYNCED_RECORD_TAG_PREFIX.length);
    const split = rest.indexOf(':');
    if (split <= 0) return null;
    const store = rest.slice(0, split);
    const recordId = rest.slice(split + 1);
    return store && recordId ? { store, recordId } : null;
  }

  return null;
};

const readMarkers = async (): Promise<UnsyncedRecordRef[]> => {
  const rows = await dbGetAll<UnsyncedMarkerRow>(STORES.PENDING_SYNC);
  const refs: UnsyncedRecordRef[] = [];
  for (const row of rows) {
    const ref = parseMarker(row);
    if (ref) refs.push(ref);
  }
  return refs;
};

/**
 * Ids currently present (and not tombstoned) in one store.
 * `null` means the store could not be read — the caller must then ASSUME the
 * record is still there, because over-warning is recoverable and under-warning
 * is the bug this ledger exists to prevent.
 */
const liveIdsForStore = async (store: string): Promise<Set<string> | null> => {
  try {
    const rows = await dbGetAll<{ id?: string }>(store);
    const ids = new Set<string>();
    for (const row of rows) {
      if (row?.id && !isTombstoned(row)) ids.add(row.id);
    }
    return ids;
  } catch (err) {
    logger.sync.warn('Could not reconcile the unsynced ledger against a store', { store, err });
    return null;
  }
};

/**
 * Record that a row exists locally with no confirmed cloud copy.
 * Best-effort: a failure here must never block the local save, which is the
 * write the user actually cares about.
 */
export const markRecordUnsynced = async (store: string, recordId: string): Promise<void> => {
  if (!store || !recordId) return;
  try {
    const marker: UnsyncedMarkerRow = {
      tag: markerTag(store, recordId),
      store,
      recordId,
      // Workouts also keep the legacy field populated, so a tab still running an
      // older bundle keeps counting them.
      ...(store === STORES.WORKOUT_SESSIONS ? { sessionId: recordId } : {}),
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    await dbPut(STORES.PENDING_SYNC, marker);
  } catch (err) {
    logger.sync.warn('Could not record an unsynced-record marker', { store, err });
  }
};

/** Drop the marker. Only ever called once the cloud copy is confirmed, or the row is gone. */
export const clearUnsyncedRecordMarker = async (store: string, recordId: string): Promise<void> => {
  if (!store || !recordId) return;
  try {
    await dbDelete(STORES.PENDING_SYNC, markerTag(store, recordId));
  } catch (err) {
    logger.sync.warn('Could not clear an unsynced-record marker', { store, err });
  }
};

const markSessionUnsynced = (sessionId: string): Promise<void> =>
  markRecordUnsynced(STORES.WORKOUT_SESSIONS, sessionId);

const clearUnsyncedSessionMarker = (sessionId: string): Promise<void> =>
  clearUnsyncedRecordMarker(STORES.WORKOUT_SESSIONS, sessionId);

/**
 * Every local record with no confirmed cloud copy, reconciled against what is
 * actually in each store: a marker whose record was deleted (or replaced by a
 * cloud pull) is stale and is NOT reported, so the sign-out warning cannot cry
 * wolf. Read-only — pruning happens in `flushUnsyncedSessions`, because this
 * runs on a UI poll.
 */
export const getUnsyncedRecords = async (): Promise<UnsyncedRecordRef[]> => {
  try {
    const refs = await readMarkers();
    if (refs.length === 0) return [];

    const live = new Map<string, Set<string> | null>();
    for (const store of new Set(refs.map((ref) => ref.store))) {
      live.set(store, await liveIdsForStore(store));
    }

    return refs.filter((ref) => {
      const ids = live.get(ref.store);
      return ids ? ids.has(ref.recordId) : true;
    });
  } catch (err) {
    logger.sync.warn('Could not read the unsynced-record ledger', err);
    return [];
  }
};

/** How many unsynced local records exist, split the way the warning copy needs. */
export interface UnsyncedRecordCounts {
  /** Workouts. Named separately because the sign-out dialog names them. */
  sessions: number;
  /** Nutrition, water and body-stat rows. */
  others: number;
  total: number;
}

export const getUnsyncedRecordCounts = async (): Promise<UnsyncedRecordCounts> => {
  const refs = await getUnsyncedRecords();
  const sessions = refs.filter((ref) => ref.store === STORES.WORKOUT_SESSIONS).length;
  return { sessions, others: refs.length - sessions, total: refs.length };
};

/**
 * Ids of sessions written locally with no confirmed cloud copy.
 */
export const getUnsyncedSessionIds = async (): Promise<string[]> =>
  (await getUnsyncedRecords())
    .filter((ref) => ref.store === STORES.WORKOUT_SESSIONS)
    .map((ref) => ref.recordId);

/** How many local workouts exist with no confirmed cloud copy. */
export const getUnsyncedSessionCount = async (): Promise<number> =>
  (await getUnsyncedSessionIds()).length;

/** What one flush of the ledger did. */
export interface FlushResult {
  pushed: number;
  queued: number;
}

const NOTHING_FLUSHED: FlushResult = { pushed: 0, queued: 0 };

/** Cloud hand-offs started by `saveWorkoutSession` that have not finished yet. */
const pendingCloudHandoffs = new Set<Promise<void>>();

/**
 * Sessions whose save hand-off — or the direct push it started — is still
 * running, with a count because the same workout can be saved twice in a row.
 * A flush leaves them alone: the hand-off is already delivering them, and a
 * second push of the same workout is only load on a struggling server.
 */
const sessionsHandingOff = new Map<string, number>();

/** Mark a session as handing off; the returned function (idempotent) ends it. */
const holdForHandoff = (sessionId: string): (() => void) => {
  sessionsHandingOff.set(sessionId, (sessionsHandingOff.get(sessionId) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const left = (sessionsHandingOff.get(sessionId) ?? 1) - 1;
    if (left > 0) sessionsHandingOff.set(sessionId, left);
    else sessionsHandingOff.delete(sessionId);
  };
};

/** Ids of every ledgered SESSION, or null when the ledger cannot be read. */
const ledgeredSessionIds = async (): Promise<string[] | null> => {
  try {
    // Session markers ONLY. The ledger is shared with nutrition, water and
    // body-stat rows now, and a flush pushes through syncWorkoutSession —
    // handing it a water row would send garbage to the workouts table.
    return (await readMarkers())
      .filter((ref) => ref.store === STORES.WORKOUT_SESSIONS)
      .map((ref) => ref.recordId);
  } catch (err) {
    logger.sync.warn('Could not read the unsynced-session ledger', err);
    return null;
  }
};

/**
 * Push each of `sessionIds` to the cloud, or queue it, and drop the markers of
 * sessions that no longer exist.
 *
 * Every queued write is stamped with its owner — auth's user, else the account
 * stored on this device — instead of leaving it to a later lookup that answers
 * "no user" during a refresh cooldown (and would file it as a guest's change).
 * Once one push fails the server is not answering: the rest are queued, not
 * each given its own timeout against it.
 *
 * `expectedOwner` (the automatic drain): push only into that account, and do
 * nothing at all when auth names somebody else — the identity is mid-switch.
 */
const flushLedgeredSessions = async (
  sessionIds: readonly string[],
  expectedOwner?: string
): Promise<FlushResult> => {
  const storedOwner = storedOwnerId();
  const user = await resolveUserForWrite();
  if (expectedOwner && user && user.id !== expectedOwner) return NOTHING_FLUSHED;
  const owner = user?.id ?? expectedOwner ?? storedOwner;

  let pushed = 0;
  let queued = 0;
  let serverAnswering = true;

  for (const sessionId of sessionIds) {
    const session = await getWorkoutSession(sessionId);
    if (!session) {
      // Stale: the session was deleted or replaced. Not a risk, so stop counting it.
      await clearUnsyncedSessionMarker(sessionId);
      continue;
    }

    const payload = { ...session, endTime: session.endTime ?? undefined };
    if (user && serverAnswering) {
      const synced = await syncWithRetry(
        () => syncWorkoutSession(user.id, payload),
        `flushUnsyncedSession:${session.id}`,
        1,
        { type: 'session:update', payload, ownerId: user.id }
      );
      if (synced) {
        await clearUnsyncedSessionMarker(session.id);
        pushed++;
      } else {
        // syncWithRetry has queued this one.
        queued++;
        serverAnswering = false;
      }
    } else {
      await queueSessionWrite('session:update', payload, owner);
      queued++;
    }
  }

  return { pushed, queued };
};

/** One flush at a time: a second caller shares the one already running. */
let flushInFlight: Promise<FlushResult> | null = null;

const singleFlightFlush = (run: () => Promise<FlushResult>): Promise<FlushResult> => {
  if (flushInFlight) return flushInFlight;
  const promise = run().finally(() => {
    if (flushInFlight === promise) flushInFlight = null;
  });
  flushInFlight = promise;
  return promise;
};

/**
 * Try to get every ledgered session to the cloud, and drop the markers that are
 * no longer real risk. For the "sync now" button and the sign-out guard.
 *
 * This is what makes the new warning actionable instead of a dead end: a session
 * that is only in the ledger is in NO queue, so `processQueue` alone can never
 * push it. On failure the write is handed to the offline queue, which is where
 * the rest of the app's recovery machinery can finally see it.
 */
export const flushUnsyncedSessions = (): Promise<FlushResult> =>
  singleFlightFlush(async () => {
    if (!isSupabaseConfigured()) return NOTHING_FLUSHED;
    const ids = await ledgeredSessionIds();
    const due = (ids ?? []).filter((id) => !sessionsHandingOff.has(id));
    return due.length > 0 ? flushLedgeredSessions(due) : NOTHING_FLUSHED;
  });

/**
 * The flush the app runs ON ITS OWN (offlineQueue.drainUnsyncedLedger: start-up,
 * back online, after a pull). Nothing used to drain the ledger without a tap, so
 * a workout whose push was cut short by closing the tab waited for "sync now".
 *
 * More careful than the button, because nobody asked for it:
 *  - only the ledgered sessions in NO queue and NOT held. A queued one is the
 *    queue's to deliver: re-queuing it would reset its backoff and its retry
 *    budget on every trigger, and a quarantined guest change would be pushed
 *    straight into whoever is signed in. A held one is the user's decision.
 *  - only into the account the local data belongs to (the owner marker), so a
 *    drain that runs while an account switch is still wiping the previous
 *    account's rows cannot push them into the new one.
 */
export const drainUnsyncedSessions = (): Promise<FlushResult> =>
  singleFlightFlush(async () => {
    if (!isSupabaseConfigured()) return NOTHING_FLUSHED;
    const owner = storedOwnerId();
    if (!owner || localDataOwnerId() !== owner) return NOTHING_FLUSHED;

    const ids = await ledgeredSessionIds();
    if (!ids || ids.length === 0) return NOTHING_FLUSHED;
    let queuedOrHeld: Set<string>;
    try {
      queuedOrHeld = await getQueuedRecordIds('session');
    } catch (err) {
      // Cannot tell what is queued: leave it all to the queue and the button.
      logger.sync.warn('Could not read the queue before draining the ledger', err);
      return NOTHING_FLUSHED;
    }
    const due = ids.filter((id) => !sessionsHandingOff.has(id) && !queuedOrHeld.has(id));
    return due.length > 0 ? flushLedgeredSessions(due, owner) : NOTHING_FLUSHED;
  });

/**
 * Give a saved session to the cloud: a direct push when auth names the user in
 * time, the offline queue otherwise. Never throws — the session is already in
 * IndexedDB and on the ledger, so a failure here leaves it counted (offline
 * indicator, sign-out guard) and pushable (`flushUnsyncedSessions`), not lost.
 */
const handOffSessionToCloud = async (
  session: WorkoutSession,
  ownerAtSave: string | null,
  release: () => void
): Promise<void> => {
  const payload = { ...session, endTime: session.endTime ?? undefined };
  let pushStarted = false;
  try {
    const user = await resolveUserForWrite();
    // Gone locally while auth was being asked — deleted by the user, or wiped by
    // a sign-out that already counted it: pushing or queueing the save now would
    // bring the workout back (a queued update after the delete replays last).
    if (!(await getWorkoutSession(session.id))) {
      logger.sync.info('Saved workout was removed locally before its hand-off; not sending it', {
        id: session.id,
      });
      return;
    }
    // This runs AFTER the save resolved, so a sign-out or an account switch can
    // land while auth is being asked. The workout belongs to the account that
    // was signed in when it was SAVED (`ownerAtSave`): push it directly only into
    // that account; in every other case it is queued below stamped with that
    // owner, so it can never be written into whoever is signed in by now.
    if (user && (!ownerAtSave || user.id === ownerAtSave)) {
      pushStarted = true;
      void syncWithRetry(
        () => syncWorkoutSession(user.id, payload),
        `saveWorkoutSession:${session.id}`,
        3,
        // The fallback enqueue runs only after every retry has failed — seconds
        // later, possibly after a sign-out. Stamped with the saving account, it
        // can neither turn into a guest's change nor replay into anybody else.
        { type: 'session:update', payload, ownerId: user.id }
      )
        .then((synced) => {
          if (synced) void clearUnsyncedSessionMarker(session.id);
        })
        .finally(release);
      return;
    }
    // THE FIX. This enqueue used to live inside the `if (user)` above, and
    // `getCurrentUser()` returns null not only for a guest but for a signed-in
    // user whose token refresh just failed — or, now, did not answer within
    // WRITE_AUTH_LOOKUP_TIMEOUT_MS. That user's workout was written locally with
    // NOTHING scheduled to push it.
    //
    // `queueMutation` resolves and stamps ownership itself — the real account
    // id when auth names one, otherwise the account stored on this device, and
    // GUEST_OWNER / UNKNOWN_OWNER only when nothing is stored — so the entry does
    // not need a user id from here. An ownerless entry is quarantined into the dead-letter store
    // on replay (claimable from Settings) and re-stamped by
    // `adoptGuestDataForUser` on a first sign-in. Either way it is inside the
    // machinery instead of invisible to it.
    //
    // Stamped with the saving account explicitly (the local-existence guard is
    // above). Left to queueMutation, a lookup after a sign-out answers "guest",
    // and `adoptGuestDataForUser` would hand the previous account's workout to
    // whoever signs up next on this device. Stamped, it replays only when that
    // same account is back.
    await queueSessionWrite('session:update', payload, ownerAtSave);
  } catch (err) {
    logger.sync.error('Could not hand a saved workout to the cloud or the queue', {
      id: session.id,
      err,
    });
  } finally {
    // A direct push releases the session when it settles, not here.
    if (!pushStarted) release();
  }
};

/**
 * Wait until every cloud hand-off started by `saveWorkoutSession` has either
 * started its push or written its queue row. For tests, and for any flow that
 * must not race one.
 */
export const settleSessionCloudHandoffs = async (): Promise<void> => {
  while (pendingCloudHandoffs.size > 0) {
    await Promise.allSettled([...pendingCloudHandoffs]);
  }
};

/**
 * Save a workout session.
 *
 * Resolves as soon as the session is in IndexedDB and on the unsynced ledger —
 * the two writes that make it impossible to lose. The cloud hand-off continues
 * in the background: finishing a workout used to wait on an auth lookup that
 * can run a token refresh, so on a slow server the save spinner turned for as
 * long as that took, with the workout neither queued nor marked meanwhile.
 */
export const saveWorkoutSession = async (session: WorkoutSession): Promise<void> => {
  // Who is saving, read NOW (synchronously): the hand-off below runs later.
  const ownerAtSave = storedOwnerId();
  await dbPut(STORES.WORKOUT_SESSIONS, session);

  // No cloud configured means nothing to sync to, and nothing at risk — mirrors
  // syncWithRetry, which returns early in that case rather than queueing.
  if (isSupabaseConfigured()) {
    // Ledger FIRST, before any auth lookup. From here until the cloud confirms,
    // this workout exists in exactly one place; recording that is what lets the
    // sign-out guard and the offline indicator see it at all — including if the
    // tab is closed before the hand-off below finishes.
    await markSessionUnsynced(session.id);

    const release = holdForHandoff(session.id);
    const handoff: Promise<void> = handOffSessionToCloud(session, ownerAtSave, release).finally(
      () => {
        pendingCloudHandoffs.delete(handoff);
      }
    );
    pendingCloudHandoffs.add(handoff);
  }

  // Trigger UI Refresh
  emitWorkoutSaved();
};

/** Cloud upsert size for an import — the same batch the full sync uses. */
const IMPORT_BATCH_SIZE = 50;

/**
 * Save many sessions at once — an import (e.g. a Strava history), where one
 * cloud request per workout would mean hundreds. Same guarantees as
 * `saveWorkoutSession`: local first, ledger before the cloud, and a batch the
 * cloud refuses goes to the offline queue session by session.
 *
 * The owner is resolved ONCE, before anything is written: queueing hundreds of
 * sessions one by one used to ask auth for each — up to 2 s apiece on a slow
 * server, and "no user" (a guest's change) during a refresh cooldown. After the
 * first refused batch the rest are queued without being pushed: the server is
 * not answering, and each batch would only wait out its own timeout.
 */
export const saveImportedWorkoutSessions = async (
  sessions: readonly WorkoutSession[]
): Promise<void> => {
  if (sessions.length === 0) return;
  const ownerAtImport = storedOwnerId();

  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.WORKOUT_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORES.WORKOUT_SESSIONS);
    for (const session of sessions) store.put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Import transaction aborted'));
  });

  if (isSupabaseConfigured()) {
    // Held for the whole import, like a save's hand-off: a pull landing midway
    // must not let the ledger drain push these one by one while their batches
    // are still on the way.
    const releases = sessions.map((session) => holdForHandoff(session.id));
    try {
      for (const session of sessions) await markSessionUnsynced(session.id);
      const user = await resolveUserForWrite();
      const owner = user?.id ?? ownerAtImport ?? (await resolveQueueOwner());
      let serverAnswering = Boolean(user);

      for (let i = 0; i < sessions.length; i += IMPORT_BATCH_SIZE) {
        const batch = sessions.slice(i, i + IMPORT_BATCH_SIZE);
        const payloads = batch.map((s) => ({ ...s, endTime: s.endTime ?? undefined }));
        let pushed = false;
        if (user && serverAnswering) {
          try {
            await syncWorkoutSessionsBatch(user.id, payloads);
            pushed = true;
          } catch (err) {
            serverAnswering = false;
            logger.sync.warn(
              `saveImportedWorkoutSessions: batch of ${batch.length} refused; queueing the rest`,
              err
            );
          }
        }
        if (pushed) {
          for (const s of batch) await clearUnsyncedSessionMarker(s.id);
        } else {
          for (const payload of payloads) {
            await queueSessionWrite('session:update', payload, owner);
          }
        }
      }
    } finally {
      for (const release of releases) release();
    }
  }

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
  // Who is deleting, read NOW: the tombstone may be queued only after the auth
  // lookup below, or after every direct retry has failed.
  const ownerAtDelete = storedOwnerId();
  await dbDelete(STORES.WORKOUT_SESSIONS, sessionId);
  // The local row is gone, so it is no longer a workout that can be lost.
  await clearUnsyncedSessionMarker(sessionId);

  // Capped like the save path, but still AWAITED: a deletion has no ledger
  // marker, so its tombstone must be pushed or queued before this resolves —
  // otherwise closing the tab now would let the next pull resurrect the row.
  const user = await resolveUserForWrite();
  // No cloud configured means nothing to sync to and nothing at risk — mirrors
  // syncWithRetry, which returns early in that case rather than queueing.
  if (isSupabaseConfigured()) {
    if (user) {
      // Targeted soft-delete UPDATE (house pattern). The previous tombstone
      // upsert sent startTime: '' which Postgres rejected (22007), dropping the
      // tombstone and letting other devices resurrect the session.
      void syncWithRetry(
        () => deleteCloudWorkoutSession(user.id, sessionId),
        `deleteWorkoutSession:${sessionId}`,
        3,
        { type: 'session:delete', payload: sessionId, ownerId: user.id }
      );
    } else {
      // THE FIX (T-119) — the same shape as `saveWorkoutSession` above, and as
      // `deleteBodyWeight` / `deleteMealEntry`. The local delete two lines up is
      // UNCONDITIONAL while the cloud tombstone was reachable only with a
      // resolved user, and `getCurrentUser()` answers null for a real account
      // holder mid-failed-token-refresh (services/supabaseAuth models that 401
      // path), not only for a guest. That user deleted a workout here, nothing
      // queued the tombstone — the enqueue IS syncWithRetry's 4th argument, so a
      // guarded call that never runs leaves NO queue row — and the next pull
      // faithfully RESURRECTED the workout, because a cloud row with no
      // `deleted_at` is re-inserted by `mergeWorkoutSessionsFromCloud`.
      //
      // `session:delete` replays through `deleteCloudWorkoutSession`, which
      // stamps `deleted_at` rather than hard-deleting, so what is queued really
      // is a tombstone and it converges on every other device too.
      //
      // Stamped with the account that deleted it. A null here is most often a
      // signed-in user in the refresh cooldown; filed as a guest's change, the
      // tombstone was quarantined on replay and the next pull brought the
      // deleted workout back.
      await queueSessionWrite('session:delete', sessionId, ownerAtDelete);
    }
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

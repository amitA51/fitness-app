/**
 * Offline Mutation Queue
 * Queues failed sync operations for retry when back online
 * Works with the existing supabaseSync service
 */

import { logger } from '../utils/logger';
import { BUSY, withSyncLock } from './syncLock';

// ── Types ────────────────────────────────────────────────────────────────────

export type MutationType =
  | 'template:create'
  | 'template:update'
  | 'template:delete'
  | 'session:create'
  | 'session:update'
  | 'session:delete'
  | 'exercise:create'
  | 'exercise:update'
  | 'exercise:delete'
  | 'bodyweight:create'
  | 'bodyweight:delete'
  | 'measurement:create'
  | 'measurement:delete'
  | 'record:create'
  | 'record:delete'
  | 'recovery:create'
  | 'recovery:delete'
  | 'nutrition:create'
  | 'nutrition:update'
  | 'nutrition:delete'
  | 'setting:update'
  | 'ai:create'
  | 'ai:update'
  | 'ai:delete'
  | 'water:create'
  | 'water:delete';

interface QueuedMutation {
  id: string;
  type: MutationType;
  payload: unknown;
  // Owner of the mutation, stamped at enqueue time. processQueue drops entries
  // whose owner is not the currently signed-in user so a queued write can never
  // replay into another account on a shared device. Optional for backward
  // compat with rows written before this field existed (legacy rows are
  // treated as belonging to the current user).
  userId?: string;
  timestamp: number;
  // Monotonic sequence assigned at enqueue time. Two mutations enqueued within
  // the same millisecond share a timestamp, so timestamp alone cannot preserve
  // FIFO order (e.g. create -> delete -> update of one record). `seq` breaks
  // those ties deterministically. Optional for backward compat with rows
  // written before this field existed (they sort first, as the oldest).
  seq?: number;
  retryCount: number;
  lastError?: string;
  // Earliest time this entry may be attempted again (ms epoch). Set on every
  // retriable failure using exponential backoff, so a failing entry no longer
  // burns one of its MAX_RETRIES attempts on every app open / 90s tick.
  nextAttemptAt?: number;
}

/**
 * A mutation that could not be synced and has stopped being retried. The
 * payload is PRESERVED: previously these rows were deleted outright, so a user
 * who opened the app offline five times silently lost the underlying change
 * with no way to recover it.
 */
export interface DeadLetterMutation extends QueuedMutation {
  /** When the entry was moved out of the active queue. */
  failedAt: number;
  /** Why it stopped being retried. */
  reason: 'max_retries' | 'permanent_error' | 'ownerless';
}

/**
 * Owner sentinels.
 *
 * A queued mutation with NO owner used to be replayed for whoever was signed in
 * at the time — so a change made in guest mode, or while the auth lookup was
 * failing, could be written into the next person's account on a shared device.
 * Ownership is now always recorded, and these two values mark the cases where
 * there is no account to attribute the change to. Replay quarantines them into
 * the dead-letter store, where the user can explicitly claim (retry) or discard
 * them.
 */
export const GUEST_OWNER = '__guest__';
export const UNKNOWN_OWNER = '__unknown__';

/** True when the entry has no real account behind it (incl. pre-ownership rows). */
function isOwnerless(userId: string | undefined): boolean {
  return !userId || userId === GUEST_OWNER || userId === UNKNOWN_OWNER;
}

const STORE_NAME = 'mutation_queue';
const DEAD_LETTER_STORE = 'dead_letter_queue';
/** Cross-tab lease store, read/written by services/syncLock.ts. */
const LEASE_STORE = 'sync_leases';
const MAX_RETRIES = 5;

/** Backoff schedule per retry attempt (ms): 5s, 30s, 2m, 10m, 30m. */
const RETRY_BACKOFF_MS = [5_000, 30_000, 120_000, 600_000, 1_800_000];

function backoffFor(retryCount: number): number {
  const index = Math.min(Math.max(retryCount - 1, 0), RETRY_BACKOFF_MS.length - 1);
  return RETRY_BACKOFF_MS[index] ?? 1_800_000;
}

/** True when the browser reports no connectivity. Conservative: unknown = online. */
function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

// Status codes that indicate a permanent failure — never retry these.
// 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found,
// 409 Conflict, 422 Unprocessable Entity.
const NON_RETRIABLE_STATUS = new Set<number>([400, 401, 403, 404, 409, 422]);

// ── Error classification ────────────────────────────────────────────────────

/**
 * Returns true if the error looks transient (network blip, 5xx, timeout).
 * Returns false for 4xx-ish errors that will never succeed on retry.
 * Default: treat unknown errors as retriable — we'd rather retry than
 * silently drop a user's data.
 *
 * Exported so syncEngine shares the same classification and can short-circuit
 * permanent errors instead of burning a full backoff cycle on them.
 */
export function isRetriableError(err: unknown): boolean {
  if (err == null) return true;

  const anyErr = err as {
    status?: unknown;
    statusCode?: unknown;
    code?: unknown;
    name?: unknown;
    message?: unknown;
  };

  // Supabase PostgREST errors expose .status on the response; some wrappers
  // expose .statusCode. Check both.
  const status =
    typeof anyErr.status === 'number'
      ? anyErr.status
      : typeof anyErr.statusCode === 'number'
        ? anyErr.statusCode
        : undefined;

  if (typeof status === 'number') {
    if (NON_RETRIABLE_STATUS.has(status)) return false;
    // 5xx and anything else → retriable
    return true;
  }

  // PostgREST returns string .code values like '23505' (unique violation),
  // 'PGRST301' (RLS), '42P01' (missing table). These are permanent.
  const code = typeof anyErr.code === 'string' ? anyErr.code : undefined;
  if (code) {
    // Postgres error codes are 5 chars (SQLSTATE). All of these are permanent
    // for our write paths — bad data, constraint violations, missing schema.
    if (/^\d{5}$/.test(code)) return false;
    if (code.startsWith('PGRST')) return false;
  }

  // Network-ish errors: fetch failure, timeout, aborted request → retriable.
  const name = typeof anyErr.name === 'string' ? anyErr.name : '';
  const message = typeof anyErr.message === 'string' ? anyErr.message : '';
  if (
    name === 'TypeError' ||
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    /failed to fetch|network|timeout|fetch failed/i.test(message)
  ) {
    return true;
  }

  // Unknown shape — default to retriable so we don't lose data on a transient
  // error we didn't recognize.
  return true;
}

// ── IndexedDB helpers ───────────────────────────────────────────────────────

let queueDbInstance: IDBDatabase | null = null;
let queueDbOpenPromise: Promise<IDBDatabase> | null = null;

function openQueueDB(): Promise<IDBDatabase> {
  if (queueDbInstance) return Promise.resolve(queueDbInstance);
  if (queueDbOpenPromise) return queueDbOpenPromise;

  queueDbOpenPromise = new Promise((resolve, reject) => {
    // v2 added the dead-letter store; v3 added the cross-tab lease store.
    const request = indexedDB.open('SparkOS_Queue', 3);
    request.onerror = () => {
      queueDbOpenPromise = null;
      reject(request.error);
    };
    request.onsuccess = () => {
      queueDbInstance = request.result;
      queueDbOpenPromise = null;
      queueDbInstance.onversionchange = () => {
        queueDbInstance?.close();
        queueDbInstance = null;
      };
      queueDbInstance.onclose = () => {
        queueDbInstance = null;
      };
      resolve(queueDbInstance);
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains(DEAD_LETTER_STORE)) {
        const dead = db.createObjectStore(DEAD_LETTER_STORE, { keyPath: 'id' });
        dead.createIndex('failedAt', 'failedAt', { unique: false });
      }
      // v3: cross-tab lease store used by services/syncLock.ts when the Web
      // Locks API is unavailable (Safari < 15.4). Lives in this database because
      // the queue is already the durable home of sync coordination state.
      if (!db.objectStoreNames.contains(LEASE_STORE)) {
        db.createObjectStore(LEASE_STORE, { keyPath: 'name' });
      }
    };
  });
  return queueDbOpenPromise;
}

// Monotonic sequence generator. Seeded from Date.now() and forced to strictly
// increase, so values are unique and ordered even when many mutations are
// enqueued within the same millisecond, and remain larger than any previously
// persisted seq across reloads (wall-clock only moves forward). Same ms scale
// as `timestamp`, so the two are directly comparable when sorting.
let lastSeq = 0;
function nextSeq(): number {
  lastSeq = Math.max(lastSeq + 1, Date.now());
  return lastSeq;
}

async function getAllMutations(): Promise<QueuedMutation[]> {
  const db = await openQueueDB();
  const mutations = await new Promise<QueuedMutation[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');
    const req = index.getAll();
    req.onsuccess = () => resolve(req.result as QueuedMutation[]);
    req.onerror = () => reject(req.error);
  });
  // Order by monotonic seq so create -> delete -> update FIFO holds even when
  // timestamps collide. Legacy rows without `seq` fall back to `timestamp`
  // (same scale) and sort as the oldest entries.
  return mutations.sort((a, b) => (a.seq ?? a.timestamp) - (b.seq ?? b.timestamp));
}

async function putMutation(mutation: QueuedMutation): Promise<void> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(mutation);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function deleteMutation(id: string): Promise<void> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

async function clearQueue(): Promise<void> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Dead-letter helpers ─────────────────────────────────────────────────────

/**
 * Move a mutation out of the active queue into the dead-letter store in ONE
 * transaction, so a crash can never drop the payload without recording it.
 */
async function moveToDeadLetter(
  mutation: QueuedMutation,
  reason: DeadLetterMutation['reason']
): Promise<void> {
  const db = await openQueueDB();
  const entry: DeadLetterMutation = { ...mutation, failedAt: Date.now(), reason };
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, DEAD_LETTER_STORE], 'readwrite');
    tx.objectStore(DEAD_LETTER_STORE).put(entry);
    tx.objectStore(STORE_NAME).delete(mutation.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getAllDeadLetters(): Promise<DeadLetterMutation[]> {
  const db = await openQueueDB();
  const rows = await new Promise<DeadLetterMutation[]>((resolve, reject) => {
    const tx = db.transaction(DEAD_LETTER_STORE, 'readonly');
    const req = tx.objectStore(DEAD_LETTER_STORE).getAll();
    req.onsuccess = () => resolve(req.result as DeadLetterMutation[]);
    req.onerror = () => reject(req.error);
  });
  return rows.sort((a, b) => b.failedAt - a.failedAt);
}

async function clearDeadLetterStore(): Promise<void> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DEAD_LETTER_STORE, 'readwrite');
    const req = tx.objectStore(DEAD_LETTER_STORE).clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ── Sync logic ─────────────────────────────────────────────────────────────

// Lazy-load supabaseSync once and cache the resolved module, rather than
// calling import() for every queued mutation processed.
let supabaseSyncModulePromise: Promise<typeof import('./supabaseSync')> | null = null;
const loadSupabaseSync = (): Promise<typeof import('./supabaseSync')> => {
  if (!supabaseSyncModulePromise) {
    supabaseSyncModulePromise = import('./supabaseSync');
  }
  return supabaseSyncModulePromise;
};

async function getSyncFn(type: MutationType, payload: unknown, userId: string) {
  const {
    syncWorkoutTemplate,
    deleteCloudWorkoutTemplate,
    syncWorkoutSession,
    deleteCloudWorkoutSession,
    syncPersonalExercise,
    deleteCloudPersonalExercise,
    syncBodyWeight,
    deleteCloudBodyWeight,
    syncBodyMeasurement,
    deleteCloudBodyMeasurement,
    syncPersonalRecord,
    deleteCloudPersonalRecord,
    syncRecoveryLog,
    deleteCloudRecoveryLog,
    syncNutritionLog,
    deleteCloudNutritionLog,
    syncUserSetting,
    syncAIConversation,
    softDeleteCloudAIConversation,
  } = await loadSupabaseSync();

  switch (type) {
    case 'template:create':
    case 'template:update':
      return () =>
        syncWorkoutTemplate(userId, payload as Parameters<typeof syncWorkoutTemplate>[1]);
    case 'template:delete':
      return () => deleteCloudWorkoutTemplate(userId, payload as string);
    case 'session:create':
    case 'session:update':
      return () => syncWorkoutSession(userId, payload as Parameters<typeof syncWorkoutSession>[1]);
    case 'session:delete':
      return () => deleteCloudWorkoutSession(userId, payload as string);
    case 'exercise:create':
    case 'exercise:update':
      return () =>
        syncPersonalExercise(userId, payload as Parameters<typeof syncPersonalExercise>[1]);
    case 'exercise:delete':
      return () => deleteCloudPersonalExercise(userId, payload as string);
    case 'bodyweight:create':
      return () => syncBodyWeight(userId, payload as Parameters<typeof syncBodyWeight>[1]);
    case 'bodyweight:delete':
      return () => deleteCloudBodyWeight(userId, payload as string);
    case 'measurement:create':
      return () =>
        syncBodyMeasurement(userId, payload as Parameters<typeof syncBodyMeasurement>[1]);
    case 'measurement:delete':
      return () => deleteCloudBodyMeasurement(userId, payload as string);
    case 'record:create':
      return () => syncPersonalRecord(userId, payload as Parameters<typeof syncPersonalRecord>[1]);
    case 'record:delete':
      return () => deleteCloudPersonalRecord(userId, payload as string);
    case 'recovery:create':
      return () => syncRecoveryLog(userId, payload as Parameters<typeof syncRecoveryLog>[1]);
    case 'recovery:delete':
      return () => deleteCloudRecoveryLog(userId, payload as string);
    case 'nutrition:create':
    case 'nutrition:update':
      return () => syncNutritionLog(userId, payload as Parameters<typeof syncNutritionLog>[1]);
    case 'nutrition:delete':
      return () => deleteCloudNutritionLog(userId, payload as string);
    case 'setting:update':
      return () => syncUserSetting(userId, payload as Parameters<typeof syncUserSetting>[1]);
    case 'ai:create':
    case 'ai:update':
      return () => syncAIConversation(userId, payload as Parameters<typeof syncAIConversation>[1]);
    case 'ai:delete':
      // Soft-delete so the tombstone propagates (mirrors deleteConversation).
      return () => softDeleteCloudAIConversation(userId, payload as string);
    case 'water:create':
      return async () => {
        const { syncWaterEntryToCloud } = await import('./waterService');
        await syncWaterEntryToCloud(
          userId,
          payload as { id: string; date: string; amountMl: number; createdAt: string }
        );
      };
    case 'water:delete':
      return async () => {
        const { deleteCloudWaterEntry } = await import('./waterService');
        await deleteCloudWaterEntry(userId, payload as string);
      };
    default:
      return null;
  }
}

// ── Dedup helpers ───────────────────────────────────────────────────────────

/**
 * Extract the underlying record id from a mutation payload.
 * - For delete mutations the payload is already the id (a string).
 * - For create/update mutations the payload is an object with an `id` field.
 * - 'setting:update' uses a `key` rather than a per-record id, so we key on
 *   that. We skip dedup for payload shapes we don't recognize rather than
 *   guess — returning null signals "leave this alone".
 */
function getRecordId(type: MutationType, payload: unknown): string | null {
  if (typeof payload === 'string' && payload.length > 0) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const obj = payload as { id?: unknown; key?: unknown };
    if (type === 'setting:update') {
      if (typeof obj.key === 'string' && obj.key.length > 0) return obj.key;
      if (typeof obj.id === 'string' && obj.id.length > 0) return obj.id;
      return null;
    }
    if (typeof obj.id === 'string' && obj.id.length > 0) return obj.id;
  }
  return null;
}

/** Compose an in-memory dedup key from mutation type + record id. */
function getDedupKey(type: MutationType, payload: unknown): string | null {
  const recordId = getRecordId(type, payload);
  if (!recordId) return null;
  return `${type}::${recordId}`;
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Queue a mutation for background sync
 * Call this when a local write succeeds but cloud sync fails
 *
 * Dedup: if an existing queued mutation targets the same record (same type +
 * same record id), we reuse its queue id so the new payload overwrites the
 * old one. This keeps the queue small when the user edits the same record
 * multiple times while offline. We dedup in memory only — the on-disk schema
 * is unchanged.
 */
export async function queueMutation(type: MutationType, payload: unknown): Promise<void> {
  const dedupKey = getDedupKey(type, payload);

  // Stamp the owner so the entry can never replay into another account on a
  // shared device. Ownership is ALWAYS recorded — including the two "no real
  // owner" cases — because an entry with no owner used to be adopted by whoever
  // happened to be signed in at replay time, which silently wrote one person's
  // data into another person's account.
  let userId: string;
  try {
    const { getCurrentUser } = await import('./supabaseAuth');
    userId = (await getCurrentUser())?.id ?? GUEST_OWNER;
  } catch {
    // Auth genuinely unavailable (not "signed out"). The mutation is kept, but
    // marked so replay quarantines it instead of guessing an owner.
    userId = UNKNOWN_OWNER;
  }

  const db = await openQueueDB();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    let queueId: string = crypto.randomUUID();

    function doPut() {
      store.put({
        id: queueId,
        type,
        payload,
        userId,
        timestamp: Date.now(),
        seq: nextSeq(),
        retryCount: 0,
      } as QueuedMutation);
    }

    if (dedupKey) {
      const idx = store.index('timestamp');
      const cursorReq = idx.openCursor();
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          const m = cursor.value as QueuedMutation;
          if (getDedupKey(m.type, m.payload) === dedupKey) {
            queueId = m.id;
            doPut();
            return;
          }
          cursor.continue();
        } else {
          doPut();
        }
      };
      cursorReq.onerror = () => doPut();
    } else {
      doPut();
    }

    tx.oncomplete = () => {
      logger.sync.info('Queued offline mutation', { type, id: queueId });
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// ── User-facing feedback ─────────────────────────────────────────────────────

// Lazy-load the toast module so this pure service never pulls the React/
// framer-motion GlobalToast component into its own (potentially worker/early
// boot) import graph. Matches the lazy-import style already used here for
// supabaseSync / waterService, and sidesteps any future circular-import risk.
async function notify(text: string, variant: 'error' | 'info'): Promise<void> {
  try {
    const { showToast } = await import('../components/ui/GlobalToast');
    showToast(text, variant);
  } catch {
    // Toast unavailable (e.g. container not mounted yet) — never let feedback
    // failures break queue processing.
  }
}

// True while a retriable-failure episode is ongoing. The "some changes didn't
// sync" toast fires once per episode instead of on every 90s periodic pass;
// the flag resets when a pass completes with no failures (queue drained or
// the retries finally succeeded), so a NEW episode toasts again.
let retriableFailureNotified = false;

/**
 * Debounced user-facing notice for retriable sync failures. Shared by the
 * startup / back-online / periodic queue passes. Exported for tests.
 */
export async function notifyRetriableFailures(): Promise<void> {
  if (retriableFailureNotified) return;
  retriableFailureNotified = true;
  await notify('חלק מהשינויים לא הסתנכרנו — ננסה שוב אוטומטית', 'error');
}

// ── Queue processing guard ──────────────────────────────────────────────────
// `isProcessing` only serialises calls inside THIS tab. Cross-tab exclusion
// comes from withSyncLock (services/syncLock.ts): two tabs replaying the same
// mutation would double-count retries and make ordering non-deterministic.
let isProcessing = false;

/**
 * Process all queued mutations.
 * Call on app start and when coming back online.
 *
 * Resolves with zeros when another tab holds the sync lock — sync is periodic
 * and idempotent, so standing down is correct and the next tick will retry.
 */
export async function processQueue(): Promise<{ success: number; failed: number }> {
  if (isProcessing) return { success: 0, failed: 0 };
  isProcessing = true;
  try {
    const outcome = await withSyncLock(() => processQueueInternal());
    if (outcome === BUSY) {
      logger.sync.info('Another tab is syncing, skipping queue pass');
      return { success: 0, failed: 0 };
    }
    return outcome;
  } finally {
    isProcessing = false;
  }
}

async function processQueueInternal(): Promise<{ success: number; failed: number }> {
  // Offline guard. Previously only the 90s timer checked connectivity, while
  // initOfflineSync() called processQueue() immediately on every app start. Each
  // offline start therefore burned one of MAX_RETRIES, so opening the app five
  // times without a network connection DELETED the queued workout.
  if (isOffline()) {
    logger.sync.info('Offline, deferring queue processing');
    return { success: 0, failed: 0 };
  }

  const { getCurrentUser } = await import('./supabaseAuth');
  const user = await getCurrentUser();
  if (!user?.id) {
    logger.sync.info('Not authenticated, skipping queue processing');
    return { success: 0, failed: 0 };
  }

  const mutations = await getAllMutations();
  if (mutations.length === 0) {
    // Empty queue — any failure episode is over.
    retriableFailureNotified = false;
    return { success: 0, failed: 0 };
  }

  logger.sync.info(`Processing ${mutations.length} queued mutations`);

  let success = 0;
  let failed = 0;
  // Number of mutations permanently dropped in this pass (4xx or max retries).
  // Reported as a single, correctly-pluralized toast per run so a burst of
  // drops can't spam the user.
  let droppedCount = 0;
  // Ownerless entries moved to quarantine in this pass. Reported separately: the
  // user has to decide whether to claim them, so the message must not read like a
  // sync failure.
  let quarantinedCount = 0;

  // Track dedup keys we've already successfully synced in this pass. If a
  // later queued entry targets the same record we can drop it — the latest
  // writable state for that record is already up.
  const processedKeys = new Set<string>();

  for (const mutation of mutations) {
    // Respect the backoff window so a persistently failing entry is not retried
    // (and charged an attempt) on every tick.
    if (mutation.nextAttemptAt && mutation.nextAttemptAt > Date.now()) {
      continue;
    }

    // Cross-account guard. An entry with a DIFFERENT owner is dropped: it can
    // never legitimately replay here. An entry with NO owner (guest mode, a
    // failed auth lookup, or a row written before ownership existed) is
    // QUARANTINED rather than adopted — adopting it silently wrote one person's
    // change into another person's account on a shared device.
    if (isOwnerless(mutation.userId)) {
      logger.sync.warn('Quarantining ownerless queued mutation', {
        type: mutation.type,
        id: mutation.id,
        owner: mutation.userId ?? 'legacy',
      });
      await moveToDeadLetter(mutation, 'ownerless');
      quarantinedCount++;
      continue;
    }
    if (mutation.userId !== user.id) {
      logger.sync.warn('Dropping queued mutation owned by another user', {
        type: mutation.type,
        id: mutation.id,
      });
      await deleteMutation(mutation.id);
      continue;
    }

    const dedupKey = getDedupKey(mutation.type, mutation.payload);
    if (dedupKey && processedKeys.has(dedupKey)) {
      logger.sync.info('Skipping already-synced record in this pass', {
        type: mutation.type,
        id: mutation.id,
      });
      await deleteMutation(mutation.id);
      continue;
    }

    const syncFn = await getSyncFn(mutation.type, mutation.payload, user.id);
    if (!syncFn) {
      logger.sync.warn('Unknown mutation type, dropping', { type: mutation.type });
      await deleteMutation(mutation.id);
      continue;
    }

    try {
      await syncFn();
      await deleteMutation(mutation.id);
      if (dedupKey) processedKeys.add(dedupKey);
      success++;
      logger.sync.info('Synced queued mutation', { type: mutation.type, id: mutation.id });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);

      // Permanent failure → stop retrying, but KEEP the payload.
      if (!isRetriableError(err)) {
        logger.sync.error('Non-retriable error, moving mutation to dead letter', {
          type: mutation.type,
          id: mutation.id,
          error: errMsg,
        });
        mutation.lastError = errMsg;
        await moveToDeadLetter(mutation, 'permanent_error');
        droppedCount++;
        failed++;
        continue;
      }

      mutation.retryCount++;
      mutation.lastError = errMsg;
      mutation.nextAttemptAt = Date.now() + backoffFor(mutation.retryCount);

      if (mutation.retryCount >= MAX_RETRIES) {
        logger.sync.error('Mutation exceeded max retries, moving to dead letter', {
          type: mutation.type,
          id: mutation.id,
          errors: mutation.lastError,
        });
        await moveToDeadLetter(mutation, 'max_retries');
        droppedCount++;
      } else {
        await putMutation(mutation);
        logger.sync.warn('Mutation failed, will retry', {
          type: mutation.type,
          id: mutation.id,
          retryCount: mutation.retryCount,
          nextAttemptAt: mutation.nextAttemptAt,
          error: mutation.lastError,
        });
      }
      failed++;
    }
  }

  // One toast per run if anything stopped being retried. The wording matters:
  // the change is NOT lost any more — it sits in the dead-letter store and can
  // be retried or exported from Settings.
  if (droppedCount > 0) {
    await notify(
      droppedCount === 1
        ? 'שינוי אחד לא נשמר בענן. הוא נשמר במכשיר וניתן לנסות שוב מההגדרות'
        : `${droppedCount} שינויים לא נשמרו בענן. הם נשמרו במכשיר וניתן לנסות שוב מההגדרות`,
      'error'
    );
  }

  // Quarantine is not a failure: these changes were made without a signed-in
  // account, so only the user can decide whether they belong to this account.
  if (quarantinedCount > 0) {
    await notify(
      quarantinedCount === 1
        ? 'שינוי אחד נוצר ללא חשבון מחובר. אשרו אותו מההגדרות כדי לשמור אותו בענן'
        : `${quarantinedCount} שינויים נוצרו ללא חשבון מחובר. אשרו אותם מההגדרות כדי לשמור אותם בענן`,
      'info'
    );
  }

  // A clean pass (nothing left failing) ends the retriable-failure episode,
  // re-arming the debounced notice for the next one.
  if (failed === 0) {
    retriableFailureNotified = false;
  }

  return { success, failed };
}

/**
 * Get current queue depth
 */
export async function getQueueDepth(): Promise<number> {
  const mutations = await getAllMutations();
  return mutations.length;
}

/**
 * Clear the entire queue (use with caution)
 */
export async function clearMutationQueue(): Promise<void> {
  await clearQueue();
  await clearDeadLetterStore();
  retriableFailureNotified = false;
  logger.sync.info('Cleared mutation queue');
}

// ── Dead-letter recovery API ────────────────────────────────────────────────
//
// Mutations that stop being retried used to be deleted, which meant a failed
// sync silently destroyed the user's change. They are now retained here so the
// data can be recovered, retried once the cause is fixed, or exported before
// being discarded deliberately.

/** How many unsynced changes are being held for recovery. */
export async function getDeadLetterCount(): Promise<number> {
  const rows = await getAllDeadLetters();
  return rows.length;
}

/** All held changes, newest failure first. */
export async function listDeadLetters(): Promise<DeadLetterMutation[]> {
  return getAllDeadLetters();
}

/**
 * Put a held change back into the active queue with a clean retry budget, then
 * attempt a pass immediately. Returns false when the id is unknown.
 */
export async function retryDeadLetter(id: string): Promise<boolean> {
  const rows = await getAllDeadLetters();
  const entry = rows.find((row) => row.id === id);
  if (!entry) return false;

  const { failedAt: _failedAt, reason, ...mutation } = entry;

  // Re-queuing an OWNERLESS entry is the user's explicit act of claiming it for
  // the account they are signed into now. Without re-stamping the owner it would
  // be quarantined again on the next pass, and "retry" would appear broken.
  let userId = mutation.userId;
  if (reason === 'ownerless' || isOwnerless(userId)) {
    try {
      const { getCurrentUser } = await import('./supabaseAuth');
      const current = (await getCurrentUser())?.id;
      if (!current) {
        logger.sync.warn('Cannot claim an ownerless change while signed out', { id });
        return false;
      }
      userId = current;
    } catch (err) {
      logger.sync.warn('Cannot resolve the current account to claim a change', err);
      return false;
    }
  }

  await putMutation({ ...mutation, userId, retryCount: 0, nextAttemptAt: undefined });

  const db = await openQueueDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DEAD_LETTER_STORE, 'readwrite');
    const req = tx.objectStore(DEAD_LETTER_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  await processQueue();
  return true;
}

/** Retry every held change. Returns how many were re-queued. */
export async function retryAllDeadLetters(): Promise<number> {
  const rows = await getAllDeadLetters();
  let requeued = 0;
  for (const row of rows) {
    if (await retryDeadLetter(row.id)) requeued++;
  }
  return requeued;
}

/** Permanently discard a held change. Only ever call this on explicit user intent. */
export async function discardDeadLetter(id: string): Promise<void> {
  const db = await openQueueDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DEAD_LETTER_STORE, 'readwrite');
    const req = tx.objectStore(DEAD_LETTER_STORE).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  logger.sync.warn('Discarded dead-letter mutation on user request', { id });
}

/** JSON snapshot of all held changes, so a user can keep their data before discarding. */
export async function exportDeadLetters(): Promise<string> {
  const rows = await getAllDeadLetters();
  return JSON.stringify({ exportedAt: new Date().toISOString(), mutations: rows }, null, 2);
}

// ── Online/offline detection ────────────────────────────────────────────────

function setupOnlineListener() {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', async () => {
    try {
      logger.sync.info('Network back online, processing queue');
      const result = await processQueue();
      if (result.success > 0 || result.failed > 0) {
        logger.sync.info('Queue processing complete', result);
      }
      if (result.failed > 0) {
        await notifyRetriableFailures();
      }
    } catch (err) {
      // An async event listener that rejects becomes an unhandled rejection.
      logger.sync.error('Online-handler queue processing failed', err);
    }
  });

  window.addEventListener('offline', () => {
    logger.sync.info('Network went offline');
  });
}

// Auto-initialize on first import
let initialized = false;
export function initOfflineSync() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;
  setupOnlineListener();

  // Process any pending mutations on startup
  processQueue()
    .then((result) => {
      if (result.success > 0) {
        logger.sync.info('Processed queued mutations on startup', result);
      }
      if (result.failed > 0) {
        void notifyRetriableFailures();
      }
    })
    .catch((err) => logger.sync.error('Startup queue processing failed', err));

  // DA-9: Periodic retry every 90s when online and queue has items
  setInterval(async () => {
    // An async setInterval callback that rejects becomes an unhandled
    // rejection — keep the whole body inside a try/catch.
    try {
      if (!navigator.onLine) return;
      const depth = await getQueueDepth();
      if (depth === 0) return;
      const result = await processQueue();
      if (result.success > 0 || result.failed > 0) {
        logger.sync.info('Periodic queue retry', result);
      }
      if (result.failed > 0) {
        await notifyRetriableFailures();
      }
    } catch (err) {
      logger.sync.error('Periodic queue retry failed', err);
    }
  }, 90_000);
}

/**
 * Offline Mutation Queue
 * Queues failed sync operations for retry when back online
 * Works with the existing supabaseSync service
 */

import { logger } from '../utils/logger';

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
  timestamp: number;
  // Monotonic sequence assigned at enqueue time. Two mutations enqueued within
  // the same millisecond share a timestamp, so timestamp alone cannot preserve
  // FIFO order (e.g. create -> delete -> update of one record). `seq` breaks
  // those ties deterministically. Optional for backward compat with rows
  // written before this field existed (they sort first, as the oldest).
  seq?: number;
  retryCount: number;
  lastError?: string;
}

const STORE_NAME = 'mutation_queue';
const MAX_RETRIES = 5;

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
 */
function isRetriableError(err: unknown): boolean {
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
    const request = indexedDB.open('SparkOS_Queue', 1);
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
    deleteCloudAIConversation,
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
      return () => deleteCloudAIConversation(userId, payload as string);
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

// ── Queue processing guard ──────────────────────────────────────────────────
let isProcessing = false;

/**
 * Process all queued mutations
 * Call on app start and when coming back online
 */
export async function processQueue(): Promise<{ success: number; failed: number }> {
  if (isProcessing) return { success: 0, failed: 0 };
  isProcessing = true;
  try {
    return await processQueueInternal();
  } finally {
    isProcessing = false;
  }
}

async function processQueueInternal(): Promise<{ success: number; failed: number }> {
  const { getCurrentUser } = await import('./supabaseAuth');
  const user = await getCurrentUser();
  if (!user?.id) {
    logger.sync.info('Not authenticated, skipping queue processing');
    return { success: 0, failed: 0 };
  }

  const mutations = await getAllMutations();
  if (mutations.length === 0) return { success: 0, failed: 0 };

  logger.sync.info(`Processing ${mutations.length} queued mutations`);

  let success = 0;
  let failed = 0;
  // True once any mutation is permanently dropped in this pass (4xx or max
  // retries). Debounced to a single toast per run so a burst of drops can't
  // spam the user.
  let droppedPermanently = false;

  // Track dedup keys we've already successfully synced in this pass. If a
  // later queued entry targets the same record we can drop it — the latest
  // writable state for that record is already up.
  const processedKeys = new Set<string>();

  for (const mutation of mutations) {
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

      // Permanent failure → drop and stop retrying.
      if (!isRetriableError(err)) {
        logger.sync.error('Non-retriable error, dropping mutation', {
          type: mutation.type,
          id: mutation.id,
          error: errMsg,
        });
        await deleteMutation(mutation.id);
        droppedPermanently = true;
        failed++;
        continue;
      }

      mutation.retryCount++;
      mutation.lastError = errMsg;

      if (mutation.retryCount >= MAX_RETRIES) {
        logger.sync.error('Mutation exceeded max retries, dropping', {
          type: mutation.type,
          id: mutation.id,
          errors: mutation.lastError,
        });
        await deleteMutation(mutation.id);
        droppedPermanently = true;
      } else {
        await putMutation(mutation);
        logger.sync.warn('Mutation failed, will retry', {
          type: mutation.type,
          id: mutation.id,
          retryCount: mutation.retryCount,
          error: mutation.lastError,
        });
      }
      failed++;
    }
  }

  // One toast per run if anything was permanently dropped — debounced so a
  // burst of drops in a single pass doesn't spam the user.
  if (droppedPermanently) {
    await notify('שינוי אחד לא נשמר בענן', 'error');
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
  logger.sync.info('Cleared mutation queue');
}

// ── Online/offline detection ────────────────────────────────────────────────

function setupOnlineListener() {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', async () => {
    logger.sync.info('Network back online, processing queue');
    const result = await processQueue();
    if (result.success > 0 || result.failed > 0) {
      logger.sync.info('Queue processing complete', result);
    }
    if (result.failed > 0) {
      await notify('חלק מהשינויים לא הסתנכרנו — ננסה שוב אוטומטית', 'error');
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
  processQueue().then((result) => {
    if (result.success > 0) {
      logger.sync.info('Processed queued mutations on startup', result);
    }
    if (result.failed > 0) {
      void notify('חלק מהשינויים לא הסתנכרנו — ננסה שוב אוטומטית', 'error');
    }
  });

  // DA-9: Periodic retry every 90s when online and queue has items
  setInterval(async () => {
    if (!navigator.onLine) return;
    const depth = await getQueueDepth();
    if (depth === 0) return;
    const result = await processQueue();
    if (result.success > 0 || result.failed > 0) {
      logger.sync.info('Periodic queue retry', result);
    }
    if (result.failed > 0) {
      await notify('חלק מהשינויים לא הסתנכרנו — ננסה שוב אוטומטית', 'error');
    }
  }, 90_000);
}

/**
 * Offline Mutation Queue
 * Queues failed sync operations for retry when back online
 * Works with the existing supabaseSync service
 */

import { logger } from '../utils/logger';

// ── Types ────────────────────────────────────────────────────────────────────

type MutationType =
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
  | 'ai:delete';

interface QueuedMutation {
  id: string;
  type: MutationType;
  payload: unknown;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

const STORE_NAME = 'mutation_queue';
const MAX_RETRIES = 5;

// ── IndexedDB helpers ───────────────────────────────────────────────────────

function openQueueDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SparkOS_Queue', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

async function getAllMutations(): Promise<QueuedMutation[]> {
  const db = await openQueueDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
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
  } = await import('./supabaseSync');

  switch (type) {
    case 'template:create':
    case 'template:update':
      return () => syncWorkoutTemplate(userId, payload as Parameters<typeof syncWorkoutTemplate>[1]);
    case 'template:delete':
      return () => deleteCloudWorkoutTemplate(userId, payload as string);
    case 'session:create':
    case 'session:update':
      return () => syncWorkoutSession(userId, payload as Parameters<typeof syncWorkoutSession>[1]);
    case 'session:delete':
      return () => deleteCloudWorkoutSession(userId, payload as string);
    case 'exercise:create':
    case 'exercise:update':
      return () => syncPersonalExercise(userId, payload as Parameters<typeof syncPersonalExercise>[1]);
    case 'exercise:delete':
      return () => deleteCloudPersonalExercise(userId, payload as string);
    case 'bodyweight:create':
      return () => syncBodyWeight(userId, payload as Parameters<typeof syncBodyWeight>[1]);
    case 'bodyweight:delete':
      return () => deleteCloudBodyWeight(userId, payload as string);
    case 'measurement:create':
      return () => syncBodyMeasurement(userId, payload as Parameters<typeof syncBodyMeasurement>[1]);
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
    default:
      return null;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Queue a mutation for background sync
 * Call this when a local write succeeds but cloud sync fails
 */
export async function queueMutation(type: MutationType, payload: unknown): Promise<void> {
  const mutation: QueuedMutation = {
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
  };

  try {
    await putMutation(mutation);
    logger.sync.info('Queued offline mutation', { type, id: mutation.id });
  } catch (err) {
    logger.sync.error('Failed to queue mutation', err);
  }
}

/**
 * Process all queued mutations
 * Call on app start and when coming back online
 */
export async function processQueue(): Promise<{ success: number; failed: number }> {
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

  for (const mutation of mutations) {
    const syncFn = await getSyncFn(mutation.type, mutation.payload, user.id);
    if (!syncFn) {
      logger.sync.warn('Unknown mutation type, dropping', { type: mutation.type });
      await deleteMutation(mutation.id);
      continue;
    }

    try {
      await syncFn();
      await deleteMutation(mutation.id);
      success++;
      logger.sync.info('Synced queued mutation', { type: mutation.type, id: mutation.id });
    } catch (err) {
      mutation.retryCount++;
      mutation.lastError = err instanceof Error ? err.message : String(err);

      if (mutation.retryCount >= MAX_RETRIES) {
        logger.sync.error('Mutation exceeded max retries, dropping', {
          type: mutation.type,
          id: mutation.id,
          errors: mutation.lastError,
        });
        await deleteMutation(mutation.id);
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

let isProcessing = false;

function setupOnlineListener() {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', async () => {
    logger.sync.info('Network back online, processing queue');
    if (!isProcessing) {
      isProcessing = true;
      try {
        const result = await processQueue();
        if (result.success > 0 || result.failed > 0) {
          logger.sync.info('Queue processing complete', result);
        }
      } finally {
        isProcessing = false;
      }
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
  });
}

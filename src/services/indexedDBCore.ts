/**
 * IndexedDB Core Service
 * Low-level CRUD operations for the fitness app
 */

import { isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';

const DB_NAME = 'sparkos-fitness-db';
const DB_VERSION = 5;

// Store names
export const STORES = {
  WORKOUT_SESSIONS: 'workout_sessions',
  WORKOUT_TEMPLATES: 'workout_templates',
  PERSONAL_EXERCISES: 'personal_exercises',
  BODY_WEIGHT: 'body_weight',
  BODY_MEASUREMENTS: 'body_measurements',
  RECOVERY_LOGS: 'recovery_logs',
  NUTRITION_LOGS: 'nutrition_logs',
  USER_SETTINGS: 'user_settings',
  PERSONAL_RECORDS: 'personal_records',
  AI_CONVERSATIONS: 'ai_conversations',
  PENDING_SYNC: 'pending_sync',
  PERSONAL_ITEMS: 'personal_items',
} as const;

// Promise-based DB helpers
let dbInstance: IDBDatabase | null = null;
// Memoize the in-flight open promise so concurrent callers share one IDBOpenDBRequest.
// Without this, multiple simultaneous callers each issue indexedDB.open(), which causes
// the second open to block until the first's upgrade transaction completes, then read an
// empty store before seeding has finished — producing a blank exercise list on first load.
let dbOpenPromise: Promise<IDBDatabase> | null = null;

/**
 * Safely create an index on an object store if it doesn't already exist.
 * This is necessary because trying to create a duplicate index during an
 * upgrade transaction throws a DOMException.
 */
const createIndexIfMissing = (
  store: IDBObjectStore,
  indexName: string,
  keyPath: string | string[],
  options?: IDBIndexParameters
): void => {
  if (!store.indexNames.contains(indexName)) {
    store.createIndex(indexName, keyPath, options);
  }
};

export const initDB = (): Promise<IDBDatabase> => {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbOpenPromise) return dbOpenPromise;

  dbOpenPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbOpenPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbOpenPromise = null;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const upgradeTx = request.transaction;

      // ── v1 stores (original 8 object stores) ──────────────────────────

      if (!db.objectStoreNames.contains(STORES.WORKOUT_SESSIONS)) {
        db.createObjectStore(STORES.WORKOUT_SESSIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.WORKOUT_TEMPLATES)) {
        db.createObjectStore(STORES.WORKOUT_TEMPLATES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.PERSONAL_EXERCISES)) {
        db.createObjectStore(STORES.PERSONAL_EXERCISES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.BODY_WEIGHT)) {
        db.createObjectStore(STORES.BODY_WEIGHT, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.BODY_MEASUREMENTS)) {
        db.createObjectStore(STORES.BODY_MEASUREMENTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.RECOVERY_LOGS)) {
        db.createObjectStore(STORES.RECOVERY_LOGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.NUTRITION_LOGS)) {
        db.createObjectStore(STORES.NUTRITION_LOGS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORES.USER_SETTINGS)) {
        db.createObjectStore(STORES.USER_SETTINGS, { keyPath: 'key' });
      }

      // ── v2 indexes (added to existing stores) ─────────────────────────

      if (upgradeTx && db.objectStoreNames.contains(STORES.WORKOUT_SESSIONS)) {
        const workoutStore = upgradeTx.objectStore(STORES.WORKOUT_SESSIONS);
        createIndexIfMissing(workoutStore, 'date', 'date');
      }

      if (upgradeTx && db.objectStoreNames.contains(STORES.RECOVERY_LOGS)) {
        const recoveryStore = upgradeTx.objectStore(STORES.RECOVERY_LOGS);
        createIndexIfMissing(recoveryStore, 'date', 'date');
      }

      // ── v3 stores (new object stores) ─────────────────────────────────

      if (!db.objectStoreNames.contains(STORES.PERSONAL_RECORDS)) {
        const prStore = db.createObjectStore(STORES.PERSONAL_RECORDS, { keyPath: 'id' });
        prStore.createIndex('exerciseId', 'exerciseId', { unique: false });
        prStore.createIndex('date', 'date', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.AI_CONVERSATIONS)) {
        db.createObjectStore(STORES.AI_CONVERSATIONS, { keyPath: 'id' });
      }

      // ── v4 store: pending sync queue ────────────────────────────────

      if (!db.objectStoreNames.contains(STORES.PENDING_SYNC)) {
        const pendingStore = db.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'tag' });
        pendingStore.createIndex('createdAt', 'createdAt', { unique: false });
        pendingStore.createIndex('retryCount', 'retryCount', { unique: false });
      }

      // ── v5 store: personal items ──────────────────────────────────

      if (!db.objectStoreNames.contains(STORES.PERSONAL_ITEMS)) {
        db.createObjectStore(STORES.PERSONAL_ITEMS, { keyPath: 'id' });
      }
    };
  });

  return dbOpenPromise;
};

// Generic get single item
export const dbGet = <T>(storeName: string, key: string): Promise<T> => {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  });
};

// Generic get all items
export const dbGetAll = <T>(storeName: string): Promise<T[]> => {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  });
};

// Generic get by index
export const dbGetByIndex = <T>(
  storeName: string,
  indexName: string,
  value: IDBValidKey
): Promise<T[]> => {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  });
};

// Generic get by key range
export const dbGetByRange = <T>(
  storeName: string,
  indexName: string,
  lower: IDBValidKey,
  upper: IDBValidKey
): Promise<T[]> => {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const range = IDBKeyRange.bound(lower, upper);
      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result as T[]);
      request.onerror = () => reject(request.error);
    });
  });
};

// Generic put (create or update)
export const dbPut = <T extends object>(storeName: string, item: T): Promise<void> => {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
};

// Generic delete
export const dbDelete = (storeName: string, key: string): Promise<void> => {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
};

// Clear all items from a store
export const dbClear = (storeName: string): Promise<void> => {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
};

// ==================== SYNC WITH RETRY & PENDING QUEUE ====================

export interface SyncResult {
  success: boolean;
  synced: number;
  pending: number;
  skipped: boolean;
  error?: string;
}

interface PendingSyncEntry {
  tag: string;
  operation: string;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const tryExecuteSync = async (
  syncFn: () => Promise<void>,
  maxRetries: number
): Promise<{ success: boolean; error?: string }> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await syncFn();
      return { success: true };
    } catch (err) {
      const delay = 1000 * 2 ** attempt;
      const isLastAttempt = attempt === maxRetries - 1;

      if (!isLastAttempt) {
        logger.sync.warn(
          `Sync attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms`,
          err
        );
        await sleep(delay);
      } else {
        logger.sync.error(`Sync failed after ${maxRetries} attempts`, err);
        return { success: false, error: String(err) };
      }
    }
  }
  return { success: false, error: 'Unexpected sync failure' };
};

const queuePendingSync = async (tag: string, operation: string, error?: string): Promise<void> => {
  try {
    const entry: PendingSyncEntry = {
      tag,
      operation,
      createdAt: new Date().toISOString(),
      retryCount: 0,
      lastError: error,
    };
    await dbPut(STORES.PENDING_SYNC, entry);
    logger.sync.info(`Queued pending sync: ${tag}`);
  } catch (err) {
    logger.sync.error(`Failed to queue pending sync "${tag}"`, err);
  }
};

const clearPendingSync = async (tag: string): Promise<void> => {
  try {
    await dbDelete(STORES.PENDING_SYNC, tag);
  } catch {
    // Non-fatal if the entry never existed
  }
};

/**
 * Sync with exponential-backoff retry. On final failure the operation is
 * queued so `syncPendingToServer` can process it later.
 *
 * @param syncFn  Async function that performs one cloud sync operation.
 * @param tag     Unique identifier for this sync item (used for queue dedup).
 * @param maxRetries  Number of attempts before queueing (default 3).
 */
export const syncWithRetry = (syncFn: () => Promise<void>, tag: string, maxRetries = 3): void => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return;
  }

  if (!isSupabaseConfigured()) {
    return;
  }

  tryExecuteSync(syncFn, maxRetries)
    .then(async (result) => {
      if (!result.success) {
        await queuePendingSync(tag, tag, result.error);
      } else {
        await clearPendingSync(tag);
      }
    })
    .catch((err) => {
      logger.sync.error(`Unexpected error in syncWithRetry for "${tag}"`, err);
      queuePendingSync(tag, tag, String(err)).catch(() => {});
    });
};

/**
 * Processes all pending sync entries stored in IndexedDB.
 * Call this when connectivity is restored (e.g. on app start, online event).
 * Re-queues any that fail again, up to `maxRetries` times before discarding.
 *
 * @param syncFn  Async function that re-executes the pending operation.
 * @param maxRetries  Total retry cap per entry (default 3). When the stored
 *                    `retryCount` hits this limit the entry is dropped.
 */
export const syncPendingToServer = async (
  syncFn: (tag: string) => Promise<void>,
  maxRetries = 3
): Promise<SyncResult> => {
  if (!isSupabaseConfigured()) {
    return { success: true, synced: 0, pending: 0, skipped: true };
  }

  let synced = 0;
  let pending = 0;

  try {
    const pendingEntries = await dbGetAll<PendingSyncEntry>(STORES.PENDING_SYNC);

    await Promise.all(
      pendingEntries.map(async (entry) => {
        try {
          await syncFn(entry.tag);
          await clearPendingSync(entry.tag);
          synced++;
          logger.sync.info(`Pending sync resolved: ${entry.tag}`);
        } catch (err) {
          const newCount = entry.retryCount + 1;
          if (newCount >= maxRetries) {
            logger.sync.warn(`Pending sync "${entry.tag}" exceeded max retries — discarding`, err);
            await clearPendingSync(entry.tag);
          } else {
            const updated: PendingSyncEntry = {
              ...entry,
              retryCount: newCount,
              lastError: String(err),
            };
            await dbPut(STORES.PENDING_SYNC, updated);
            logger.sync.warn(
              `Pending sync "${entry.tag}" retry ${newCount}/${maxRetries} failed`,
              err
            );
          }
          pending++;
        }
      })
    );

    return { success: true, synced, pending, skipped: false };
  } catch (err) {
    logger.sync.error('Error processing pending syncs', err);
    return { success: false, synced, pending, skipped: false, error: String(err) };
  }
};

// Clear entire database (for development/reset)
export const clearDatabase = (): Promise<void> => {
  // Close any open connection first; deleteDatabase blocks while connections are open.
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbOpenPromise = null;

  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error('clearDatabase blocked: close all tabs/connections'));
  });
};

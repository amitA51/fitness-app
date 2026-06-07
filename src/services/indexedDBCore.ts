/**
 * IndexedDB Core Service
 * Low-level CRUD operations for the fitness app
 */

const DB_NAME = 'sparkos-fitness-db';
const DB_VERSION = 9;

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
  WATER_LOGS: 'water_logs',
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

    request.onblocked = () => {
      dbOpenPromise = null;
      reject(new Error('initDB blocked: close other tabs using this database'));
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      dbOpenPromise = null;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      dbInstance.onclose = () => {
        dbInstance = null;
      };
      dbInstance.onerror = () => {
        dbInstance = null;
      };
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

      // ── v6 store: water logs ──────────────────────────────────

      if (!db.objectStoreNames.contains(STORES.WATER_LOGS)) {
        const waterStore = db.createObjectStore(STORES.WATER_LOGS, { keyPath: 'id' });
        createIndexIfMissing(waterStore, 'date', 'date');
      }

      // ── v7 indexes: startTime index on workout_sessions ──────────────
      // The Dashboard, History, Progress, and Active Workout screens all
      // sort sessions by `startTime` descending. Without an index we were
      // doing a full table scan + JS-side sort on every read. The cursor
      // path in `getWorkoutSessions` reads only `limit` records via this
      // index in proper order.
      if (upgradeTx && db.objectStoreNames.contains(STORES.WORKOUT_SESSIONS)) {
        const workoutStore = upgradeTx.objectStore(STORES.WORKOUT_SESSIONS);
        createIndexIfMissing(workoutStore, 'startTime', 'startTime');
      }

      // ── v8 indexes: date index on nutrition_logs ──────────────────────
      // DA-11: Enables range queries by date instead of full-table scans.
      if (upgradeTx && db.objectStoreNames.contains(STORES.NUTRITION_LOGS)) {
        const nutritionStore = upgradeTx.objectStore(STORES.NUTRITION_LOGS);
        createIndexIfMissing(nutritionStore, 'date', 'date');
      }

      // -- v9 indexes: date indexes on body-stat stores ---------------------
      // Progress reads body weight and measurements by date range. Index those
      // stores so future range helpers can avoid full-table scans as histories
      // grow across months of daily tracking.
      if (upgradeTx && db.objectStoreNames.contains(STORES.BODY_WEIGHT)) {
        const bodyWeightStore = upgradeTx.objectStore(STORES.BODY_WEIGHT);
        createIndexIfMissing(bodyWeightStore, 'date', 'date');
      }
      if (upgradeTx && db.objectStoreNames.contains(STORES.BODY_MEASUREMENTS)) {
        const bodyMeasurementsStore = upgradeTx.objectStore(STORES.BODY_MEASUREMENTS);
        createIndexIfMissing(bodyMeasurementsStore, 'date', 'date');
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

// Generic get all items ordered by an index
export const dbGetAllByIndex = <T>(storeName: string, indexName: string): Promise<T[]> => {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const index = store.index(indexName);
      const request = index.getAll();

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
      store.put(item);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
    });
  });
};

// Generic delete
export const dbDelete = (storeName: string, key: string): Promise<void> => {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.delete(key);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
    });
  });
};

// Clear all items from a store
export const dbClear = (storeName: string): Promise<void> => {
  return initDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
    });
  });
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

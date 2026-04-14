/**
 * IndexedDB Core Service
 * Low-level CRUD operations for the fitness app
 */

const DB_NAME = 'sparkos-fitness-db';
const DB_VERSION = 3;

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

      if (db.objectStoreNames.contains(STORES.WORKOUT_SESSIONS)) {
        const workoutStore = request.transaction!.objectStore(STORES.WORKOUT_SESSIONS);
        createIndexIfMissing(workoutStore, 'date', 'date');
      }

      if (db.objectStoreNames.contains(STORES.RECOVERY_LOGS)) {
        const recoveryStore = request.transaction!.objectStore(STORES.RECOVERY_LOGS);
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
export const dbGetByIndex = <T>(storeName: string, indexName: string, value: IDBValidKey): Promise<T[]> => {
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
export const dbGetByRange = <T>(storeName: string, indexName: string, lower: IDBValidKey, upper: IDBValidKey): Promise<T[]> => {
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

// Sync with retry (for cloud sync - no-op if no auth)
export const syncWithRetry = (
  _syncFn: () => Promise<void>,
  _tag: string,
  _maxRetries = 3
): void => {
  // Cloud sync will be added when Firebase is configured
  // For now, this is a no-op
};

// Clear entire database (for development/reset)
export const clearDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => {
      dbInstance = null;
      dbOpenPromise = null;
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

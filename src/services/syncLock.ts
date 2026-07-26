// ============================================================================
// SYNC LOCK — mutual exclusion for sync work ACROSS TABS
// ============================================================================
// The queue processor and the full-sync orchestrator each guarded themselves
// with a module-level boolean (`isProcessing`, `syncAllInFlight`). Those live in
// one JS realm, so they only serialise work inside a single tab. With the app
// open in two tabs — completely normal for a PWA on desktop, and also what
// happens when a Home-Screen instance and a browser tab are both alive — both
// tabs replay the same offline mutation and run competing full pushes. The
// consequences are not theoretical: retry counters advance twice as fast, the
// mutation order between tabs is non-deterministic, and two blind bulk upserts
// racing each other decide the last-write-wins outcome by network timing.
//
// Primary mechanism: the Web Locks API, which is per-origin and therefore
// genuinely cross-tab, and releases automatically if a tab crashes.
//
// Fallback (Safari < 15.4 and any context without navigator.locks): a lease row
// in IndexedDB with an expiry that the holder renews while it works. A crashed
// holder's lease simply expires, so the fallback cannot deadlock either.
// ============================================================================

import { logger } from '../utils/logger';

/** Single lock name for all sync work: queue replay and full sync must not interleave. */
const LOCK_NAME = 'sparkos-sync';

/** Lease lifetime for the fallback. Short enough to recover quickly from a crash. */
const LEASE_TTL_MS = 15_000;
/** Renewal cadence — comfortably inside the TTL so a slow tick cannot expire a live lease. */
const LEASE_RENEW_MS = 5_000;

const DB_NAME = 'SparkOS_Queue';
const LEASE_STORE = 'sync_leases';

interface LeaseRecord {
  name: string;
  holder: string;
  expiresAt: number;
}

/** Identifies this tab for the lifetime of the document. */
const HOLDER_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2)}`;

function hasWebLocks(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'locks' in navigator &&
    typeof (navigator as Navigator & { locks?: LockManager }).locks?.request === 'function'
  );
}

// ── IndexedDB lease fallback ────────────────────────────────────────────────
//
// Opens the queue database WITHOUT a version so it never races the queue's own
// upgrade. The lease store is created by offlineQueue's upgrade handler; if it
// is absent we degrade to "no cross-tab lock" rather than blocking sync.

function openLeaseDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LEASE_STORE)) {
        db.close();
        resolve(null);
        return;
      }
      resolve(db);
    };
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

/**
 * Atomically take the lease if it is free or expired. The read and the write
 * happen in ONE readwrite transaction, which is what makes this safe against two
 * tabs asking at the same moment.
 */
function tryAcquireLease(db: IDBDatabase): Promise<boolean> {
  return new Promise((resolve) => {
    let acquired = false;
    const tx = db.transaction(LEASE_STORE, 'readwrite');
    const store = tx.objectStore(LEASE_STORE);
    const read = store.get(LOCK_NAME);

    read.onsuccess = () => {
      const current = read.result as LeaseRecord | undefined;
      const now = Date.now();
      const heldByOther = current && current.holder !== HOLDER_ID && current.expiresAt > now;
      if (heldByOther) return;
      store.put({ name: LOCK_NAME, holder: HOLDER_ID, expiresAt: now + LEASE_TTL_MS });
      acquired = true;
    };

    tx.oncomplete = () => resolve(acquired);
    tx.onerror = () => resolve(false);
    tx.onabort = () => resolve(false);
  });
}

function renewLease(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(LEASE_STORE, 'readwrite');
    const store = tx.objectStore(LEASE_STORE);
    const read = store.get(LOCK_NAME);
    read.onsuccess = () => {
      const current = read.result as LeaseRecord | undefined;
      // Only the holder may renew; if we lost it, do not steal it back.
      if (current && current.holder !== HOLDER_ID) return;
      store.put({ name: LOCK_NAME, holder: HOLDER_ID, expiresAt: Date.now() + LEASE_TTL_MS });
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

function releaseLease(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    const tx = db.transaction(LEASE_STORE, 'readwrite');
    const store = tx.objectStore(LEASE_STORE);
    const read = store.get(LOCK_NAME);
    read.onsuccess = () => {
      const current = read.result as LeaseRecord | undefined;
      if (!current || current.holder === HOLDER_ID) store.delete(LOCK_NAME);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });
}

async function withLease<T>(task: () => Promise<T>): Promise<T | typeof BUSY> {
  const db = await openLeaseDb();
  // No lease store (e.g. an older queue DB version): run unguarded rather than
  // refusing to sync. Single-tab correctness is unaffected.
  if (!db) return task();

  const acquired = await tryAcquireLease(db);
  if (!acquired) {
    db.close();
    return BUSY;
  }

  const renew = setInterval(() => {
    void renewLease(db);
  }, LEASE_RENEW_MS);

  try {
    return await task();
  } finally {
    clearInterval(renew);
    await releaseLease(db);
    db.close();
  }
}

/** Returned when another tab already holds the lock and the caller should stand down. */
export const BUSY = Symbol('sync-lock-busy');

export type LockOutcome<T> = T | typeof BUSY;

/**
 * Run `task` while holding the app-wide sync lock.
 *
 * Non-blocking by design: if another tab is syncing this resolves to {@link BUSY}
 * immediately instead of queueing. Sync is idempotent and periodic, so standing
 * down and letting the next tick retry is strictly better than piling up
 * duplicate passes behind a lock.
 */
export async function withSyncLock<T>(task: () => Promise<T>): Promise<LockOutcome<T>> {
  if (!hasWebLocks()) {
    return withLease(task);
  }

  const locks = (navigator as Navigator & { locks: LockManager }).locks;
  try {
    // ifAvailable: true → the callback receives null instead of waiting.
    return await locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
      if (!lock) return BUSY;
      return task();
    });
  } catch (err) {
    // A rejected lock request must not silently disable sync.
    logger.sync.warn('Web Locks request failed, falling back to lease', err);
    return withLease(task);
  }
}

/** True when this tab currently believes it can take the lock. Diagnostics only. */
export const syncLockHolderId = HOLDER_ID;

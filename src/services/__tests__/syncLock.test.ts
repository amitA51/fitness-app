// ============================================================================
// Cross-tab sync lock
// ============================================================================
// Sync used to be guarded only by module-level booleans, which serialise work
// inside ONE JS realm. Two tabs (or a Home-Screen PWA plus a browser tab) would
// therefore replay the same offline mutation and run competing full pushes.
//
// jsdom has no Web Locks API, so these tests exercise the IndexedDB lease
// fallback — which is also the path real Safari < 15.4 takes. A foreign holder is
// simulated by writing the lease row directly, because a second tab is a second
// realm and cannot be created inside one test process.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Fresh module instance per test. `vi.resetModules()` means the statically
 * imported `BUSY` symbol would no longer be identical to the one the reloaded
 * module returns, so both must come from the same load.
 */
async function loadLock() {
  return import('../syncLock');
}

const DB_NAME = 'SparkOS_Queue';
const LEASE_STORE = 'sync_leases';
const LOCK_NAME = 'sparkos-sync';

/**
 * Create the queue database at v3 with the stores the lock and queue need.
 *
 * Done explicitly rather than by calling into offlineQueue: the test setup swaps
 * in a fresh fake-indexeddb factory before every test, while offlineQueue
 * memoises its IDBDatabase handle. Letting it hand back a handle bound to the
 * previous factory would silently point the queue and the lease at two different
 * databases.
 */
function ensureQueueDb(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('mutation_queue')) {
        const store = db.createObjectStore('mutation_queue', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('type', 'type', { unique: false });
      }
      if (!db.objectStoreNames.contains('dead_letter_queue')) {
        const dead = db.createObjectStore('dead_letter_queue', { keyPath: 'id' });
        dead.createIndex('failedAt', 'failedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(LEASE_STORE)) {
        db.createObjectStore(LEASE_STORE, { keyPath: 'name' });
      }
    };
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeLease(holder: string, expiresAt: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(LEASE_STORE, 'readwrite');
    tx.objectStore(LEASE_STORE).put({ name: LOCK_NAME, holder, expiresAt });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function readLease(): Promise<{ holder: string; expiresAt: number } | undefined> {
  const db = await openDb();
  const row = await new Promise<{ holder: string; expiresAt: number } | undefined>(
    (resolve, reject) => {
      const tx = db.transaction(LEASE_STORE, 'readonly');
      const req = tx.objectStore(LEASE_STORE).get(LOCK_NAME);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }
  );
  db.close();
  return row;
}

beforeEach(async () => {
  // Guard the premise of every test below: jsdom must not expose Web Locks, or
  // these would silently exercise a different code path than intended.
  expect('locks' in navigator).toBe(false);
  // Drop memoised IDBDatabase handles from the previous test's factory.
  vi.resetModules();
  await ensureQueueDb();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withSyncLock', () => {
  it('runs the task and releases the lease afterwards', async () => {
    const { withSyncLock } = await loadLock();
    const task = vi.fn(async () => 'done');

    const result = await withSyncLock(task);

    expect(result).toBe('done');
    expect(task).toHaveBeenCalledTimes(1);
    // Released, so the next pass (or another tab) can take it immediately.
    expect(await readLease()).toBeUndefined();
  });

  it('stands down with BUSY while another tab holds a live lease', async () => {
    const { BUSY, withSyncLock } = await loadLock();
    await writeLease('another-tab', Date.now() + 10_000);
    const task = vi.fn(async () => 'done');

    const result = await withSyncLock(task);

    expect(result).toBe(BUSY);
    // The task must not have run at all — that is the whole point.
    expect(task).not.toHaveBeenCalled();
    // And we must not have stolen the live lease.
    expect((await readLease())?.holder).toBe('another-tab');
  });

  it('takes over an expired lease so a crashed tab cannot deadlock sync', async () => {
    const { withSyncLock } = await loadLock();
    await writeLease('crashed-tab', Date.now() - 1_000);
    const task = vi.fn(async () => 'done');

    const result = await withSyncLock(task);

    expect(result).toBe('done');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('releases the lease even when the task throws', async () => {
    const { withSyncLock } = await loadLock();

    await expect(
      withSyncLock(async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(await readLease()).toBeUndefined();
  });

  it('holds the lease for the whole duration of the task', async () => {
    const { withSyncLock } = await loadLock();
    let heldDuring: { holder: string } | undefined;

    await withSyncLock(async () => {
      heldDuring = await readLease();
    });

    expect(heldDuring).toBeDefined();
    expect(heldDuring?.holder).toBeTruthy();
    expect(heldDuring?.holder).not.toBe('another-tab');
  });
});

describe('processQueue under a foreign lock', () => {
  it('skips the pass instead of double-replaying another tab work', async () => {
    const { processQueue, queueMutation } = await import('../offlineQueue');
    await queueMutation('session:update', { id: 'locked', duration: 10 });

    await writeLease('another-tab', Date.now() + 10_000);
    const result = await processQueue();

    // Nothing attempted: no retry consumed, no duplicate write.
    expect(result).toEqual({ success: 0, failed: 0 });
  });
});

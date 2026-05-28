/**
 * Cloud Sync Engine
 *
 * Orchestrates cloud synchronization on top of the core IndexedDB primitives.
 * This layer owns the cloud-configuration check and the pending-sync retry
 * queue, keeping `indexedDBCore` free of any cloud awareness. The dependency
 * points engine -> core, never the reverse.
 */

import { isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';
import { STORES, dbDelete, dbGetAll, dbPut } from './indexedDBCore';

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
 * Returns a promise that resolves to `true` when the sync succeeded and
 * `false` when it was skipped (cloud not configured), failed, or queued.
 * Callers may await the result, but existing fire-and-forget call sites can
 * safely ignore it: the internal promise chain catches its own errors, so an
 * ignored return never produces an unhandled rejection.
 *
 * @param syncFn  Async function that performs one cloud sync operation.
 * @param tag     Unique identifier for this sync item (used for queue dedup).
 * @param maxRetries  Number of attempts before queueing (default 3).
 */
export const syncWithRetry = (
  syncFn: () => Promise<void>,
  tag: string,
  maxRetries = 3
): Promise<boolean> => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return Promise.resolve(false);
  }

  if (!isSupabaseConfigured()) {
    return Promise.resolve(false);
  }

  return tryExecuteSync(syncFn, maxRetries)
    .then(async (result) => {
      if (!result.success) {
        await queuePendingSync(tag, tag, result.error);
        return false;
      }
      await clearPendingSync(tag);
      return true;
    })
    .catch((err) => {
      logger.sync.error(`Unexpected error in syncWithRetry for "${tag}"`, err);
      queuePendingSync(tag, tag, String(err)).catch(() => {});
      return false;
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

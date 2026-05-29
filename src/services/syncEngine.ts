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
import { STORES, dbDelete, dbGet, dbGetAll, dbPut } from './indexedDBCore';

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
  payload?: { table: string; record: Record<string, unknown> };
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

const MAX_BACKOFF_MS = 30_000;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Exponential backoff with jitter and a cap. */
const backoffDelay = (attempt: number): number => {
  const base = Math.min(1000 * 2 ** attempt, MAX_BACKOFF_MS);
  const jitter = Math.random() * base * 0.3;
  return base + jitter;
};

const tryExecuteSync = async (
  syncFn: () => Promise<void>,
  maxRetries: number
): Promise<{ success: boolean; error?: string }> => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await syncFn();
      return { success: true };
    } catch (err) {
      const isLastAttempt = attempt === maxRetries - 1;

      if (!isLastAttempt) {
        const delay = backoffDelay(attempt);
        logger.sync.warn(
          `Sync attempt ${attempt + 1}/${maxRetries} failed, retrying in ${Math.round(delay)}ms`,
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

const queuePendingSync = async (
  tag: string,
  operation: string,
  error?: string,
  payload?: { table: string; record: Record<string, unknown> }
): Promise<void> => {
  try {
    const existing = await dbGet<PendingSyncEntry>(STORES.PENDING_SYNC, tag);
    const retryCount = existing ? existing.retryCount + 1 : 0;
    const entry: PendingSyncEntry = {
      tag,
      operation,
      payload: payload ?? existing?.payload,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      retryCount,
      lastError: error,
    };
    await dbPut(STORES.PENDING_SYNC, entry);
    logger.sync.info(`Queued pending sync: ${tag} (retry #${retryCount})`);
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
 * @param payload  Optional table+record snapshot to persist for offline recovery.
 */
export const syncWithRetry = (
  syncFn: () => Promise<void>,
  tag: string,
  maxRetries = 3,
  payload?: { table: string; record: Record<string, unknown> }
): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    return Promise.resolve(false);
  }

  return tryExecuteSync(syncFn, maxRetries)
    .then(async (result) => {
      if (!result.success) {
        await queuePendingSync(tag, tag, result.error, payload);
        return false;
      }
      await clearPendingSync(tag);
      return true;
    })
    .catch((err) => {
      logger.sync.error(`Unexpected error in syncWithRetry for "${tag}"`, err);
      queuePendingSync(tag, tag, String(err), payload).catch(() => {});
      return false;
    });
};

/**
 * Processes all pending sync entries stored in IndexedDB.
 * Call this when connectivity is restored (e.g. on app start, online event).
 * Re-queues any that fail again, up to `maxRetries` times before discarding.
 *
 * @param syncFn  Async function that re-executes the pending operation.
 *                Receives the tag and the persisted payload (if available).
 * @param maxRetries  Total retry cap per entry (default 5). When the stored
 *                    `retryCount` hits this limit the entry is dropped.
 */
export const syncPendingToServer = async (
  syncFn: (
    tag: string,
    payload?: { table: string; record: Record<string, unknown> }
  ) => Promise<void>,
  maxRetries = 5
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
          await syncFn(entry.tag, entry.payload);
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

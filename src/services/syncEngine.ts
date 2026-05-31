/**
 * Cloud Sync Engine
 *
 * Orchestrates cloud synchronization on top of the core IndexedDB primitives.
 * This layer owns the cloud-configuration check and the retry logic.
 * On final failure, mutations are forwarded to the offlineQueue.
 */

import { isSupabaseConfigured } from '../lib/supabase';
import { logger } from '../utils/logger';
import { reportError } from './errorReporter';

export interface SyncResult {
  success: boolean;
  synced: number;
  pending: number;
  skipped: boolean;
  error?: string;
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

/**
 * Sync with exponential-backoff retry. On final failure the operation is
 * queued via offlineQueue so it can be retried when back online.
 *
 * Returns a promise that resolves to `true` when the sync succeeded and
 * `false` when it was skipped (cloud not configured), failed, or queued.
 *
 * @param syncFn  Async function that performs one cloud sync operation.
 * @param tag     Unique identifier for this sync item (used for logging).
 * @param maxRetries  Number of attempts before queueing (default 3).
 * @param queue  Optional mutation descriptor to forward to offlineQueue on failure.
 */
export const syncWithRetry = (
  syncFn: () => Promise<void>,
  tag: string,
  maxRetries = 3,
  queue?: { type: import('./offlineQueue').MutationType; payload: unknown }
): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    return Promise.resolve(false);
  }

  return tryExecuteSync(syncFn, maxRetries)
    .then(async (result) => {
      if (!result.success) {
        reportError(new Error(result.error ?? 'Sync failed'), {
          service: 'syncEngine',
          action: tag,
          syncState: 'offline',
        });
        if (queue) {
          const { queueMutation } = await import('./offlineQueue');
          await queueMutation(queue.type, queue.payload);
        }
        return false;
      }
      return true;
    })
    .catch(async (err) => {
      logger.sync.error(`Unexpected error in syncWithRetry for "${tag}"`, err);
      if (queue) {
        const { queueMutation } = await import('./offlineQueue');
        await queueMutation(queue.type, queue.payload);
      }
      return false;
    });
};

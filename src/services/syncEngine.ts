/**
 * Cloud Sync Engine
 *
 * Orchestrates cloud synchronization on top of the core IndexedDB primitives.
 * This layer owns the cloud-configuration check and the retry logic.
 * On final failure, mutations are forwarded to the offlineQueue.
 */

import { isSupabaseConfigured, readStoredAuthSession } from '../lib/supabase';
import { logger } from '../utils/logger';
import { reportError } from './errorReporter';
import { isRetriableError } from './offlineQueue';

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
      // Permanent errors (4xx, Postgres/PostgREST codes) will never succeed on
      // retry — short-circuit straight to the failure path instead of burning
      // a full backoff cycle. Shares offlineQueue's classifier so the engine
      // and the queue agree on what "retriable" means.
      if (!isRetriableError(err)) {
        logger.sync.error('Non-retriable sync error, not retrying', err);
        return { success: false, error: String(err) };
      }

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

interface QueueDescriptor {
  type: import('./offlineQueue').MutationType;
  payload: unknown;
  ownerId?: string;
}

/**
 * When a DELETE is pushed directly, drop the record's pending create/update
 * from the offline queue. Queued, a delete does that itself (queueMutation);
 * pushed straight through it never enters the queue, and an older update parked
 * there by outage backoff then replayed after it and brought the record back.
 * Best-effort: the push must not wait on, or fail because of, the queue.
 */
const discardWritesObsoletedByDelete = async (queue?: QueueDescriptor): Promise<void> => {
  if (!queue?.type.endsWith(':delete')) return;
  try {
    const { discardWritesObsoletedBy } = await import('./offlineQueue');
    await discardWritesObsoletedBy(queue.type, queue.payload);
  } catch (err) {
    logger.sync.warn('Could not drop queued writes made obsolete by a delete', err);
  }
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
 *               Pass `ownerId` — the account the push was made for — whenever it
 *               is known: the enqueue runs only after every retry has failed,
 *               seconds later, when a sign-out may have changed who auth names.
 */
export const syncWithRetry = (
  syncFn: () => Promise<void>,
  tag: string,
  maxRetries = 3,
  queue?: QueueDescriptor
): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    return Promise.resolve(false);
  }

  // Who the write belongs to is decided NOW, not when the fallback enqueue runs
  // after every retry failed: a sign-out in between would leave auth naming
  // nobody, the row would be stamped as guest data, and the next account to
  // sign in on this device would adopt it. The stored session is read
  // synchronously, so callers that pass no ownerId are covered too.
  const ownerId = queue?.ownerId ?? readStoredAuthSession()?.user.id;

  const enqueue = async (): Promise<void> => {
    if (!queue) return;
    const { queueMutation } = await import('./offlineQueue');
    if (ownerId) await queueMutation(queue.type, queue.payload, { ownerId });
    else await queueMutation(queue.type, queue.payload);
  };

  // Alongside the push, not before it: the push must start at once (a delete is
  // awaited by its caller only until its request is out), and replay re-checks
  // that a write is still queued right before sending it.
  void discardWritesObsoletedByDelete(queue);

  return tryExecuteSync(syncFn, maxRetries)
    .then(async (result) => {
      if (!result.success) {
        reportError(new Error(result.error ?? 'Sync failed'), {
          service: 'syncEngine',
          action: tag,
          syncState: 'offline',
        });
        await enqueue();
        return false;
      }
      return true;
    })
    .catch(async (err) => {
      logger.sync.error(`Unexpected error in syncWithRetry for "${tag}"`, err);
      await enqueue();
      return false;
    });
};

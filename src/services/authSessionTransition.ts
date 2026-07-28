import { logger } from '../utils/logger';
import { clearMutationQueue, clearMutationQueueForOwner } from './offlineQueue';
import {
  LAST_SIGNED_IN_USER_ID_KEY,
  type UserScopedDataCleanupOptions,
  clearUserScopedLocalData,
} from './userScopedLocalData';

export interface AuthSessionTransition {
  previousUserId: string | null;
  nextUserId: string | null;
  localDataCleared: boolean;
}

export type AuthSessionTransitionOptions = UserScopedDataCleanupOptions & {
  /** Sign-out and expiry must wipe local state even when the old marker is unavailable. */
  forceCleanup?: boolean;
};

const readLastSignedInUserId = (): string | null => {
  try {
    return localStorage.getItem(LAST_SIGNED_IN_USER_ID_KEY);
  } catch {
    return null;
  }
};

const persistLastSignedInUserId = (userId: string | null): void => {
  try {
    if (userId) localStorage.setItem(LAST_SIGNED_IN_USER_ID_KEY, userId);
    else localStorage.removeItem(LAST_SIGNED_IN_USER_ID_KEY);
  } catch (err) {
    // Storage failure means the next transition will conservatively wipe again.
    logger.auth.warn('Unable to persist last signed-in user id', err);
  }
};

let transitionTail: Promise<void> = Promise.resolve();

/**
 * Serialize auth identity changes. A pull must await this function: when the
 * identity differs, every user-scoped store and the offline queue are cleared
 * before the next account's cloud data is allowed to merge locally.
 *
 * ---------------------------------------------------------------------------
 * When this DOES and does NOT wipe
 * ---------------------------------------------------------------------------
 * The wipe exists for exactly one reason: user B must never see user A's local
 * records on a shared device. It is therefore scoped to the moment that risk is
 * real — a different account actually signing in.
 *
 *   • `nextUserId` is a DIFFERENT non-null id  → WIPE. This is the security case.
 *   • `nextUserId` is the SAME id              → no wipe (unchanged behaviour).
 *   • `nextUserId` is null, no forceCleanup    → NO WIPE, and the owner marker is
 *     DELIBERATELY LEFT IN PLACE. This is a lost/expired credential, not a change
 *     of person. Keeping the marker means the same user logging back in matches
 *     `previousUserId === nextUserId` and keeps their data.
 *   • `forceCleanup: true`                     → always wipe and clear the marker.
 *     Used by explicit sign-out and account deletion, where the user has asked
 *     for exactly that.
 *
 * The null case used to wipe, because a null id trivially differs from the
 * stored one. That made every token expiry destructive: it erased local-only
 * state (a real user lost six weeks of program progress this way) and, worse,
 * erased the offline mutation queue — the one copy of writes that had not
 * reached the cloud yet. Nothing was protected in exchange, since an expired
 * token says nothing about who authenticates next.
 */
export const transitionAuthSession = (
  nextUserId: string | null,
  options: AuthSessionTransitionOptions = {}
): Promise<AuthSessionTransition> => {
  const { forceCleanup = false, ...cleanupOptions } = options;
  const execute = async (): Promise<AuthSessionTransition> => {
    const previousUserId = readLastSignedInUserId();

    // Same identity: nothing to protect against.
    if (!forceCleanup && previousUserId === nextUserId) {
      return { previousUserId, nextUserId, localDataCleared: false };
    }

    // Credential lost rather than identity changed. Preserve both the data and
    // the owner marker so a re-login by the same person is a no-op above.
    if (!forceCleanup && nextUserId === null) {
      logger.auth.info(
        'Auth session ended without an identity change; local data preserved for re-login'
      );
      return { previousUserId, nextUserId, localDataCleared: false };
    }

    const cleanupFailures: unknown[] = [];
    try {
      // Owner-scoped on an account SWITCH, destructive only on an explicit
      // sign-out / account deletion (forceCleanup). The unscoped clear also wipes
      // the dead-letter store, which is where a change that failed permanently is
      // KEPT for recovery — deleting it on a switch destroyed the only copy of
      // writes that never reached the cloud.
      if (forceCleanup) {
        await clearMutationQueue();
      } else {
        await clearMutationQueueForOwner(previousUserId);
      }
    } catch (err) {
      logger.auth.warn('Auth transition: failed to clear the offline mutation queue', err);
      cleanupFailures.push(err);
    }

    try {
      await clearUserScopedLocalData(cleanupOptions);
    } catch (err) {
      logger.auth.error('Auth transition: failed to fully clear local data', err);
      cleanupFailures.push(err);
    }

    if (cleanupFailures.length > 0) {
      throw new Error('Auth transition local cleanup did not complete');
    }

    persistLastSignedInUserId(nextUserId);
    return { previousUserId, nextUserId, localDataCleared: true };
  };

  const task = transitionTail.then(execute, execute);
  transitionTail = task.then(
    () => undefined,
    () => undefined
  );
  return task;
};

export const getLastSignedInUserId = (): string | null => readLastSignedInUserId();

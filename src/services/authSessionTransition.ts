import { logger } from '../utils/logger';
import { clearMutationQueue } from './offlineQueue';
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
 */
export const transitionAuthSession = (
  nextUserId: string | null,
  options: AuthSessionTransitionOptions = {}
): Promise<AuthSessionTransition> => {
  const { forceCleanup = false, ...cleanupOptions } = options;
  const execute = async (): Promise<AuthSessionTransition> => {
    const previousUserId = readLastSignedInUserId();
    if (!forceCleanup && previousUserId === nextUserId) {
      return { previousUserId, nextUserId, localDataCleared: false };
    }

    const cleanupFailures: unknown[] = [];
    try {
      await clearMutationQueue();
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

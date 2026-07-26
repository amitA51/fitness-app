import { logger } from '../utils/logger';
import { STORES, dbClear } from './indexedDBCore';

/** Persisted separately from user data so auth transition handling can compare identities. */
export const LAST_SIGNED_IN_USER_ID_KEY = 'sparkos_last_user_id';

/** Invite state is user-scoped by default, but can be preserved for an active auth round-trip. */
export const PENDING_INVITE_CODE_KEY = 'pending_invite_code';
export const PENDING_AUTH_REDIRECT_KEY = 'sparkos_pending_auth_redirect';

/**
 * Single source of truth for browser and IndexedDB state that belongs to the
 * active account. Add every newly introduced user-scoped key here so sign-out,
 * expiry, account switching, and data deletion cannot drift apart.
 */
export const USER_SCOPED_STORAGE_REGISTRY = {
  indexedDbStores: Object.values(STORES),
  localStorageKeys: [
    'active_workout_v3_state',
    'onboarding_data',
    'onboarding_completed',
    'user_profile',
    'supabase_session',
    'nutrition_goals',
    'workout_prefs',
    'last_sync_time',
    'notification_settings',
    'pending_coach_intent',
    'cached_role',
    'view_mode',
    'coach_reminders_fired',
    'bbt_program_progress_v1',
    'bbt_program_swaps_v1',
    'appSettings',
    PENDING_INVITE_CODE_KEY,
    PENDING_AUTH_REDIRECT_KEY,
    'ai_current_conversation',
    'sparkos_last_workout_date',
    'sparkos_legacy_id_normalization_v1',
    'warmup_routine_selections',
    'cooldown_routine_selections',
    'sparkos_recent_food_ids',
    'sparkos_scanned_food_cache',
    'coach:quick-replies',
    'mycoach:ackedAssignments',
    'date_prefs',
    'app_locale',
  ] as const,
  localStorageKeyPrefixes: ['ai_tutorial_'] as const,
  sessionStorageKeys: ['onboarding_step', 'onboarding_draft', 'sparkos_prewo_started'] as const,
  sessionStorageKeyPrefixes: ['scroll:'] as const,
} as const;

export type UserScopedDataCleanupOptions = {
  /** Preserve only transient navigation state that is required after authentication. */
  preserveLocalStorageKeys?: readonly string[];
  preserveSessionStorageKeys?: readonly string[];
};

const clearStorage = (
  storage: Storage,
  storageName: 'localStorage' | 'sessionStorage',
  keys: readonly string[],
  prefixes: readonly string[],
  preservedKeys: ReadonlySet<string>,
  failures: string[]
): void => {
  for (const key of keys) {
    if (preservedKeys.has(key)) continue;
    try {
      storage.removeItem(key);
    } catch (err) {
      logger.app.warn(`Auth cleanup: failed to remove ${storageName} key "${key}"`, err);
      failures.push(`${storageName}:${key}`);
    }
  }

  try {
    const dynamicKeys: string[] = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key && prefixes.some((prefix) => key.startsWith(prefix)) && !preservedKeys.has(key)) {
        dynamicKeys.push(key);
      }
    }
    for (const key of dynamicKeys) {
      try {
        storage.removeItem(key);
      } catch (err) {
        logger.app.warn(`Auth cleanup: failed to remove ${storageName} key "${key}"`, err);
        failures.push(`${storageName}:${key}`);
      }
    }
  } catch (err) {
    logger.app.warn(`Auth cleanup: failed to enumerate ${storageName}`, err);
    failures.push(`${storageName}:enumeration`);
  }
};

/**
 * Clear all local data that belongs to the active user. The work completes
 * before this promise resolves, which lets auth transition code wait for a
 * full wipe before it ever pulls another account's cloud records.
 */
export const clearUserScopedLocalData = async (
  options: UserScopedDataCleanupOptions = {}
): Promise<void> => {
  const failures: string[] = [];

  for (const store of USER_SCOPED_STORAGE_REGISTRY.indexedDbStores) {
    try {
      await dbClear(store);
    } catch (err) {
      logger.app.warn(`Auth cleanup: failed to clear IndexedDB store "${store}"`, err);
      failures.push(`indexedDB:${store}`);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      clearStorage(
        window.localStorage,
        'localStorage',
        USER_SCOPED_STORAGE_REGISTRY.localStorageKeys,
        USER_SCOPED_STORAGE_REGISTRY.localStorageKeyPrefixes,
        new Set(options.preserveLocalStorageKeys),
        failures
      );
    } catch (err) {
      logger.app.warn('Auth cleanup: localStorage is unavailable', err);
      failures.push('localStorage:unavailable');
    }

    try {
      clearStorage(
        window.sessionStorage,
        'sessionStorage',
        USER_SCOPED_STORAGE_REGISTRY.sessionStorageKeys,
        USER_SCOPED_STORAGE_REGISTRY.sessionStorageKeyPrefixes,
        new Set(options.preserveSessionStorageKeys),
        failures
      );
    } catch (err) {
      logger.app.warn('Auth cleanup: sessionStorage is unavailable', err);
      failures.push('sessionStorage:unavailable');
    }
  }

  if (failures.length > 0) {
    throw new Error(`Could not fully clear user-scoped local data: ${failures.join(', ')}`);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:local-data-cleared'));
  }
};

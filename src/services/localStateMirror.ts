/**
 * Cloud mirror for localStorage-only user state.
 *
 * ---------------------------------------------------------------------------
 * Why
 * ---------------------------------------------------------------------------
 * Several pieces of genuinely important user data live only in localStorage AND
 * are listed in `USER_SCOPED_STORAGE_REGISTRY`, which means `clearUserScopedLocalData()`
 * deletes them when a different account signs in. With no cloud copy that deletion
 * is permanent. This is the exact shape of the bug that destroyed a real user's
 * six weeks of 12-week-program progress; `programService` was fixed individually,
 * and these keys had the same defect:
 *
 *   • `user_profile`    — age, height, weight, gender, activity level, goal. Drives
 *                         TDEE and every macro target. Re-entering it is a full
 *                         onboarding pass.
 *   • `workout_prefs`   — rest timers, warmup preference, units, haptics.
 *   • `nutrition_goals` — the calorie/macro targets the whole nutrition screen
 *                         compares against.
 *   • `appSettings`     — theme and app-level configuration.
 *
 * ---------------------------------------------------------------------------
 * How
 * ---------------------------------------------------------------------------
 * Each key is mirrored into the cloud-synced `user_settings` table (key/value
 * jsonb, RLS-scoped to the owner) and rehydrated after a pull. Last-write-wins on
 * a `__mirroredAt` stamp, so a genuinely newer local value is never clobbered by
 * an older cloud copy — which matters because the pull runs on every sign-in.
 *
 * This is intentionally the SAME mechanism `programService` uses rather than a
 * second one; the whole point of the original bug was that one-off persistence
 * decisions drift apart.
 *
 * NOT mirrored, on purpose:
 *   • `active_workout_v3_state` — an in-progress workout is device-local by
 *     nature. Syncing a half-finished workout between devices is a different
 *     feature with its own conflict rules, not a backup.
 *   • guidance flags, scroll positions, food caches — recomputable or trivial.
 */

import { logger } from '../utils/logger';
import { safeJsonParse } from '../utils/safeJson';
import { STORES, dbGetAll, dbPut } from './indexedDBCore';

/** Wrapper stored in the cloud so we can compare versions without touching the payload. */
interface MirroredValue {
  /** ISO timestamp of the local write. The LWW clock. */
  __mirroredAt: string;
  /** The raw localStorage string, kept verbatim so no parsing/serialisation drift. */
  raw: string;
}

/**
 * localStorage keys mirrored to the cloud.
 *
 * Add a key here whenever new user-meaningful state lands in localStorage, and it
 * will survive an account switch instead of being silently destroyed.
 */
export const MIRRORED_LOCAL_KEYS = [
  'user_profile',
  'workout_prefs',
  'nutrition_goals',
  'appSettings',
  'warmup_routine_selections',
  'cooldown_routine_selections',
  // Daily hydration goal + glass size. Written by waterService.saveWaterSettings
  // and wiped by clearUserScopedLocalData, with no cloud copy until now.
  'water_settings',
  // Running: heart-rate settings + weekly km goal, and the race goal
  // (services/running/cardioPrefs.ts, services/running/goals.ts).
  'cardio_prefs_v1',
  'running_goal_v1',
] as const;

/**
 * Keys a pull may upload when the cloud has no copy yet. Only keys whose every
 * writer mirrors on save: a key saved without mirroring (appSettings, the
 * warm-up and cool-down selections) would get a one-time snapshot in the cloud,
 * and the next restore would put that old snapshot back over newer changes.
 */
const BACKFILL_KEYS: ReadonlySet<string> = new Set(['cardio_prefs_v1', 'running_goal_v1']);

/** Cloud `user_settings.key` for a mirrored localStorage key. */
const cloudKeyFor = (localKey: string): string => `mirror:${localKey}`;

const isMirroredValue = (v: unknown): v is MirroredValue =>
  typeof v === 'object' &&
  v !== null &&
  typeof (v as MirroredValue).raw === 'string' &&
  typeof (v as MirroredValue).__mirroredAt === 'string';

/**
 * Mirror one key's current localStorage value to the cloud.
 *
 * Fire-and-forget: this runs on settings/profile writes and must never block or
 * fail them. localStorage stays the synchronous source of truth and the offline
 * queue retries the upload.
 */
export const mirrorLocalKey = (localKey: string): void => {
  void (async () => {
    try {
      const raw = localStorage.getItem(localKey);
      if (raw == null) return;
      const value: MirroredValue = { __mirroredAt: new Date().toISOString(), raw };
      const key = cloudKeyFor(localKey);
      await dbPut(STORES.USER_SETTINGS, {
        key,
        value,
        createdAt: value.__mirroredAt,
        updatedAt: value.__mirroredAt,
      });
      const { queueMutation } = await import('./offlineQueue');
      await queueMutation('setting:update', {
        key,
        value,
        createdAt: value.__mirroredAt,
        updatedAt: value.__mirroredAt,
      });
    } catch (err) {
      logger.app.warn('Failed to mirror local key to the cloud', { localKey, err });
    }
  })();
};

/** Mirror every registered key. Used after a bulk local change (e.g. a restore). */
export const mirrorAllLocalKeys = (): void => {
  for (const key of MIRRORED_LOCAL_KEYS) mirrorLocalKey(key);
};

export interface RestoreMirroredOptions {
  /**
   * The settings store holds a complete, fresh copy of the cloud rows (the
   * user_settings fetch and merge both landed). Only then does "no cloud row"
   * mean the key was never mirrored — a key added to MIRRORED_LOCAL_KEYS after
   * the value was saved — so the local value is uploaded once instead of being
   * lost at the next sign-out. Limited to BACKFILL_KEYS.
   */
  backfillMissing?: boolean;
}

/** Tell open screens a key changed under them (the same event another tab sends). */
const announceRestored = (localKey: string): void => {
  try {
    window.dispatchEvent(new StorageEvent('storage', { key: localKey }));
  } catch {
    // No window (tests, workers): nothing on screen to refresh.
  }
};

/**
 * Rehydrate mirrored keys from the cloud-synced settings store.
 *
 * Call AFTER a pull has merged cloud rows into IndexedDB. Last-write-wins on
 * `__mirroredAt`, so this both restores what a wipe destroyed and leaves a newer
 * local value alone.
 *
 * @returns the local keys that were actually restored.
 */
export const restoreMirroredLocalKeys = async ({
  backfillMissing = false,
}: RestoreMirroredOptions = {}): Promise<string[]> => {
  const restored: string[] = [];
  try {
    const rows = await dbGetAll<{ key: string; value: unknown }>(STORES.USER_SETTINGS);
    const byKey = new Map(rows.map((r) => [r.key, r.value]));

    for (const localKey of MIRRORED_LOCAL_KEYS) {
      const cloudValue = byKey.get(cloudKeyFor(localKey));
      if (
        cloudValue === undefined &&
        backfillMissing &&
        BACKFILL_KEYS.has(localKey) &&
        localStorage.getItem(localKey) != null
      ) {
        mirrorLocalKey(localKey);
        continue;
      }
      if (!isMirroredValue(cloudValue)) continue;

      const localRaw = localStorage.getItem(localKey);
      if (localRaw != null) {
        // Compare against the stamp we recorded for the local copy. A local value
        // that was never mirrored has no stamp; treat it as epoch so a stamped
        // cloud copy wins rather than being blocked forever.
        const localStamp = byKey.get(cloudKeyFor(localKey));
        const localMirroredAt =
          isMirroredValue(localStamp) && localStamp.raw === localRaw
            ? localStamp.__mirroredAt
            : '1970-01-01T00:00:00.000Z';
        if (cloudValue.__mirroredAt <= localMirroredAt) continue;
      }

      // Only write back something that still parses — a corrupted cloud value
      // must not replace a working local one. `safeJsonParse` returns UNDEFINED
      // on failure (not null), and `'null'` is itself valid JSON, so both cases
      // have to be distinguished explicitly.
      if (cloudValue.raw !== 'null' && safeJsonParse<unknown>(cloudValue.raw) === undefined) {
        logger.app.warn('Skipping unparseable mirrored value', { localKey });
        continue;
      }

      try {
        localStorage.setItem(localKey, cloudValue.raw);
        restored.push(localKey);
        announceRestored(localKey);
      } catch (err) {
        logger.app.warn('Failed to write restored mirrored value', { localKey, err });
      }
    }
  } catch (err) {
    logger.app.warn('Failed to restore mirrored local keys', err);
  }
  return restored;
};

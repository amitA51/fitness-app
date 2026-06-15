/**
 * Persistent-storage request.
 *
 * The app is IndexedDB-first (workouts, templates) with localStorage for
 * onboarding/program progress. Under storage pressure a browser may EVICT an
 * origin's storage unless it has been marked persistent — which would silently
 * wipe a trainee's 12-week program and its progress. `navigator.storage.persist()`
 * asks the browser to exempt us from eviction.
 *
 * It MUST be triggered from a real user gesture: Firefox shows a permission
 * prompt (which is blocked off a bare page-load), while installed PWAs on
 * Chromium/Safari grant it silently. Call this from a tap (e.g. start-workout),
 * never on boot. Idempotent and best-effort — it never throws.
 */
import { logger } from '../utils/logger';

let attempted = false;

/**
 * Ensure the origin's storage is persistent. Returns the resulting persisted
 * state. Safe to call repeatedly; the actual request fires at most once per
 * session unless already granted.
 */
export async function ensurePersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return false;
    // Already persistent (e.g. installed PWA, or granted earlier) — nothing to do.
    if (await navigator.storage.persisted()) return true;
    if (attempted) return false;
    attempted = true;
    const granted = await navigator.storage.persist();
    logger.app?.info?.(`Persistent storage ${granted ? 'granted' : 'denied'}`);
    return granted;
  } catch (err) {
    logger.app?.warn?.('Persistent storage request failed', err);
    return false;
  }
}

// guidanceService — localStorage-backed flags for the in-app first-use guidance.
//
// Three layers share this store:
//  1. A one-time welcome sheet ("איך להשתמש באפליקציה") — `welcomeSeen`.
//  2. Contextual coach-mark hints, one per key screen — the `hint*` keys.
//  3. A Settings re-launch that clears every flag via `resetGuidance()`.
//
// Mirrors the existing flag pattern (plain string flags, all reads/writes
// guarded in try/catch so a disabled/full localStorage degrades to "show
// nothing extra" rather than throwing). The `_v1` suffix lets a future content
// refresh re-show guidance by bumping to `_v2` without colliding with old keys.

export const GUIDANCE_KEYS = {
  welcomeSeen: 'guidance_welcome_seen_v1',
  hintDashboard: 'guidance_hint_dashboard_v1',
  hintWorkout: 'guidance_hint_workout_v1',
  hintNutrition: 'guidance_hint_nutrition_v1',
} as const;

/** Keys for the contextual coach-mark hints (excludes the welcome flag). */
export type GuidanceHintKey = Exclude<keyof typeof GUIDANCE_KEYS, 'welcomeSeen'>;

const SET_VALUE = 'true';

/** True when a localStorage flag is set. Any throw (no storage / quota) → false. */
function readFlag(storageKey: string): boolean {
  try {
    return localStorage.getItem(storageKey) === SET_VALUE;
  } catch {
    return false;
  }
}

/** Set a flag. Storage errors are swallowed — the flag simply stays unset. */
function writeFlag(storageKey: string): void {
  try {
    localStorage.setItem(storageKey, SET_VALUE);
  } catch {
    // Best-effort: a failed write just means the user may see the hint again.
  }
}

/** Clear a flag. Storage errors are swallowed. */
function clearFlag(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // Best-effort.
  }
}

/** Whether the first-use welcome sheet has already been seen on this device. */
export function hasSeenWelcome(): boolean {
  return readFlag(GUIDANCE_KEYS.welcomeSeen);
}

/** Mark the welcome sheet as seen so it never auto-opens again. */
export function markWelcomeSeen(): void {
  writeFlag(GUIDANCE_KEYS.welcomeSeen);
}

/** Whether a given contextual hint has already been dismissed. */
export function isHintDismissed(key: GuidanceHintKey): boolean {
  return readFlag(GUIDANCE_KEYS[key]);
}

/** Mark a contextual hint as dismissed so it does not show again. */
export function dismissHint(key: GuidanceHintKey): void {
  writeFlag(GUIDANCE_KEYS[key]);
}

/**
 * Clear every guidance flag. Used by the Settings "show guidance again" entry so
 * the welcome sheet re-opens and each contextual hint reappears on next visit.
 */
export function resetGuidance(): void {
  for (const storageKey of Object.values(GUIDANCE_KEYS)) {
    clearFlag(storageKey);
  }
}

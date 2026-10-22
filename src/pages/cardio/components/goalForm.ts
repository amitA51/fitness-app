// Reading and checking the goal form — pure, so the sheet stays thin.

import { parseClock, parseDecimal } from '../../../utils/cardio';

export const GOAL_KM_MIN = 1;
export const GOAL_KM_MAX = 100;
/** Faster than this (2:30 per km) is no human goal — the time was misread. */
const PACE_MIN_SEC = 150;
/** Slower than this (20:00 per km) is walking pace and then some. */
const PACE_MAX_SEC = 1200;

/** Distance from the custom field, or null when unusable. */
export function customKmFrom(text: string): number | null {
  const km = parseDecimal(text);
  return km !== null && km >= GOAL_KM_MIN && km <= GOAL_KM_MAX ? km : null;
}

/**
 * A typed finish time, in seconds. "50:00" and "1:55:00" read as clocks; a
 * short form that would be an impossible pace for the distance is read in
 * hours instead — "1:55" for a half marathon means 1:55:00, not 1 min 55 s.
 */
export function goalTimeFrom(text: string, km: number | null): number | null {
  const sec = parseClock(text);
  if (sec === null) return null;
  const parts = text.trim().split(':').length;
  if (km && parts <= 2 && sec / km < PACE_MIN_SEC) {
    const asHours = sec * 60;
    if (asHours / km >= PACE_MIN_SEC && asHours / km <= PACE_MAX_SEC) return asHours;
  }
  return sec;
}

/** Why a typed time cannot be a goal, or null when it is fine (or empty). */
export function goalTimeError(text: string, km: number | null): string | null {
  if (!text.trim()) return null;
  const sec = goalTimeFrom(text, km);
  if (sec === null) return 'כתבו זמן כמו 50:00 או 1:55:00.';
  if (!km) return null;
  const pace = sec / km;
  if (pace < PACE_MIN_SEC) return 'הזמן הזה מהיר מדי למרחק. בדקו אותו.';
  if (pace > PACE_MAX_SEC) return 'הזמן הזה ארוך מדי למרחק. בדקו אותו.';
  return null;
}

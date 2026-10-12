// Small device-local cardio preferences: the activity picked last time, so the
// next session opens on it. Local-only on purpose — it is a convenience, not
// training data, and losing it costs one tap.

import { useEffect, useState } from 'react';
import type { CardioActivity } from '../../types';
import { hrMaxFromAge, isCardioActivity } from '../../utils/cardio';

const LAST_ACTIVITY_KEY = 'cardio_last_activity';

export function readLastActivity(): CardioActivity {
  try {
    const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
    return isCardioActivity(stored) ? stored : 'run';
  } catch {
    return 'run';
  }
}

export function rememberLastActivity(activity: CardioActivity): void {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, activity);
  } catch {
    // Storage full or blocked — the default ('run') is an acceptable fallback.
  }
}

// ---------------------------------------------------------------------------
// Heart-rate settings + weekly distance goal. Device-local (included in the
// full backup); the age-predicted HRmax is the fallback when none is set.
// ---------------------------------------------------------------------------

export const CARDIO_PREFS_KEY = 'cardio_prefs_v1';
const PREFS_EVENT = 'cardio-prefs-changed';

export interface CardioPrefs {
  /** Measured maximum heart rate, bpm. */
  maxHr: number | null;
  /** Resting heart rate, bpm — switches zones to heart-rate reserve. */
  restingHr: number | null;
  /** Weekly running goal, km. */
  weeklyGoalKm: number | null;
}

const EMPTY_PREFS: CardioPrefs = { maxHr: null, restingHr: null, weeklyGoalKm: null };

const num = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;

export function readCardioPrefs(): CardioPrefs {
  try {
    const raw = localStorage.getItem(CARDIO_PREFS_KEY);
    if (!raw) return EMPTY_PREFS;
    const p = JSON.parse(raw) as Partial<CardioPrefs>;
    return {
      maxHr: num(p.maxHr, 100, 230),
      restingHr: num(p.restingHr, 30, 120),
      weeklyGoalKm: num(p.weeklyGoalKm, 1, 500),
    };
  } catch {
    return EMPTY_PREFS;
  }
}

export function writeCardioPrefs(next: CardioPrefs): void {
  try {
    localStorage.setItem(CARDIO_PREFS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(PREFS_EVENT));
  } catch {
    // preference only
  }
}

/** Live cardio prefs — re-reads when another screen saves them. */
export function useCardioPrefs(): CardioPrefs {
  const [prefs, setPrefs] = useState<CardioPrefs>(readCardioPrefs);
  useEffect(() => {
    const reload = () => setPrefs(readCardioPrefs());
    window.addEventListener(PREFS_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(PREFS_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);
  return prefs;
}

/** The HRmax to build zones on: measured beats age-predicted. */
export function effectiveHrMax(
  prefs: CardioPrefs,
  age: number | null
): { hrMax: number; measured: boolean } | null {
  if (prefs.maxHr) return { hrMax: prefs.maxHr, measured: true };
  const predicted = hrMaxFromAge(age);
  return predicted ? { hrMax: predicted, measured: false } : null;
}

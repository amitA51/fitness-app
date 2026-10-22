// ============================================================================
// Running goals — what the runner is training for, and how far along they are.
// ============================================================================
// One goal at a time: a distance (5K … marathon, or any distance), an optional
// race date and an optional finish time. "Run my first 5K, no date" is a goal
// too. The weekly-kilometre target stays where it already lives (cardio prefs).
//
// Stored in localStorage and mirrored to the cloud (localStateMirror), so it
// survives a new device and is wiped with the rest of the account's data.

import { useEffect, useState } from 'react';
import { mirrorLocalKey } from '../localStateMirror';

export const RUNNING_GOAL_KEY = 'running_goal_v1';
const GOAL_EVENT = 'running-goal-changed';

export type GoalDistanceId = '5k' | '10k' | 'half' | 'marathon' | 'custom';

export interface GoalDistance {
  id: GoalDistanceId;
  km: number;
  label: string;
}

export const GOAL_DISTANCES: readonly GoalDistance[] = [
  { id: '5k', km: 5, label: '5 ק״מ' },
  { id: '10k', km: 10, label: '10 ק״מ' },
  { id: 'half', km: 21.0975, label: 'חצי מרתון' },
  { id: 'marathon', km: 42.195, label: 'מרתון' },
];

export interface RunningGoal {
  distanceKm: number;
  /** Shown everywhere the goal is named: "10 ק״מ", "חצי מרתון", "7 ק״מ". */
  label: string;
  /** Race or target day, YYYY-MM-DD. Null = no date ("someday"). */
  raceDate: string | null;
  /** Finish-time goal, seconds. Null = just finish. */
  targetSec: number | null;
  /** ISO time the goal was set. */
  createdAt: string;
}

const MIN_KM = 1;
const MAX_KM = 100;
const MAX_TARGET_SEC = 24 * 3600;

/** Label for any distance: the named ones by name, the rest as "7.5 ק״מ". */
export function goalLabelFor(km: number): string {
  const named = GOAL_DISTANCES.find((d) => Math.abs(d.km - km) < 0.05);
  if (named) return named.label;
  const rounded = Math.round(km * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} ק״מ`;
}

const isDateStr = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** A stored goal, validated; anything malformed reads as "no goal". */
export function parseRunningGoal(raw: string | null): RunningGoal | null {
  if (!raw) return null;
  try {
    const g = JSON.parse(raw) as Partial<RunningGoal> | null;
    if (g === null || typeof g !== 'object') return null;
    const km = typeof g.distanceKm === 'number' ? g.distanceKm : Number.NaN;
    if (!Number.isFinite(km) || km < MIN_KM || km > MAX_KM) return null;
    const target =
      typeof g.targetSec === 'number' &&
      Number.isFinite(g.targetSec) &&
      g.targetSec > 0 &&
      g.targetSec < MAX_TARGET_SEC
        ? Math.round(g.targetSec)
        : null;
    return {
      distanceKm: km,
      label: typeof g.label === 'string' && g.label.trim() ? g.label.trim() : goalLabelFor(km),
      raceDate: isDateStr(g.raceDate) ? g.raceDate : null,
      targetSec: target,
      createdAt: typeof g.createdAt === 'string' ? g.createdAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export function readRunningGoal(): RunningGoal | null {
  try {
    return parseRunningGoal(localStorage.getItem(RUNNING_GOAL_KEY));
  } catch {
    return null;
  }
}

/** Save (or clear, with null) the goal, mirror it, and tell open screens. */
export function writeRunningGoal(goal: RunningGoal | null): void {
  try {
    // A cleared goal is stored as JSON null, not removed, so the mirror carries
    // the removal to other devices instead of restoring the old goal. (An empty
    // string would not do: the restore skips values that do not parse.)
    localStorage.setItem(RUNNING_GOAL_KEY, goal ? JSON.stringify(goal) : 'null');
    mirrorLocalKey(RUNNING_GOAL_KEY);
    window.dispatchEvent(new Event(GOAL_EVENT));
  } catch {
    // Storage blocked: the goal simply is not kept.
  }
}

/** Live goal — re-reads when another screen (or a cloud restore) changes it. */
export function useRunningGoal(): RunningGoal | null {
  const [goal, setGoal] = useState<RunningGoal | null>(readRunningGoal);
  useEffect(() => {
    const reload = () => setGoal(readRunningGoal());
    window.addEventListener(GOAL_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(GOAL_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);
  return goal;
}

// ---------------------------------------------------------------------------
// Goal arithmetic
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `now` (local day) to the goal date; negative once it has passed. */
export function daysUntil(raceDate: string, now: Date = new Date()): number {
  const [y, m, d] = raceDate.split('-').map(Number) as [number, number, number];
  const race = new Date(y, m - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((race - today) / DAY_MS);
}

/** Size class of a goal distance — drives plan length, long run and taper. */
export type GoalScale = 'short' | 'ten' | 'half' | 'marathon';

export function goalScale(km: number): GoalScale {
  if (km < 8) return 'short';
  if (km < 16) return 'ten';
  if (km < 30) return 'half';
  return 'marathon';
}

/**
 * Typical numbers for a recreational runner, per distance class — practice
 * ranges from common plans (Daniels, Pfitzinger, Higdon), not trial results:
 * weeks of focused training (5K 8–10, 10K 8–12, half 12–16, marathon 16–20),
 * the longest run to reach, taper length (Bosquet 2007: ~2 weeks, volume
 * −40–60%, intensity kept; shorter for 5K/10K) and peak weekly kilometres.
 */
export const GOAL_SCALE_NUMBERS: Readonly<
  Record<
    GoalScale,
    {
      planWeeks: number;
      taperDays: number;
      /** Longest run to reach, as a multiple of the goal distance, with a cap. */
      longRunFactor: number;
      longRunCapKm: number;
      weeklyKm: readonly [number, number];
    }
  >
> = {
  short: { planWeeks: 9, taperDays: 6, longRunFactor: 1.5, longRunCapKm: 10, weeklyKm: [20, 40] },
  ten: { planWeeks: 10, taperDays: 7, longRunFactor: 1.2, longRunCapKm: 16, weeklyKm: [30, 50] },
  half: { planWeeks: 14, taperDays: 10, longRunFactor: 0.85, longRunCapKm: 21, weeklyKm: [35, 60] },
  marathon: {
    planWeeks: 18,
    taperDays: 17,
    longRunFactor: 0.75,
    longRunCapKm: 32,
    weeklyKm: [50, 80],
  },
};

export type GoalPhase =
  /** No date set: train steadily toward the distance. */
  | 'open'
  /** More than a full plan away: build the base. */
  | 'base'
  /** Inside the plan: build volume and add quality. */
  | 'build'
  /** The last hard weeks before the taper. */
  | 'peak'
  /** Volume comes down, intensity stays. */
  | 'taper'
  /** The last 7 days. */
  | 'race_week'
  /** The date has passed. */
  | 'past';

export const GOAL_PHASE_LABELS: Readonly<Record<GoalPhase, string>> = {
  open: 'בונים לקראת המטרה',
  base: 'בניית בסיס',
  build: 'בנייה',
  peak: 'שיא האימונים',
  taper: 'הורדת עומס לפני המרוץ',
  race_week: 'שבוע המרוץ',
  past: 'תאריך המטרה עבר',
};

export function goalPhase(goal: RunningGoal, now: Date = new Date()): GoalPhase {
  if (!goal.raceDate) return 'open';
  const days = daysUntil(goal.raceDate, now);
  if (days < 0) return 'past';
  if (days <= 7) return 'race_week';
  const numbers = GOAL_SCALE_NUMBERS[goalScale(goal.distanceKm)];
  if (days <= numbers.taperDays) return 'taper';
  if (days <= numbers.taperDays + 21) return 'peak';
  if (days <= numbers.planWeeks * 7) return 'build';
  return 'base';
}

/** The longest run worth reaching before the goal, km. */
export function longRunTargetKm(goalKm: number): number {
  const n = GOAL_SCALE_NUMBERS[goalScale(goalKm)];
  return Math.round(Math.min(goalKm * n.longRunFactor, n.longRunCapKm));
}

/** Pace needed for the finish-time goal, seconds per km. */
export function targetPaceSecPerKm(goal: RunningGoal): number | null {
  return goal.targetSec ? goal.targetSec / goal.distanceKm : null;
}

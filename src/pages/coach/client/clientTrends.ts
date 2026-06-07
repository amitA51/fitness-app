// ============================================================================
// CLIENT 360 — pure trend transforms (Fresh Steel / Obsidian)
// ============================================================================
// I/O-free, unit-tested helpers that turn raw coach-read records into the shapes
// the trend surfaces consume (GlowAreaPoint series, signed measurement deltas,
// adherence streaks). No React, no fetching — keep it that way so the tests stay
// fast and deterministic.

import type { GlowAreaPoint } from '../../../components/charts';
import type { DayAdherence } from '../../../services/coach/coachAnalytics';
import type { BodyMeasurement } from '../../../services/supabaseSyncMappers';
import type { BodyWeightEntry } from '../../../types';

/** Max points kept in the weight trend series (a focused recent window). */
const WEIGHT_TREND_LIMIT = 30;

/** Hebrew labels for the body-measurement fields (mirrors the trainee Body tab). */
const MEASUREMENT_LABELS: Record<string, string> = {
  chest: 'חזה',
  waist: 'מותניים',
  hips: 'אגן',
  biceps: 'זרוע',
  arms: 'זרועות',
  thighs: 'ירכיים',
  thigh: 'ירך',
  neck: 'צוואר',
  shoulders: 'כתפיים',
};

/** Short DD/MM date label for chart axes (LTR-safe, no year to save width). */
function shortDateLabel(iso: string): string {
  // Accept both 'YYYY-MM-DD' and full ISO timestamps.
  const datePart = iso.includes('T') ? iso.slice(0, 10) : iso;
  const [, m, d] = datePart.split('-');
  if (m && d) return `${d}/${m}`;
  return datePart;
}

/**
 * Body-weight entries → ascending GlowAreaPoint series, capped to the most
 * recent `WEIGHT_TREND_LIMIT` points. Entries with a non-finite weight are
 * dropped. Input order is unknown (the read sorts date-desc), so we sort here.
 */
export function weightTrendPoints(weights: readonly BodyWeightEntry[]): GlowAreaPoint[] {
  const sorted = [...weights]
    .filter((w) => Number.isFinite(w.weight))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const recent = sorted.slice(-WEIGHT_TREND_LIMIT);
  return recent.map((w) => ({ x: shortDateLabel(w.date), y: w.weight }));
}

/** One measurement field's current-vs-previous summary with a small history. */
export interface MeasurementDelta {
  key: string;
  labelHe: string;
  current: number;
  previous: number | null;
  /** current − previous, or null when there is no previous reading. */
  delta: number | null;
  /** Ascending numeric history for this field (for a sparkline). */
  history: number[];
}

/** Whether a field reads "better when it goes down" (waist/hips type). */
function isLowerBetter(key: string): boolean {
  return key === 'waist' || key === 'hips';
}

/**
 * Per-field measurement deltas. For each numeric field present in the LATEST
 * reading, compare against the most recent earlier reading that also has that
 * field, and collect the ascending history. Fields are returned in a stable
 * order (known labels first, then any extras alphabetically).
 */
export function measurementDeltas(measurements: readonly BodyMeasurement[]): MeasurementDelta[] {
  if (measurements.length === 0) return [];

  // Ascending by date so history reads oldest → newest and "latest" is last.
  const asc = [...measurements].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const latest = asc[asc.length - 1];
  if (!latest) return [];

  const fieldValue = (m: BodyMeasurement, key: string): number | null => {
    const v = m.measurements?.[key];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  const latestKeys = Object.keys(latest.measurements ?? {}).filter(
    (k) => fieldValue(latest, k) !== null
  );

  // Stable ordering: known label order first, unknown extras alphabetically.
  const knownOrder = Object.keys(MEASUREMENT_LABELS);
  const orderedKeys = [
    ...knownOrder.filter((k) => latestKeys.includes(k)),
    ...latestKeys.filter((k) => !knownOrder.includes(k)).sort(),
  ];

  return orderedKeys.map((key) => {
    const history = asc.map((m) => fieldValue(m, key)).filter((v): v is number => v !== null);
    const current = fieldValue(latest, key) as number;
    // Most recent earlier reading that has this field (history minus the last).
    const previous = history.length > 1 ? (history[history.length - 2] as number) : null;
    const delta = previous !== null ? +(current - previous).toFixed(1) : null;
    return {
      key,
      labelHe: MEASUREMENT_LABELS[key] ?? key,
      current,
      previous,
      delta,
      history,
    };
  });
}

/** True when a field's delta represents an improvement (for chip coloring). */
export function isImprovement(key: string, delta: number): boolean {
  return isLowerBetter(key) ? delta < 0 : delta > 0;
}

/** Week labels for the 4-week volume series (oldest → newest). */
const VOLUME_WEEK_LABELS = ['לפני 3ש׳', 'לפני 2ש׳', 'שבוע שעבר', 'השבוע'];

/**
 * Volume-by-week (oldest → newest) → GlowAreaPoint series with Hebrew week
 * labels. Accepts any length; pads labels from the tail when there are exactly
 * four weeks (the analytics default), else uses a generic ordinal label.
 */
export function volumeTrendPoints(volumeByWeek: readonly number[]): GlowAreaPoint[] {
  const n = volumeByWeek.length;
  return volumeByWeek.map((value, i) => {
    let label: string;
    if (n === VOLUME_WEEK_LABELS.length) {
      label = VOLUME_WEEK_LABELS[i] as string;
    } else {
      const fromEnd = n - 1 - i;
      label = fromEnd === 0 ? 'השבוע' : `לפני ${fromEnd}ש׳`;
    }
    return { x: label, y: Math.round(value) };
  });
}

/** Adherence streaks over the trailing-7-day window. */
export interface StreakSummary {
  /** Consecutive days ending today with ≥1 workout. */
  currentWorkout: number;
  /** Longest run of consecutive workout days anywhere in the window. */
  longestWorkout: number;
  /** Consecutive days ending today that hit the calorie target (≤ target). */
  currentOnTarget: number;
}

/** True when a day counts as "on target" (has both calories and target, within it). */
function isOnTarget(day: DayAdherence): boolean {
  return day.calories != null && day.targetCalories != null && day.calories <= day.targetCalories;
}

/**
 * Compute workout/on-target streaks from the ordered (oldest → newest) 7-day
 * adherence window. "Current" streaks count backwards from the newest day.
 */
export function computeStreaks(days: readonly DayAdherence[]): StreakSummary {
  if (days.length === 0) {
    return { currentWorkout: 0, longestWorkout: 0, currentOnTarget: 0 };
  }

  // Longest run of consecutive workout days anywhere in the window.
  let longestWorkout = 0;
  let run = 0;
  for (const day of days) {
    if (day.sessions > 0) {
      run += 1;
      if (run > longestWorkout) longestWorkout = run;
    } else {
      run = 0;
    }
  }

  // Current streaks count backwards from the newest (last) day.
  let currentWorkout = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if ((days[i] as DayAdherence).sessions > 0) currentWorkout += 1;
    else break;
  }

  let currentOnTarget = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (isOnTarget(days[i] as DayAdherence)) currentOnTarget += 1;
    else break;
  }

  return { currentWorkout, longestWorkout, currentOnTarget };
}

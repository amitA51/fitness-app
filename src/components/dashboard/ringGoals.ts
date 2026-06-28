// ── Ring-goal baselines ──────────────────────────────────────────────────────
// Personal Activity-Ring goals derived from the user's own recent training
// rhythm. Pure, dependency-free logic extracted from Dashboard so it can be unit
// tested in isolation. When history is too thin (< MIN_BASELINE_WEEKS) we fall
// back to these sensible defaults (mirror the previous hardcoded maxima).

const DEFAULT_WEEKLY_WORKOUT_GOAL = 4;
const DEFAULT_WEEKLY_VOLUME_GOAL = 8000;
const DEFAULT_WEEKLY_MINUTES_GOAL = 240;
/** Trailing window (weeks) used to derive personal ring goals. */
const BASELINE_WEEKS = 4;
/** Min distinct active weeks before we trust a personal baseline. */
const MIN_BASELINE_WEEKS = 2;
/** Clamp range for the per-user weekly-workout goal. */
const WORKOUT_GOAL_MIN = 3;
const WORKOUT_GOAL_MAX = 6;

export interface RingGoals {
  workouts: number;
  volume: number;
  minutes: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const median = (values: number[]): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
    : (sorted[mid] ?? 0);
};

/**
 * Derive per-user ring goals from the trailing BASELINE_WEEKS of completed
 * sessions (excluding the current in-progress week). Goals reflect the user's
 * own rhythm: workouts = clamped avg sessions/wk, volume + minutes = trailing
 * weekly medians. Falls back to named defaults when history is too thin.
 */
export function deriveRingGoals(
  completed: ReadonlyArray<{ startTime: string; totalVolume?: number; duration?: number }>,
  currentWeekStart: Date
): RingGoals {
  const counts: number[] = [];
  const volumes: number[] = [];
  const minutes: number[] = [];

  for (let i = 1; i <= BASELINE_WEEKS; i++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekSessions = completed.filter((s) => {
      const d = new Date(s.startTime);
      return d >= weekStart && d < weekEnd;
    });
    if (weekSessions.length === 0) continue;

    counts.push(weekSessions.length);
    volumes.push(weekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0));
    minutes.push(Math.round(weekSessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60));
  }

  if (counts.length < MIN_BASELINE_WEEKS) {
    return {
      workouts: DEFAULT_WEEKLY_WORKOUT_GOAL,
      volume: DEFAULT_WEEKLY_VOLUME_GOAL,
      minutes: DEFAULT_WEEKLY_MINUTES_GOAL,
    };
  }

  const avgSessions = counts.reduce((a, b) => a + b, 0) / counts.length;
  return {
    workouts: clamp(Math.round(avgSessions), WORKOUT_GOAL_MIN, WORKOUT_GOAL_MAX),
    volume: Math.max(median(volumes), 1),
    minutes: Math.max(median(minutes), 1),
  };
}

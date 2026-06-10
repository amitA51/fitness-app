// ============================================================================
// insightPicker — pure priority picker for the dashboard insight card.
// ============================================================================
// Consumes only locally-computed fields from useFitnessInsights (no AI calls).
// Priority is chosen to NOT duplicate sibling dashboard surfaces:
//   1. Positive exercise progression (week-over-week volume) — nothing else on
//      the dashboard surfaces per-exercise progression.
//   2. Neglected NON-major muscle — ForecastNudge already covers overdue
//      Chest/Back/Legs, so those are excluded here.
//   3. Streak nudge — lowest, because WorkoutStreak already shows the number;
//      this only adds a "keep it up" framing for real streaks (≥3 days).

import type {
  MuscleGroupLastTrained,
  ProgressDelta,
} from '../../services/analyticsService';

/** Minimum week-over-week volume gain (%) worth celebrating. */
export const MIN_PROGRESSION_PCT = 10;
/** Minimum streak length before the nudge appears. */
export const MIN_STREAK_DAYS = 3;
/** A muscle counts as neglected from this many days since last trained… */
export const NEGLECT_MIN_DAYS = 7;
/** …and stops being a useful nudge past this (stale guilt, not insight). */
export const NEGLECT_MAX_DAYS = 30;

// ForecastNudge (sibling dashboard card) already surfaces these when overdue —
// excluding them keeps the two cards from saying the same thing.
const MUSCLES_COVERED_BY_FORECAST_NUDGE: ReadonlySet<string> = new Set([
  'Chest',
  'Back',
  'Legs',
]);

export type DashboardInsight =
  | { kind: 'progression'; exerciseName: string; changePct: number }
  | { kind: 'neglected'; muscle: string; daysSince: number }
  | { kind: 'streak'; days: number };

export interface InsightPickerInput {
  /** Week-over-week per-exercise volume deltas (aggregated locally). */
  weekOverWeekDeltas: readonly ProgressDelta[];
  muscleGroups: readonly MuscleGroupLastTrained[];
  currentStreak: number;
}

export function pickDashboardInsight(input: InsightPickerInput): DashboardInsight | null {
  // 1. Best positive progression — needs volume in BOTH weeks (a real trend,
  //    not a first appearance) and a meaningful gain.
  const bestDelta = input.weekOverWeekDeltas
    .filter((d) => d.previousVolume > 0 && d.currentVolume > 0 && d.change >= MIN_PROGRESSION_PCT)
    .reduce<ProgressDelta | null>((best, d) => (!best || d.change > best.change ? d : best), null);
  if (bestDelta) {
    return {
      kind: 'progression',
      exerciseName: bestDelta.exerciseName,
      changePct: bestDelta.change,
    };
  }

  // 2. Most-neglected non-major muscle within the useful window.
  const neglected = input.muscleGroups
    .filter(
      (m) =>
        m.daysSince >= NEGLECT_MIN_DAYS &&
        m.daysSince <= NEGLECT_MAX_DAYS &&
        !MUSCLES_COVERED_BY_FORECAST_NUDGE.has(m.muscle)
    )
    .reduce<MuscleGroupLastTrained | null>(
      (worst, m) => (!worst || m.daysSince > worst.daysSince ? m : worst),
      null
    );
  if (neglected) {
    return { kind: 'neglected', muscle: neglected.muscle, daysSince: neglected.daysSince };
  }

  // 3. Streak nudge.
  if (input.currentStreak >= MIN_STREAK_DAYS) {
    return { kind: 'streak', days: input.currentStreak };
  }

  return null;
}

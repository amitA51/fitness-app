// ============================================================================
// insightPicker — pure priority picker for the dashboard insight card.
// ============================================================================
// Consumes only locally-computed fields from useFitnessInsights (no AI calls).
// Priority is chosen to NOT duplicate sibling dashboard surfaces:
//   1. Positive exercise progression (week-over-week volume) — nothing else on
//      the dashboard surfaces per-exercise progression.
//   2. Most-neglected muscle (any group, including Chest/Back/Legs) within the
//      useful window — this insight is the only dashboard surface that calls out
//      an overdue muscle.
//   3. Streak nudge — lowest, because WorkoutStreak already shows the number;
//      this only adds a "keep it up" framing for real streaks (≥3 days).

import type { MuscleGroupLastTrained, ProgressDelta } from '../../services/analyticsService';

/** Minimum week-over-week volume gain (%) worth celebrating. */
export const MIN_PROGRESSION_PCT = 10;
/** Minimum streak length before the nudge appears. */
export const MIN_STREAK_DAYS = 3;
/** A muscle counts as neglected from this many days since last trained… */
export const NEGLECT_MIN_DAYS = 7;
/** …and stops being a useful nudge past this (stale guilt, not insight). */
export const NEGLECT_MAX_DAYS = 30;
/** Distinct muscle groups trained this month to read as a "balanced split". */
export const BALANCED_SPLIT_MIN_MUSCLES = 3;

export type DashboardInsight =
  | { kind: 'progression'; exerciseName: string; changePct: number }
  | { kind: 'neglected'; muscle: string; daysSince: number }
  | { kind: 'streak'; days: number }
  // Fallback tier — always-fillable affirmations over already-aggregated data so
  // the insight slot is never dark while real workouts exist.
  | { kind: 'consistency'; workoutsThisMonth: number }
  | { kind: 'balanced'; muscleCount: number };

export interface InsightPickerInput {
  /** Week-over-week per-exercise volume deltas (aggregated locally). */
  weekOverWeekDeltas: readonly ProgressDelta[];
  muscleGroups: readonly MuscleGroupLastTrained[];
  currentStreak: number;
  /** Completed workouts this calendar month (already aggregated). */
  workoutsThisMonth: number;
  /** Total completed workouts ever — used only to gate true zero-data. */
  totalWorkouts: number;
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

  // 2. Most-neglected muscle (any group) within the useful window.
  const neglected = input.muscleGroups
    .filter((m) => m.daysSince >= NEGLECT_MIN_DAYS && m.daysSince <= NEGLECT_MAX_DAYS)
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

  // ── Fallback tier — the three rare thresholds above all missed, but real
  // workouts still exist. Fill the slot with a useful affirmation instead of
  // going dark; only true zero-data (no workouts ever) returns null.
  if (input.totalWorkouts <= 0) return null;

  // 4. Consistency this month — concrete and motivating when ≥1 logged.
  if (input.workoutsThisMonth > 0) {
    return { kind: 'consistency', workoutsThisMonth: input.workoutsThisMonth };
  }

  // 5. Balanced split — affirm a well-rounded muscle spread when enough distinct
  //    groups were trained recently (within the same neglect window we track).
  const trainedMuscleCount = input.muscleGroups.filter(
    (m) => m.daysSince <= NEGLECT_MAX_DAYS
  ).length;
  if (trainedMuscleCount >= BALANCED_SPLIT_MIN_MUSCLES) {
    return { kind: 'balanced', muscleCount: trainedMuscleCount };
  }

  // Has past workouts but none this month and a thin recent split — fall back to
  // the consistency frame on the lifetime count so the slot still says something.
  return { kind: 'consistency', workoutsThisMonth: input.workoutsThisMonth };
}

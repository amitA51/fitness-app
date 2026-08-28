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
// When neither qualifies the picker returns null and the card renders nothing.
// An always-fillable affirmation (a monthly workout count, a "balanced split")
// restates data already shown elsewhere on the page — it is not an insight, and
// labelling it one makes the slot untrustworthy.

import type { MuscleGroupLastTrained, ProgressDelta } from '../../services/analyticsService';

/** Minimum week-over-week volume gain (%) worth celebrating. */
export const MIN_PROGRESSION_PCT = 10;
/** A muscle counts as neglected from this many days since last trained… */
export const NEGLECT_MIN_DAYS = 7;
/** …and stops being a useful nudge past this (stale guilt, not insight). */
export const NEGLECT_MAX_DAYS = 30;

export type DashboardInsight =
  | { kind: 'progression'; exerciseName: string; changePct: number }
  | { kind: 'neglected'; muscle: string; daysSince: number };

export interface InsightPickerInput {
  /** Week-over-week per-exercise volume deltas (aggregated locally). */
  weekOverWeekDeltas: readonly ProgressDelta[];
  muscleGroups: readonly MuscleGroupLastTrained[];
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

  // Nothing real qualifies — the caller renders nothing.
  return null;
}

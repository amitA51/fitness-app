// ============================================================================
// Where the runner stands against their goal.
// ============================================================================
// Three honest measures, each from data the app already has:
//   - finish time: today's equivalent (Riegel from the best recent run) against
//     the target, when there is one;
//   - the long run: the longest of the last 28 days against what the distance
//     needs before race day;
//   - weekly volume: the recent average against the usual range for the distance.

import {
  GOAL_SCALE_NUMBERS,
  type GoalPhase,
  type RunningGoal,
  daysUntil,
  goalPhase,
  goalScale,
  longRunTargetKm,
} from './goals';
import type { PaceReference } from './paceBands';
import type { RunningLoad } from './trainingLoad';

/** Riegel is trusted up to the half; past it a 5K says little about a marathon. */
const PREDICT_MAX_KM = 21.1;

export type FinishVerdict = 'on_track' | 'close' | 'stretch';

export interface GoalProgress {
  goal: RunningGoal;
  phase: GoalPhase;
  daysLeft: number | null;
  /** Today's equivalent finish time, seconds; null when it cannot be estimated. */
  predictedSec: number | null;
  /** Against the target time; null without a target or a prediction. */
  verdict: FinishVerdict | null;
  longRun: { targetKm: number; longestKm: number | null; share: number };
  weekly: { lowKm: number; highKm: number; recentAvgKm: number | null };
}

/** Within this much of the target counts as "close". */
const CLOSE = 0.05;

export function goalProgress(
  goal: RunningGoal,
  reference: PaceReference | null,
  load: RunningLoad,
  now: Date = new Date()
): GoalProgress {
  const predictedSec =
    reference && goal.distanceKm <= PREDICT_MAX_KM
      ? reference.fiveKSec * (goal.distanceKm / 5) ** 1.06
      : null;

  let verdict: FinishVerdict | null = null;
  if (predictedSec && goal.targetSec) {
    const over = predictedSec / goal.targetSec - 1;
    verdict = over <= 0 ? 'on_track' : over <= CLOSE ? 'close' : 'stretch';
  }

  const targetKm = longRunTargetKm(goal.distanceKm);
  const longest = load.longestLast28Km;
  const [lowKm, highKm] = GOAL_SCALE_NUMBERS[goalScale(goal.distanceKm)].weeklyKm;
  const recent = load.weeklyKm.slice(0, -1);
  const recentTotal = recent.reduce((a, b) => a + b, 0);

  return {
    goal,
    phase: goalPhase(goal, now),
    daysLeft: goal.raceDate ? daysUntil(goal.raceDate, now) : null,
    predictedSec,
    verdict,
    longRun: {
      targetKm,
      longestKm: longest,
      share: longest ? Math.min(1, longest / targetKm) : 0,
    },
    weekly: {
      lowKm,
      highKm,
      recentAvgKm: recentTotal > 0 ? recentTotal / recent.length : null,
    },
  };
}

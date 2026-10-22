// Everything the running-coach screens show, computed once from the user's
// sessions, heart-rate settings and goal. Pure maths underneath
// (services/running); this hook only gathers the inputs and memoises.

import { useMemo } from 'react';
import { useData } from '../contexts/DataContext';
import { readAthleteProfile } from '../services/intelligence/profile';
import {
  type GoalProgress,
  type NextRun,
  type PaceBand,
  type PaceReference,
  type RunningGoal,
  type RunningLoad,
  effectiveHrMax,
  goalProgress,
  nextRun,
  paceBandsFrom,
  paceReference,
  runningLoad,
  useCardioPrefs,
  useRunningGoal,
} from '../services/running';

export interface RunningCoach {
  goal: RunningGoal | null;
  progress: GoalProgress | null;
  reference: PaceReference | null;
  /** Personal paces to show (with reference.confidence telling how sure they are). */
  bands: PaceBand[] | null;
  /**
   * The same bands only when the reference was a real effort — used to grade
   * runs and to give pace targets. Null for a first estimate, so an ordinary
   * run is never called hard and nobody is told to slow down from a guess.
   */
  gradingBands: PaceBand[] | null;
  hrMax: { hrMax: number; measured: boolean } | null;
  load: RunningLoad;
  next: NextRun;
  weeklyGoalKm: number | null;
  /** True once there is at least one run to coach from. */
  hasRuns: boolean;
}

export function useRunningCoach(now?: Date): RunningCoach {
  const { sessions } = useData();
  const prefs = useCardioPrefs();
  const goal = useRunningGoal();
  const nowMs = now?.getTime();
  // Without a fixed `now`, recompute on the first render of a new day, so a
  // screen left open overnight does not keep yesterday's "rest today".
  const today = nowMs === undefined ? new Date().toDateString() : null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `today` only triggers the daily recompute
  return useMemo(() => {
    const at = nowMs !== undefined ? new Date(nowMs) : new Date();
    const hrMax = effectiveHrMax(prefs, readAthleteProfile().age);
    const reference = paceReference(sessions, at, hrMax?.hrMax ?? null);
    const bands = reference ? paceBandsFrom(reference.fiveKSec) : null;
    const gradingBands = reference?.confidence === 'high' ? bands : null;
    const load = runningLoad(sessions, {
      bands: gradingBands,
      hrMax: hrMax?.hrMax ?? null,
      now: at,
    });
    return {
      goal,
      progress: goal ? goalProgress(goal, reference, load, at) : null,
      reference,
      bands,
      gradingBands,
      hrMax,
      load,
      next: nextRun({ load, bands: gradingBands, hrMax: hrMax?.hrMax ?? null, goal, now: at }),
      weeklyGoalKm: prefs.weeklyGoalKm,
      hasRuns: load.daysSinceLastRun !== null,
    };
  }, [sessions, prefs, goal, nowMs, today]);
}

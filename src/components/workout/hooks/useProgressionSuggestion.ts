// useProgressionSuggestion — the progression engine's next target for the exercise
// on screen.
//
// services/progressionService decides increase / hold / back off from the lifter's
// own history. This hook feeds it the same recent-sessions list the "last time"
// strip reads (usePreviousData's shared cache, so opening an exercise costs no
// second read) and turns the verdict into the one chip the set screen shows: an
// arrow, a loadable number, one short reason, and the values a tap puts into the
// current set.
//
// Deliberately NOT fed: the recovery and training-load scores. The engine accepts
// them, but a neutral recovery log (6 h sleep, 3/5 on every scale) scores 42, under
// the 45 cut-off, which would turn every lift into an 80% deload on an ordinary
// day; and without logged RPE the load score is its own low-confidence default.
// Wiring them waits until that calibration is fixed.

import { useEffect, useMemo, useState } from 'react';
import {
  type ExerciseProgressionData,
  calculateProgression,
} from '../../../services/progressionService';
import type { WorkoutSession } from '../../../types';
import { loadRecentSessions, peekRecentSessions } from './usePreviousData';

export type SuggestionKind = 'increase' | 'hold' | 'decrease';

export interface ProgressionSuggestion {
  kind: SuggestionKind;
  /** kg a tap puts into the current set; null leaves the weight alone. */
  weight: number | null;
  /** Reps a tap puts into the current set; null leaves the reps alone. */
  reps: number | null;
  /** The number on the chip, e.g. "75 ק״ג" or "9 חזרות". */
  value: string;
  /** One short Hebrew line under the chip. */
  reason: string;
  /** What the button does, for screen readers. */
  ariaLabel: string;
}

export interface ProgressionSuggestionInput {
  exerciseName: string | undefined;
  /** Catalogue equipment key; unknown equipment keeps the classic 2.5 kg step. */
  equipment: string | undefined;
  /** A program's prescribed range, e.g. "8-10". Its top is the rep bar. */
  repRange: string | undefined;
  /** Working sets planned for this exercise today. */
  workingSets: number;
}

/** Top of a prescribed rep range: "8-10" → 10, "~6–8" → 8, "12" → 12, "AMRAP" → null. */
export function parseRepRangeTop(range: string | undefined): number | null {
  if (!range) return null;
  const numbers = (range.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n <= 100);
  return numbers.length > 0 ? Math.max(...numbers) : null;
}

const formatKg = (kg: number): string => String(Math.round(kg * 100) / 100);

/**
 * The chip for an engine verdict, or null when there is nothing worth saying:
 * fewer than two sessions of history (the "last time" strip already covers a
 * new exercise), or a plain hold with no evidence behind it.
 */
export function toProgressionSuggestion(
  data: ExerciseProgressionData
): ProgressionSuggestion | null {
  if (data.history.length < 2) return null;
  const top = data.reasons[0];
  if (!top || top.code === 'GENERAL_MAINTAIN') return null;

  const reason = top.short ?? top.message;
  const loaded = data.currentWeight > 0;
  const reps = data.suggestedReps;

  let kind: SuggestionKind;
  let weight: number | null;
  switch (data.recommendation) {
    case 'INCREASE_WEIGHT':
      if (!(data.weightChange > 0)) return null;
      kind = 'increase';
      weight = data.suggestedWeight;
      break;
    case 'INCREASE_REPS':
      if (reps == null) return null;
      kind = 'increase';
      weight = loaded ? data.currentWeight : null;
      break;
    case 'DECREASE_WEIGHT':
    case 'DELOAD':
      kind = 'decrease';
      weight = loaded && data.suggestedWeight < data.currentWeight ? data.suggestedWeight : null;
      if (weight == null && reps == null) return null;
      break;
    default:
      kind = 'hold';
      weight = loaded ? data.currentWeight : null;
      if (weight == null && reps == null) return null;
  }

  // The chip names the number that moves: reps for a reps progression, the
  // load otherwise (a hold shows the load it keeps).
  const showsReps = reps != null && (data.recommendation === 'INCREASE_REPS' || weight == null);
  const value = showsReps ? `${reps} חזרות` : `${formatKg(weight ?? 0)} ק״ג`;
  const action =
    kind === 'increase'
      ? `להעלות ל-${value}`
      : kind === 'decrease'
        ? `להוריד ל-${value}`
        : `להישאר על ${value}`;

  return {
    kind,
    weight,
    reps,
    value,
    reason,
    ariaLabel: `${action}. ${reason}. לחיצה ממלאת את הסט הנוכחי`,
  };
}

/** The recent-first session list, from the shared cache when it is fresh. */
function useRecentSessions(refreshKey: string | undefined): WorkoutSession[] | null {
  const [sessions, setSessions] = useState<WorkoutSession[] | null>(() => peekRecentSessions());

  useEffect(() => {
    if (!refreshKey) return;
    let cancelled = false;
    loadRecentSessions()
      .then((list) => {
        if (!cancelled) setSessions(list);
      })
      .catch(() => {
        // No history to reason from: the chip simply stays away. The "last
        // time" strip reports read failures through its own hook.
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return sessions;
}

/** The progression chip for the exercise on screen, or null while there is none. */
export function useProgressionSuggestion({
  exerciseName,
  equipment,
  repRange,
  workingSets,
}: ProgressionSuggestionInput): ProgressionSuggestion | null {
  const sessions = useRecentSessions(exerciseName);
  const prescribedReps = parseRepRangeTop(repRange);

  return useMemo(() => {
    if (!sessions || !exerciseName) return null;
    const verdict = calculateProgression({
      // Ids are minted fresh every workout; the engine matches history by name.
      exerciseId: '',
      exerciseName,
      targetReps: prescribedReps ?? 8,
      targetSets: Math.max(1, workingSets),
      sessions,
      equipment,
      prescribedReps,
    });
    return toProgressionSuggestion(verdict);
  }, [sessions, exerciseName, equipment, prescribedReps, workingSets]);
}

export default useProgressionSuggestion;

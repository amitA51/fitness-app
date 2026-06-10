// usePersonalRecords - Hook for PR tracking and celebration
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllWorkoutSessions } from '../../../services/dataService';
import {
  type PersonalRecord,
  calculateEst1RM,
  calculatePRsFromHistory,
  detectNewPRType,
  stableExerciseKey,
} from '../../../services/prService';
import type { Exercise, WorkoutSet } from '../../../types';
import { useWorkoutDispatch } from '../core/WorkoutContext';

interface UsePersonalRecordsReturn {
  prMap: Map<string, PersonalRecord>;
  getPRForExercise: (exerciseName: string) => PersonalRecord | undefined;
  checkForNewPR: (exerciseName: string, set: WorkoutSet) => PersonalRecord | null;
}

/**
 * Resolves the stable exercise identifier used by calculatePRsFromHistory.
 * Identity is the NORMALIZED EXERCISE NAME (stableExerciseKey), never the
 * per-session random exercise id — ids are regenerated every workout, so
 * keying on them made every exercise look like a brand-new PR every session.
 */
const resolveExerciseKey = (exercise: Exercise): string => stableExerciseKey(exercise);

/**
 * Signature of an exercise's last completed WORKING set, for per-exercise
 * dedup. Warmup sets are excluded — they never set records (same rule as the
 * summary count and finish-time persistence).
 */
const lastCompletedSetKey = (exercise: Exercise): string | null => {
  if (!exercise || !Array.isArray(exercise.sets)) return null;
  const completedSets = exercise.sets.filter((s) => s.completedAt && !s.isWarmup);
  const lastSet = completedSets[completedSets.length - 1];
  if (!lastSet) return null;
  return `${completedSets.length}-${lastSet.weight ?? 0}-${lastSet.reps ?? 0}-${lastSet.completedAt ?? ''}`;
};

/**
 * Hook for Personal Records tracking
 * Loads historical PRs and detects new ones during workout.
 *
 * NOTE: the second positional arg (current exercise index) is retained for the
 * caller's contract but intentionally unused — PR detection now scans every
 * exercise so a superset auto-advance can't skip a just-completed set.
 */
export function usePersonalRecords(
  exercises: Exercise[],
  _currentExerciseIndex: number
): UsePersonalRecordsReturn {
  const dispatch = useWorkoutDispatch();
  const [prMap, setPRMap] = useState<Map<string, PersonalRecord>>(() => new Map());
  // Detection is gated until history has loaded: running against a still-empty
  // prMap would flag every restored set as a "new PR".
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Track the last completed-set key we've already checked PER EXERCISE id.
  // Keyed on the stable exercise id (not the array index) so a superset
  // auto-advance — which reassigns currentExerciseIndex inside the same
  // COMPLETE_SET dispatch — can't cause a just-finished exercise's set to be
  // skipped. Each exercise is revisited independently when its own last
  // completed set changes.
  const seenSetKeyByExerciseRef = useRef<Map<string, string>>(new Map());

  // Seed the dedup map from the exercises present at MOUNT. A restored draft
  // arrives with already-completed sets — those were celebrated when they
  // happened (and may be stale by hours); re-announcing them on restore is a
  // false positive. Only sets completed AFTER mount can celebrate.
  const seededRef = useRef(false);
  if (!seededRef.current) {
    seededRef.current = true;
    for (const exercise of exercises) {
      const setKey = lastCompletedSetKey(exercise);
      if (setKey) {
        seenSetKeyByExerciseRef.current.set(resolveExerciseKey(exercise), setKey);
      }
    }
  }

  // Load PRs from history on mount
  useEffect(() => {
    const loadPRs = async () => {
      try {
        const sessions = await getAllWorkoutSessions();
        setPRMap(calculatePRsFromHistory(sessions));
      } catch {
        // Silently handle PR loading errors
      } finally {
        // Unblock detection even when history failed to load — for a brand-new
        // user an empty baseline is correct (their first sets ARE first PRs).
        setHistoryLoaded(true);
      }
    };
    loadPRs();
  }, []);

  // Get PR for specific exercise — callers pass exerciseName for display;
  // the composite key is the normalized name. Weight PR is the primary record.
  const getPRForExercise = useCallback(
    (exerciseName: string): PersonalRecord | undefined => {
      const key = stableExerciseKey({ name: exerciseName });
      if (!key) return undefined;
      return prMap.get(`${key}-weight`) ?? prMap.get(`${key}-volume`);
    },
    [prMap]
  );

  // Check if a set is a new PR (weight, volume, or reps — first match wins).
  const checkForNewPR = useCallback(
    (exerciseName: string, set: WorkoutSet): PersonalRecord | null => {
      const weight = set.weight || 0;
      const reps = set.reps || 0;
      if (weight <= 0 || reps <= 0) return null;

      // Resolve the stable name-based key that matches calculatePRsFromHistory
      const exerciseKey = stableExerciseKey({ name: exerciseName });
      if (!exerciseKey) return null;

      // Shared detector — the same rules the summary count uses.
      const prType = detectNewPRType(exerciseKey, weight, reps, prMap);
      if (!prType) return null;

      const newPR: PersonalRecord = {
        id: `pr-${exerciseKey}-${prType}-${Date.now()}`,
        exerciseId: exerciseKey,
        exerciseName,
        maxWeight: weight,
        maxReps: reps,
        oneRepMax: calculateEst1RM(weight, reps),
        date: set.completedAt || new Date().toISOString(),
        weight,
        reps,
        type: prType,
        value: prType === 'volume' ? weight * reps : undefined,
      };

      // Update prMap using the correct composite keys
      setPRMap((prev) => {
        const next = new Map(prev);
        const mapKey = `${exerciseKey}-${prType}`;
        next.set(mapKey, newPR);
        return next;
      });

      return newPR;
    },
    [prMap]
  );

  // Auto-detect PRs when sets are completed.
  //
  // Scans EVERY exercise's last completed set — not just the one at
  // currentExerciseIndex — because during a superset the COMPLETE_SET reducer
  // reassigns currentExerciseIndex to the next group member in the SAME
  // dispatch. Inspecting only the current exercise would miss the set that was
  // just completed on the previous member (silently swallowing superset PRs).
  // Per-exercise-id dedup ensures each newly-completed set fires at most one
  // celebration and that an auto-advance never skips the just-finished set.
  //
  // Gated on historyLoaded: until the PR baseline is in, nothing is marked
  // seen and nothing celebrates — when the gate opens the effect re-runs and
  // diffs any interim completions against the real baseline.
  useEffect(() => {
    if (!historyLoaded) return;
    try {
      for (const exercise of exercises) {
        const lastSetKey = lastCompletedSetKey(exercise);
        if (!lastSetKey) continue;

        const completedSets = (exercise.sets ?? []).filter((s) => s.completedAt && !s.isWarmup);
        const lastSet = completedSets[completedSets.length - 1];
        if (!lastSet) continue;

        const exerciseKey = resolveExerciseKey(exercise);

        // Skip if this exercise's last completed set is unchanged since last run.
        if (seenSetKeyByExerciseRef.current.get(exerciseKey) === lastSetKey) continue;
        seenSetKeyByExerciseRef.current.set(exerciseKey, lastSetKey);

        // Use exerciseName for the checkForNewPR call (it resolves the key internally)
        const name = exercise.name ?? exercise.exerciseName ?? '';
        const newPR = checkForNewPR(name, lastSet);
        if (newPR) {
          dispatch({ type: 'SHOW_PR_CELEBRATION', payload: newPR });
        }
      }
    } catch {
      // Silently handle PR detection errors
    }
  }, [exercises, checkForNewPR, dispatch, historyLoaded]);

  return {
    prMap,
    getPRForExercise,
    checkForNewPR,
  };
}

export default usePersonalRecords;

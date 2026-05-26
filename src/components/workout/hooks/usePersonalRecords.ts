// usePersonalRecords - Hook for PR tracking and celebration
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllWorkoutSessions } from '../../../services/dataService';
import {
  type PersonalRecord,
  calculatePRsFromHistory,
  isNewPR as checkIsNewPR,
} from '../../../services/prService';
import type { Exercise, WorkoutSet } from '../../../types';
import { useWorkoutDispatch } from '../core/WorkoutContext';

interface UsePersonalRecordsReturn {
  prMap: Map<string, PersonalRecord>;
  getPRForExercise: (exerciseName: string) => PersonalRecord | undefined;
  checkForNewPR: (exerciseName: string, set: WorkoutSet) => PersonalRecord | null;
}

/**
 * Hook for Personal Records tracking
 * Loads historical PRs and detects new ones during workout
 */
export function usePersonalRecords(
  exercises: Exercise[],
  currentExerciseIndex: number
): UsePersonalRecordsReturn {
  const dispatch = useWorkoutDispatch();
  const [prMap, setPRMap] = useState<Map<string, PersonalRecord>>(() => new Map());

  // Track what we've already checked to avoid duplicate celebrations
  const lastPRCheckRef = useRef<{
    exerciseIdx: number;
    setCount: number;
    lastSetKey: string | null;
  }>({
    exerciseIdx: -1,
    setCount: 0,
    lastSetKey: null,
  });

  // Load PRs from history on mount
  useEffect(() => {
    const loadPRs = async () => {
      try {
        // Pull full history so PRs older than the recent-N window are still
        // visible — otherwise long-time records get treated as new PRs again.
        const sessions = await getAllWorkoutSessions();
        setPRMap(calculatePRsFromHistory(sessions));
      } catch {
        // Silently handle PR loading errors
      }
    };
    loadPRs();
  }, []);

  // Get PR for specific exercise
  const getPRForExercise = useCallback((exerciseName: string) => prMap.get(exerciseName), [prMap]);

  // Check if a set is a new PR (weight, volume, or reps — first match wins).
  const checkForNewPR = useCallback(
    (exerciseName: string, set: WorkoutSet): PersonalRecord | null => {
      const weight = set.weight || 0;
      const reps = set.reps || 0;
      if (weight <= 0 || reps <= 0) return null;

      const diff = checkIsNewPR(exerciseName, weight, reps, prMap);
      const existing = prMap.get(exerciseName);
      const existingWeight = existing?.weight || 0;
      const repsThreshold = existingWeight * 0.85;
      const existingReps = existing?.reps || 0;
      const isRepsPR = weight >= repsThreshold && reps > existingReps;

      type PRType = 'weight' | 'volume' | 'reps';
      let prType: PRType | null = null;
      if (diff.isWeightPR) prType = 'weight';
      else if (diff.isVolumePR) prType = 'volume';
      else if (isRepsPR) prType = 'reps';
      if (!prType) return null;

      const newPR: PersonalRecord = {
        id: `pr-${exerciseName}-${prType}-${Date.now()}`,
        exerciseId: exerciseName,
        exerciseName,
        maxWeight: weight,
        maxReps: reps,
        oneRepMax: Math.round(weight * (1 + reps / 30)),
        date: set.completedAt || new Date().toISOString(),
        weight,
        reps,
        type: prType,
      };

      setPRMap((prev) => {
        const next = new Map(prev);
        const current = next.get(exerciseName);
        if (!current || newPR.weight >= (current.weight || 0)) {
          next.set(exerciseName, newPR);
        }
        return next;
      });

      return newPR;
    },
    [prMap]
  );

  // Auto-detect PRs when sets are completed
  useEffect(() => {
    try {
      const currentExercise = exercises[currentExerciseIndex];
      if (!currentExercise || !Array.isArray(currentExercise.sets)) return;

      const completedSets = currentExercise.sets.filter((s) => s.completedAt);
      const completedCount = completedSets.length;
      if (completedCount === 0) return;

      const lastSet = completedSets[completedCount - 1];
      if (!lastSet) return;

      const lastSetKey = `${lastSet.weight ?? 0}-${lastSet.reps ?? 0}-${lastSet.completedAt ?? ''}`;

      // Check if already processed
      const alreadyChecked =
        lastPRCheckRef.current.exerciseIdx === currentExerciseIndex &&
        lastPRCheckRef.current.setCount === completedCount &&
        lastPRCheckRef.current.lastSetKey === lastSetKey;

      if (alreadyChecked) return;

      lastPRCheckRef.current = {
        exerciseIdx: currentExerciseIndex,
        setCount: completedCount,
        lastSetKey,
      };

      // Check for new PR
      const newPR = checkForNewPR(currentExercise.name ?? '', lastSet);
      if (newPR) {
        dispatch({ type: 'SHOW_PR_CELEBRATION', payload: newPR });
      }
    } catch {
      // Silently handle PR detection errors
    }
  }, [exercises, currentExerciseIndex, checkForNewPR, dispatch]);

  return {
    prMap,
    getPRForExercise,
    checkForNewPR,
  };
}

export default usePersonalRecords;

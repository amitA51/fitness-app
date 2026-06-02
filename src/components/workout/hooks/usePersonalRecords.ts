// usePersonalRecords - Hook for PR tracking and celebration
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAllWorkoutSessions } from '../../../services/dataService';
import {
  type PersonalRecord,
  calculateEst1RM,
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
 * Resolves the stable exercise identifier used by calculatePRsFromHistory.
 * That function keys on `exercise.exerciseId || exercise.id` (WorkoutExercise).
 * The hook receives Exercise[] which has `id` (required) and optional `exerciseId`.
 * We mirror the same resolution order so map lookups match history keys.
 */
const resolveExerciseKey = (exercise: Exercise): string => exercise.exerciseId || exercise.id;

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
        const sessions = await getAllWorkoutSessions();
        setPRMap(calculatePRsFromHistory(sessions));
      } catch {
        // Silently handle PR loading errors
      }
    };
    loadPRs();
  }, []);

  // Get PR for specific exercise — callers pass exerciseName for display,
  // but we need the composite key. Look up weight PR by default.
  const getPRForExercise = useCallback(
    (exerciseName: string): PersonalRecord | undefined => {
      // Find the exercise object to resolve its stable id
      const exercise = exercises.find((e) => (e.name ?? e.exerciseName) === exerciseName);
      if (!exercise) return undefined;
      const key = resolveExerciseKey(exercise);
      // Return weight PR as the primary record (matches prior behavior)
      return prMap.get(`${key}-weight`) ?? prMap.get(`${key}-volume`);
    },
    [prMap, exercises]
  );

  // Check if a set is a new PR (weight, volume, or reps — first match wins).
  const checkForNewPR = useCallback(
    (exerciseName: string, set: WorkoutSet): PersonalRecord | null => {
      const weight = set.weight || 0;
      const reps = set.reps || 0;
      if (weight <= 0 || reps <= 0) return null;

      // Resolve the stable id that matches calculatePRsFromHistory keys
      const exercise = exercises.find((e) => (e.name ?? e.exerciseName) === exerciseName);
      if (!exercise) return null;
      const exerciseId = resolveExerciseKey(exercise);

      // isNewPR expects keys like `${exerciseId}-weight` / `${exerciseId}-volume`
      const diff = checkIsNewPR(exerciseId, weight, reps, prMap);

      // Reps PR threshold: weight >= 85% of current weight PR
      const existingWeightPR = prMap.get(`${exerciseId}-weight`);
      const existingWeight = existingWeightPR?.weight || 0;
      const repsThreshold = existingWeight * 0.85;
      const existingReps = existingWeightPR?.reps || 0;
      const isRepsPR = weight >= repsThreshold && reps > existingReps;

      type PRType = 'weight' | 'volume' | 'reps';
      let prType: PRType | null = null;
      if (diff.isWeightPR) prType = 'weight';
      else if (diff.isVolumePR) prType = 'volume';
      else if (isRepsPR) prType = 'reps';
      if (!prType) return null;

      const newPR: PersonalRecord = {
        id: `pr-${exerciseId}-${prType}-${Date.now()}`,
        exerciseId,
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
        const mapKey = `${exerciseId}-${prType}`;
        next.set(mapKey, newPR);
        return next;
      });

      return newPR;
    },
    [prMap, exercises]
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

      // Use exerciseName for the checkForNewPR call (it resolves the id internally)
      const name = currentExercise.name ?? currentExercise.exerciseName ?? '';
      const newPR = checkForNewPR(name, lastSet);
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

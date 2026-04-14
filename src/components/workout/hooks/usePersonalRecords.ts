// usePersonalRecords - Hook for PR tracking and celebration
import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkoutSet, Exercise } from '../../../types';
import { getWorkoutSessions } from '../../../services/dataService';
import {
    PersonalRecord,
    calculatePRsFromHistory,
    isNewPR as checkIsNewPR
} from '../../../services/prService';
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
                const sessions = await getWorkoutSessions();
                setPRMap(calculatePRsFromHistory(sessions));
            } catch {
                // Silently handle PR loading errors
            }
        };
        loadPRs();
    }, []);

    // Get PR for specific exercise
    const getPRForExercise = useCallback(
        (exerciseName: string) => prMap.get(exerciseName),
        [prMap]
    );

    // Check if a set is a new PR
    const checkForNewPR = useCallback(
        (exerciseName: string, set: WorkoutSet): PersonalRecord | null => {
            const weight = set.weight || 0;
            const reps = set.reps || 0;
            if (checkIsNewPR(exerciseName, weight, reps, prMap).isWeightPR) {
                const newPR: PersonalRecord = {
                    id: `pr-${exerciseName}-${Date.now()}`,
                    exerciseId: exerciseName,
                    exerciseName,
                    maxWeight: set.weight || 0,
                    maxReps: set.reps || 0,
                    oneRepMax: set.weight && set.reps
                        ? Math.round(set.weight * (1 + set.reps / 30))
                        : 0,
                    date: set.completedAt || new Date().toISOString(),
                    weight: set.weight || 0,
                    reps: set.reps || 0,
                    type: 'weight',
                };

                // Update local PR map
                setPRMap(prev => {
                    const next = new Map(prev);
                    next.set(exerciseName, newPR);
                    return next;
                });

                return newPR;
            }

            return null;
        },
        [prMap]
    );

    // Auto-detect PRs when sets are completed
    useEffect(() => {
        try {
            const currentExercise = exercises[currentExerciseIndex];
            if (!currentExercise || !Array.isArray(currentExercise.sets)) return;

            const completedSets = currentExercise.sets.filter(s => s.completedAt);
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

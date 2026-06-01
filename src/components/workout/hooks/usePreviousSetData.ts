// usePreviousSetData — single source for "ghost" / previous-set derivation on
// the active-workout surface.
//
// Wraps {@link usePreviousData} (which fetches + caches the most recent session
// for an exercise) and folds in the per-set ghost logic that previously lived
// inline in ExerciseDisplay: pick the previous set at the current index, then
// decide whether the weight/reps fields should show their ghost (placeholder)
// value. SetInputCard still owns how it *renders* a ghost value it's handed;
// this hook owns the data decision of what that value is and whether to show it.

import type { WorkoutSet } from '../../../types';
import { usePreviousData } from './usePreviousData';

export interface PreviousSetData {
  /** The matching set from the previous session (same index), if any. */
  previousSet: WorkoutSet | undefined;
  /** Show the ghost weight: ghosts enabled, no current weight, previous exists. */
  showGhostWeight: boolean;
  /** Show the ghost reps: ghosts enabled, no current reps, previous exists. */
  showGhostReps: boolean;
  /** Whether the previous data is still loading (no cached value yet). */
  isLoading: boolean;
}

/**
 * Derive previous-set ghost data for the active set.
 *
 * @param exerciseName  Current exercise name (cache key for previous data).
 * @param displaySetIndex  Index of the set currently being logged.
 * @param currentSet  The live set, used to suppress ghosts once a value exists.
 * @param showGhostValues  User setting — master switch for ghost display.
 */
export function usePreviousSetData(
  exerciseName: string | undefined,
  displaySetIndex: number,
  currentSet: Pick<WorkoutSet, 'weight' | 'reps'>,
  showGhostValues: boolean
): PreviousSetData {
  const { previousSets, isLoading } = usePreviousData(exerciseName);
  const previousSet = previousSets?.[displaySetIndex];

  const showGhostWeight = showGhostValues && !currentSet.weight && !!previousSet?.weight;
  const showGhostReps = showGhostValues && !currentSet.reps && !!previousSet?.reps;

  return { previousSet, showGhostWeight, showGhostReps, isLoading };
}

export default usePreviousSetData;

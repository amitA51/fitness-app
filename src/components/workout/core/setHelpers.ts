// Shared, dependency-free helpers for resolving the "active" set of an exercise.
// Kept in its own module (no settings/context imports) so both the reducer and
// the context selectors can share one implementation without creating an import
// cycle (workoutReducer <-> useWorkoutSettings <-> WorkoutContext).

import type { WorkoutSet } from '../../../types';

/**
 * Resolve the "active" set for an exercise: the first not-yet-completed set,
 * or a virtual slot at the end (sets.length) when every set is done.
 * Single source of truth shared by the reducer and the context selectors so
 * the active-set/currentSet logic stays identical everywhere.
 */
export const resolveActiveSet = (
  sets: WorkoutSet[] | undefined
): { activeSetIndex: number; currentSet: WorkoutSet | undefined } => {
  const list = sets ?? [];
  const idx = list.findIndex((s) => !s.completedAt);
  const activeSetIndex = idx === -1 ? list.length : idx;
  return { activeSetIndex, currentSet: list[activeSetIndex] };
};

// Workout Context - Split contexts to prevent unnecessary re-renders
import type React from 'react';
import { createContext, useContext, useMemo } from 'react';
import { type WorkoutSet, createWorkoutSet } from '../../../types';
import { resolveActiveSet } from './setHelpers';
import type { WorkoutAction, WorkoutDerivedValue, WorkoutState } from './workoutTypes';

// ============================================================
// CONTEXTS (Split for performance)
// ============================================================

// Main state context (for reading state)
const WorkoutStateContext = createContext<WorkoutState | null>(null);

// Dispatch context (stable reference, never causes re-renders)
const WorkoutDispatchContext = createContext<React.Dispatch<WorkoutAction> | null>(null);

// Derived values context (computed values)
const WorkoutDerivedContext = createContext<WorkoutDerivedValue | null>(null);

// ============================================================
// CONTEXT PROVIDERS
// ============================================================

export const WorkoutStateProvider = WorkoutStateContext.Provider;
export const WorkoutDispatchProvider = WorkoutDispatchContext.Provider;
export const WorkoutDerivedProvider = WorkoutDerivedContext.Provider;

// ============================================================
// HOOKS (Type-safe with descriptive errors)
// ============================================================

/**
 * Access the workout state (triggers re-render on any state change)
 * Use sparingly - prefer derived values or specific selectors
 */
export function useWorkoutState(): WorkoutState {
  const state = useContext(WorkoutStateContext);
  if (!state) {
    throw new Error('useWorkoutState must be used within WorkoutProvider');
  }
  return state;
}

/**
 * Access the dispatch function (stable, never triggers re-renders)
 */
export function useWorkoutDispatch(): React.Dispatch<WorkoutAction> {
  const dispatch = useContext(WorkoutDispatchContext);
  if (!dispatch) {
    throw new Error('useWorkoutDispatch must be used within WorkoutProvider');
  }
  return dispatch;
}

/**
 * Access derived/computed values (memoized)
 */
export function useWorkoutDerived(): WorkoutDerivedValue {
  const derived = useContext(WorkoutDerivedContext);
  if (!derived) {
    throw new Error('useWorkoutDerived must be used within WorkoutProvider');
  }
  return derived;
}

/**
 * Access both state and dispatch (convenience hook)
 */
export function useWorkout() {
  return {
    state: useWorkoutState(),
    dispatch: useWorkoutDispatch(),
    derived: useWorkoutDerived(),
  };
}

// ============================================================
// SELECTORS (Optimized state access)
// ============================================================

/**
 * Get current exercise info without subscribing to full state
 */
export function useCurrentExercise() {
  const state = useWorkoutState();
  const { exercises, currentExerciseIndex } = state;

  return useMemo(() => {
    const exercise = exercises[currentExerciseIndex];
    if (!exercise || !exercise.sets) return null;

    const { activeSetIndex: displaySetIndex } = resolveActiveSet(exercise.sets);
    const currentSet: WorkoutSet =
      exercise.sets[displaySetIndex] || createWorkoutSet({ reps: 0, weight: 0 });

    return {
      exercise,
      activeSetIndex: displaySetIndex,
      currentSet,
      totalSets: exercise.sets.length,
      completedSets: exercise.sets.filter((s) => s.completedAt).length,
    };
  }, [exercises, currentExerciseIndex]);
}

/**
 * Get the RAW workout settings object from state (or an empty object fallback).
 * Memoized so the empty-object fallback keeps a stable reference and doesn't
 * trigger consumer re-renders on unrelated state changes.
 *
 * NOTE: renamed from `useWorkoutSettings` to disambiguate from the rich
 * settings API in `hooks/useWorkoutSettings.ts` (which merges DEFAULT_WORKOUT_SETTINGS
 * and exposes get/updateSetting/action helpers). A backward-compat alias
 * `useWorkoutSettings` is re-exported below.
 */
export function useWorkoutSettingsRaw() {
  const state = useWorkoutState();
  const workoutSettings = state.appSettings?.workoutSettings;
  return useMemo(() => workoutSettings || {}, [workoutSettings]);
}

/**
 * @deprecated Use `useWorkoutSettingsRaw` (this context selector) or the rich
 * `useWorkoutSettings` from `../hooks/useWorkoutSettings`. Kept as a
 * non-breaking alias for existing importers of `./WorkoutContext`.
 */
export const useWorkoutSettings = useWorkoutSettingsRaw;

/**
 * Get rest timer state
 */
export function useRestTimer() {
  const state = useWorkoutState();
  return state.restTimer;
}

/**
 * Get UI overlay states. Return value is memoized so consumers only re-render
 * when one of these specific fields changes (not on every dispatch).
 */
export function useWorkoutOverlays() {
  const state = useWorkoutState();
  return useMemo(
    () => ({
      showSettings: state.showSettings,
      showExerciseSelector: state.showExerciseSelector,
      showQuickForm: state.showQuickForm,
      showExerciseLibrary: state.showExerciseLibrary,
      showGoalSelector: state.showGoalSelector,
      showWarmup: state.showWarmup,
      showCooldown: state.showCooldown,
      showWaterReminder: state.showWaterReminder,
      showTutorial: state.showTutorial,
      numpad: state.numpad,
      isDrawerOpen: state.isDrawerOpen,
    }),
    [
      state.showSettings,
      state.showExerciseSelector,
      state.showQuickForm,
      state.showExerciseLibrary,
      state.showGoalSelector,
      state.showWarmup,
      state.showCooldown,
      state.showWaterReminder,
      state.showTutorial,
      state.numpad,
      state.isDrawerOpen,
    ]
  );
}

/**
 * Get celebration states. Memoized — see useWorkoutOverlays for rationale.
 */
export function useWorkoutCelebration() {
  const state = useWorkoutState();
  return useMemo(
    () => ({
      showConfetti: state.showConfetti,
      showPRCelebration: state.showPRCelebration,
      pendingHaptic: state.pendingHaptic,
    }),
    [state.showConfetti, state.showPRCelebration, state.pendingHaptic]
  );
}

export default {
  WorkoutStateProvider,
  WorkoutDispatchProvider,
  WorkoutDerivedProvider,
  useWorkoutState,
  useWorkoutDispatch,
  useWorkoutDerived,
  useWorkout,
};

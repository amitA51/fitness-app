// Workout Context - Split contexts to prevent unnecessary re-renders
import React, { createContext, useContext } from 'react';
import {
    WorkoutState,
    WorkoutAction,
    WorkoutDerivedValue,
} from './workoutTypes';
import { WorkoutSet, createWorkoutSet } from '../../../types';

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
    const exercise = state.exercises[state.currentExerciseIndex];

    if (!exercise || !exercise.sets) return null;

    const activeSetIndex = exercise.sets.findIndex(s => !s.completedAt);
    const displaySetIndex = activeSetIndex === -1 ? exercise.sets.length : activeSetIndex;
    const currentSet: WorkoutSet = exercise.sets[displaySetIndex] || createWorkoutSet({ reps: 0, weight: 0 });

    return {
        exercise,
        activeSetIndex: displaySetIndex,
        currentSet,
        totalSets: exercise.sets.length,
        completedSets: exercise.sets.filter(s => s.completedAt).length,
    };
}

/**
 * Get workout settings
 */
export function useWorkoutSettings() {
    const state = useWorkoutState();
    return state.appSettings?.workoutSettings || {};
}

/**
 * Get rest timer state
 */
export function useRestTimer() {
    const state = useWorkoutState();
    return state.restTimer;
}

/**
 * Get UI overlay states
 */
export function useWorkoutOverlays() {
    const state = useWorkoutState();
    return {
        showSettings: state.showSettings,
        showExerciseSelector: state.showExerciseSelector,
        showQuickForm: state.showQuickForm,
        showExerciseLibrary: state.showExerciseLibrary,
        showGoalSelector: state.showGoalSelector,
        showWarmup: state.showWarmup,
        showCooldown: state.showCooldown,
        showWaterReminder: state.showWaterReminder,
        showTutorial: state.showTutorial,
        showAICoach: state.showAICoach,
        numpad: state.numpad,
        isDrawerOpen: state.isDrawerOpen,
    };
}

/**
 * Get celebration states
 */
export function useWorkoutCelebration() {
    const state = useWorkoutState();
    return {
        showConfetti: state.showConfetti,
        showPRCelebration: state.showPRCelebration,
        pendingHaptic: state.pendingHaptic,
    };
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

// Workout Module - Main exports
// This is the new modular architecture

// Main Component
export { default as ActiveWorkout } from './ActiveWorkoutNew';

// Core - Named exports for tree-shaking
export {
    // Types
    type RestTimerState,
    type NumpadState,
    type WorkoutState,
    type WorkoutAction,
    type ModalType,
    type WorkoutContextValue,
    type WorkoutDerivedValue,
    type WorkoutProviderProps,
    type WorkoutSummaryData,
    // Values
    HAPTIC_PATTERNS,
    createInitialState,
    // Reducer
    workoutReducer,
    // Provider
    WorkoutProvider,
    // Context hooks
    WorkoutStateProvider,
    WorkoutDispatchProvider,
    WorkoutDerivedProvider,
    useWorkoutState,
    useWorkoutDispatch,
    useWorkoutDerived,
    useWorkout,
    useCurrentExercise,
    useWorkoutSettings,
    useRestTimer,
    useWorkoutOverlays,
    useWorkoutCelebration,
} from './core';

// Hooks (exclude duplicates from core)
export { useWorkoutTimer, useRestTimer as useRestTimerHook, formatTime } from './hooks/useWorkoutTimer';
export { usePreviousData } from './hooks/usePreviousData';
export { usePersonalRecords } from './hooks/usePersonalRecords';

// Components - Already using named exports
export {
    SetInputCard,
    SwipeComplete,
    WorkoutHeader,
    ExerciseDisplay,
    ExerciseNav,
    ProgressBar,
    SetEditBottomSheet,
    IntensityMeter,
    ZONES,
    getZoneFromIntensity,
    PerformanceAnalytics,
    calculateVolume,
    formatDuration,
} from './components';

// Overlays - Already using named exports
export {
    RestTimerOverlay,
    NumpadOverlay,
    ConfirmExitOverlay,
    WorkoutSettingsOverlay,
} from './overlays';

// Types (from main types.ts)
export type {
    Exercise,
    WorkoutSet,
    WorkoutSession,
    WorkoutGoal,
    WorkoutTemplate,
    PersonalExercise,
    AppSettings
} from '../../types';

// Legacy exports (for backwards compatibility during migration)
export { default as WorkoutSummary } from './WorkoutSummary';
export { default as PRCelebration } from './PRCelebration';
export { default as ExerciseSelector } from './ExerciseSelector';
export { default as WarmupCooldownFlow } from './WarmupCooldownFlow';
export { default as WorkoutGoalSelector } from './WorkoutGoalSelector';
export { default as ExerciseTutorial } from './ExerciseTutorial';
export { default as AICoach } from './AICoach';
export { default as QuickExerciseForm } from './QuickExerciseForm';
export { default as WorkoutHistoryScreen } from './WorkoutHistoryScreen';

// History Hook
export { useWorkoutHistory } from './hooks/useWorkoutHistory';
export type { WorkoutHistoryStats, UseWorkoutHistoryResult } from './hooks/useWorkoutHistory';

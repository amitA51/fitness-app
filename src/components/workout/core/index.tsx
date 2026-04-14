// Core exports for workout module
// Named exports for better tree-shaking (avoid export *)

// Types
export type {
    RestTimerState,
    NumpadState,
    WorkoutState,
    ExerciseAction,
    SetAction,
    TimerAction,
    UIAction,
    ModalAction,
    DataAction,
    WorkoutAction,
    ModalType,
    WorkoutContextValue,
    WorkoutDerivedValue,
    WorkoutProviderProps,
    WorkoutSummaryData,
} from './workoutTypes';

// Values
export { HAPTIC_PATTERNS, createInitialState } from './workoutTypes';

// Reducer
export { workoutReducer } from './workoutReducer';

// Context hooks and providers
export {
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
} from './WorkoutContext';

// Provider component
export { WorkoutProvider } from './WorkoutProvider';

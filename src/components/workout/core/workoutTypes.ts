import type { PersonalRecord } from '../../../services/prService';
// Workout Module Types - Internal types for the workout feature
import type {
  ActiveExercise,
  AppSettings,
  RpeTag,
  SetSegment,
  SetTechnique,
  WorkoutSession,
  WorkoutSet,
} from '../../../types';

// ============================================================
// SUPERSET TYPES
// ============================================================

export interface SupersetGroup {
  id: string;
  exercises: string[]; // Exercise IDs
  restBetweenRounds?: number; // Rest time between rounds of superset
}

// ============================================================
// REST TIMER STATE
// ============================================================

export interface RestTimerState {
  active: boolean;
  endTime: number | null;
  totalTime: number;
  timeLeft: number;
}

export interface NumpadState {
  isOpen: boolean;
  target: 'weight' | 'reps' | null;
  value: string;
}

export interface WorkoutState {
  // === Core Data ===
  exercises: ActiveExercise[];
  currentExerciseIndex: number;

  // === Superset Groups ===
  supersetGroups: SupersetGroup[];

  // === Time Tracking (Stable Timestamps) ===
  startTimestamp: number;
  totalPausedTime: number;
  lastPauseTimestamp: number | null;
  isPaused: boolean;

  // === Rest Timer ===
  restTimer: RestTimerState;

  // === UI State ===
  showSettings: boolean;
  showExerciseSelector: boolean;
  showQuickForm: boolean;
  showExerciseLibrary: boolean;
  isDrawerOpen: boolean;
  numpad: NumpadState;

  // === Flow Modals ===
  showGoalSelector: boolean;
  showWarmup: boolean;
  showCooldown: boolean;
  showWaterReminder: boolean;
  showTutorial: boolean;
  showAICoach: boolean;
  showPlateCalc: boolean;

  // === Celebration State ===
  tutorialExercise: string | null;
  showConfetti: boolean;
  showPRCelebration: PersonalRecord | null;

  // === Settings (Cached from App) ===
  appSettings: AppSettings;

  // === Ghost Values (Previous Workout Data) ===
  previousExerciseData: WorkoutSet[] | null;

  // === Undo Buffer (one-deep) ===
  // Snapshot of the most recently deleted set so DELETE_SET can be undone via
  // RESTORE_DELETED_SET (re-inserted at its original index). One-deep only —
  // each delete overwrites the prior snapshot; restore clears it. `token`
  // identifies the deletion so a stale undo can't restore a different one.
  lastDeletedSet: {
    exerciseId: string;
    setIndex: number;
    set: WorkoutSet;
    token?: string | null;
  } | null;

  // === Haptic Trigger ===
  pendingHaptic: 'REST_END' | 'SET_COMPLETE' | null;

  // === Lifecycle ===
  // Set once the workout has been finished or discarded. While true the
  // provider stops persisting and clears the saved snapshot, so a finished
  // workout can never be restored / re-opened.
  finalized: boolean;

  // Wall-clock time (ms) of the last persist, used on restore to subtract the
  // time the app was closed/backgrounded from the workout duration.
  lastPersistedAt?: number;
}

// ============================================================
// ACTION TYPES
// ============================================================

// --- Exercise Actions ---
export type ExerciseAction =
  | { type: 'ADD_EXERCISE'; payload: ActiveExercise }
  | { type: 'REMOVE_EXERCISE'; payload: number }
  | { type: 'REORDER_EXERCISES'; payload: ActiveExercise[] }
  | { type: 'CHANGE_EXERCISE'; payload: number }
  | { type: 'RENAME_EXERCISE'; payload: { index: number; name: string } }
  | {
      type: 'UPDATE_EXERCISE_META';
      payload: {
        index: number;
        muscleGroup?: string;
        tempo?: string;
        targetRestTime?: number;
        tutorialText?: string;
      };
    }
  | { type: 'CREATE_SUPERSET'; payload: { exerciseIds: string[]; restBetweenRounds?: number } }
  | { type: 'REMOVE_SUPERSET'; payload: { exerciseId: string } }
  // Mid-workout movement swap: replace the live exercise's movement with a
  // chosen alternative (bilingual "Hebrew | English" label), keeping its sets,
  // RPE, rest, technique and notes — only the movement changes. Session-scoped.
  | { type: 'SWAP_EXERCISE'; payload: { exerciseId: string; newName: string } };

// --- Set Actions ---
export type SetAction =
  | { type: 'UPDATE_SET'; payload: { field: 'weight' | 'reps'; value: number } }
  | { type: 'COMPLETE_SET' }
  | { type: 'ADD_SET' }
  // Skip the active set (e.g. a warmup the user opts out of): mark it completed
  // + skipped, no rest timer, no volume. Advances to the next set.
  | { type: 'SKIP_SET' }
  // Replace the per-weight legs of a set (drop set / weight changed mid-set).
  // Empty array clears segments back to the plain weight×reps model.
  | { type: 'UPDATE_SET_SEGMENTS'; payload: { setIndex: number; segments: SetSegment[] } }
  | { type: 'UNDO_LAST_SET' }
  | { type: 'UPDATE_SET_NOTES'; payload: string | undefined }
  | { type: 'UPDATE_SET_RPE'; payload: number | undefined }
  | { type: 'UPDATE_SET_RPE_TAG'; payload: RpeTag | null }
  | { type: 'SET_TECHNIQUE'; payload: { technique: SetTechnique; value: boolean } }
  | {
      type: 'EDIT_SPECIFIC_SET';
      payload: {
        exerciseIndex: number;
        setIndex: number;
        updates: Partial<{ weight: number; reps: number }>;
      };
    }
  // `token` ties a delete to its undo toast: RESTORE_DELETED_SET with a token
  // only restores the snapshot of THAT deletion (a stale toast can no longer
  // resurrect a newer deletion's snapshot).
  | { type: 'DELETE_SET'; payload: { exerciseIndex: number; setIndex: number; token?: string } }
  | { type: 'RESTORE_DELETED_SET'; payload?: { token?: string } };

// --- Timer Actions ---
export type TimerAction =
  | { type: 'TOGGLE_PAUSE' }
  | { type: 'SKIP_REST' }
  | { type: 'ADD_REST_TIME'; payload: number }
  | { type: 'SET_REST_TIME'; payload: number }
  | { type: 'SYNC_REST_TIMER' }; // Only for rest timer, not workout timer

// --- UI Actions ---
export type UIAction =
  | { type: 'OPEN_NUMPAD'; payload: 'weight' | 'reps' }
  | { type: 'CLOSE_NUMPAD' }
  | { type: 'NUMPAD_INPUT'; payload: string }
  | { type: 'SET_NUMPAD_VALUE'; payload: string }
  | { type: 'NUMPAD_DELETE' }
  | { type: 'NUMPAD_CLEAR' }
  // `advance` (task 4): submit weight, then re-open the numpad on the SAME set
  // targeting 'reps' instead of closing — lets a set be logged in one flow.
  | { type: 'NUMPAD_SUBMIT'; payload?: { advance?: boolean } }
  | { type: 'TOGGLE_DRAWER'; payload: boolean }
  | { type: 'TOGGLE_SETTINGS'; payload: boolean }
  | { type: 'OPEN_SELECTOR' }
  | { type: 'CLOSE_SELECTOR' }
  | { type: 'OPEN_QUICK_FORM' }
  | { type: 'CLOSE_QUICK_FORM' }
  | { type: 'OPEN_EXERCISE_LIBRARY' }
  | { type: 'CLOSE_EXERCISE_LIBRARY' }
  | { type: 'OPEN_AI_COACH' }
  | { type: 'CLOSE_AI_COACH' }
  | { type: 'OPEN_PLATE_CALC' }
  | { type: 'CLOSE_PLATE_CALC' };

// --- Modal Actions ---
export type ModalAction =
  | { type: 'SET_MODAL_STATE'; payload: { modal: ModalType; isOpen: boolean } }
  | { type: 'SHOW_TUTORIAL'; payload: string }
  | { type: 'SHOW_PR_CELEBRATION'; payload: PersonalRecord }
  | { type: 'HIDE_PR_CELEBRATION' }
  | { type: 'HIDE_CONFETTI' };

// --- Settings & Data Actions ---
export type DataAction =
  | { type: 'SET_EXERCISES'; payload: ActiveExercise[] }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<AppSettings['workoutSettings']> }
  | { type: 'SET_PREVIOUS_DATA'; payload: WorkoutSet[] | null }
  | { type: 'CLEAR_PENDING_HAPTIC' }
  | { type: 'FINALIZE_WORKOUT' }
  // Discard the current (restored) draft in place and start over fresh —
  // used when the user chose "התחל חדש" over resuming a stale draft.
  | { type: 'RESET_ACTIVE_WORKOUT' };

// Combined Action Type
export type WorkoutAction =
  | ExerciseAction
  | SetAction
  | TimerAction
  | UIAction
  | ModalAction
  | DataAction;

// Modal Type
export type ModalType = 'goal' | 'warmup' | 'cooldown' | 'water' | 'tutorial' | 'aicoach';

// ============================================================
// CONTEXT TYPES
// ============================================================

export interface WorkoutContextValue {
  state: WorkoutState;
  dispatch: React.Dispatch<WorkoutAction>;
}

export interface WorkoutDerivedValue {
  currentExercise: ActiveExercise | undefined;
  activeSetIndex: number;
  currentSet: WorkoutSet;
  completedSetsCount: number;
  totalSets: number;
  totalVolume: number;
  progressPercent: number;
}

// ============================================================
// UTILITY TYPES
// ============================================================

export interface WorkoutProviderProps {
  item: {
    id: string;
    title?: string;
    exercises?: ActiveExercise[];
    workoutDuration?: number;
  };
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onExit: () => void;
  children: React.ReactNode;
}

export interface WorkoutSummaryData {
  session: WorkoutSession;
  duration: number;
  totalSets: number;
  totalVolume: number;
  prs: PersonalRecord[];
}

// ============================================================
// HAPTIC PATTERNS
// ============================================================

export const HAPTIC_PATTERNS = {
  TAP: [20],
  SET_COMPLETE: [50, 50, 50],
  REST_END: [200, 100, 200],
  PR_ACHIEVED: [100, 50, 100, 50, 200],
  SUCCESS: [50, 50, 100],
} as const;

// ============================================================
// INITIAL STATE FACTORY
// ============================================================

export const createInitialState = (
  exercises: ActiveExercise[],
  workoutDuration: number,
  appSettings: AppSettings
): WorkoutState => {
  const now = Date.now();

  return {
    exercises,
    currentExerciseIndex: 0,

    startTimestamp: now - workoutDuration * 1000,
    totalPausedTime: 0,
    lastPauseTimestamp: null,
    isPaused: false,

    restTimer: { active: false, endTime: null, totalTime: 0, timeLeft: 0 },

    // Superset groups
    supersetGroups: [],

    showSettings: false,
    showExerciseSelector: false,
    showQuickForm: false,
    showExerciseLibrary: false,
    isDrawerOpen: false,
    numpad: { isOpen: false, target: null, value: '' },

    showGoalSelector: false,
    showWarmup: false,
    showCooldown: false,
    showWaterReminder: false,
    showTutorial: false,
    showAICoach: false,
    showPlateCalc: false,

    tutorialExercise: null,
    showConfetti: false,
    showPRCelebration: null,

    appSettings,
    previousExerciseData: null,
    lastDeletedSet: null,
    pendingHaptic: null,
    finalized: false,
    lastPersistedAt: now,
  };
};

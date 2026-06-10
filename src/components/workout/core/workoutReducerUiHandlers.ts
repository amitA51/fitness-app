import { DEFAULT_WORKOUT_SETTINGS } from '../hooks/useWorkoutSettings';
import { createEmptySet, getActiveSetIndex } from './workoutReducerHelpers';
import type { WorkoutAction, WorkoutState } from './workoutTypes';

// ============================================================
// UI SLICE
// ============================================================

export const uiReducer = (draft: WorkoutState, action: WorkoutAction): void => {
  switch (action.type) {
    case 'OPEN_NUMPAD':
      draft.numpad = { isOpen: true, target: action.payload, value: '' };
      break;

    case 'CLOSE_NUMPAD':
      draft.numpad.isOpen = false;
      break;

    case 'NUMPAD_INPUT':
      // Block more than one decimal point
      if (action.payload === '.' && draft.numpad.value.includes('.')) break;
      draft.numpad.value += action.payload;
      break;

    case 'SET_NUMPAD_VALUE':
      draft.numpad.value = action.payload;
      break;

    case 'NUMPAD_DELETE':
      draft.numpad.value = draft.numpad.value.slice(0, -1);
      break;

    case 'NUMPAD_CLEAR':
      // Empty the working value in one tap (the 'נקה' key).
      draft.numpad.value = '';
      break;

    case 'NUMPAD_SUBMIT': {
      // `advance` (task 4): only valid from the 'weight' target — after writing
      // the weight, re-target the numpad to 'reps' on the SAME set and KEEP it
      // open, so a set is logged in one continuous flow. The default (no
      // payload / advance !== true) keeps the existing close-on-submit behavior.
      const advance = action.payload?.advance === true && draft.numpad.target === 'weight';

      if (draft.numpad.target) {
        let val = Number.parseFloat(draft.numpad.value);
        if (!Number.isNaN(val)) {
          if (draft.numpad.target === 'reps') {
            val = Math.max(0, Math.round(val || 0));
          }

          const exercise = draft.exercises[draft.currentExerciseIndex];
          if (exercise) {
            const sets = exercise.sets ?? [];
            const activeIdx = getActiveSetIndex(sets);
            // Mirror COMPLETE_SET's guard: don't write into a virtual slot past
            // the last set when the exercise is fully completed (would create a
            // junk 0×0 set). Just close the numpad.
            if (!(sets.length > 0 && activeIdx >= sets.length)) {
              if (!sets[activeIdx]) {
                sets[activeIdx] = createEmptySet(activeIdx + 1, exercise.isTimed);
              }
              exercise.sets = sets;
              sets[activeIdx]![draft.numpad.target] = val;
            }
          }
        }
      }

      if (advance) {
        // Stay open, switch to reps, start with an empty value for fresh entry.
        draft.numpad.target = 'reps';
        draft.numpad.value = '';
      } else {
        draft.numpad.isOpen = false;
      }
      break;
    }

    case 'TOGGLE_DRAWER':
      draft.isDrawerOpen = action.payload;
      break;

    case 'TOGGLE_SETTINGS':
      draft.showSettings = action.payload;
      break;

    case 'OPEN_SELECTOR':
      draft.showExerciseSelector = true;
      break;

    case 'CLOSE_SELECTOR':
      draft.showExerciseSelector = false;
      break;

    case 'OPEN_QUICK_FORM':
      draft.showQuickForm = true;
      break;

    case 'CLOSE_QUICK_FORM':
      draft.showQuickForm = false;
      break;

    case 'OPEN_EXERCISE_LIBRARY':
      draft.showExerciseLibrary = true;
      break;

    case 'CLOSE_EXERCISE_LIBRARY':
      draft.showExerciseLibrary = false;
      break;

    case 'OPEN_AI_COACH':
      draft.showAICoach = true;
      break;

    case 'CLOSE_AI_COACH':
      draft.showAICoach = false;
      break;

    case 'OPEN_PLATE_CALC':
      draft.showPlateCalc = true;
      break;

    case 'CLOSE_PLATE_CALC':
      draft.showPlateCalc = false;
      break;
  }
};

// ============================================================
// MODAL SLICE
// ============================================================

export const modalReducer = (draft: WorkoutState, action: WorkoutAction): void => {
  switch (action.type) {
    case 'SET_MODAL_STATE':
      if (action.payload.modal === 'goal') draft.showGoalSelector = action.payload.isOpen;
      if (action.payload.modal === 'warmup') draft.showWarmup = action.payload.isOpen;
      if (action.payload.modal === 'cooldown') draft.showCooldown = action.payload.isOpen;
      if (action.payload.modal === 'water') draft.showWaterReminder = action.payload.isOpen;
      if (action.payload.modal === 'tutorial') draft.showTutorial = action.payload.isOpen;
      if (action.payload.modal === 'aicoach') draft.showAICoach = action.payload.isOpen;
      break;

    case 'SHOW_TUTORIAL':
      draft.tutorialExercise = action.payload;
      draft.showTutorial = true;
      break;

    case 'SHOW_PR_CELEBRATION':
      draft.showPRCelebration = action.payload;
      // Confetti is gated on an ACTUAL PR (this action), honoring the user's
      // celebration intensity. 'full' → confetti; 'subtle'/'off' → card only.
      if (draft.appSettings?.workoutSettings?.prCelebrationIntensity === 'full') {
        draft.showConfetti = true;
      }
      break;

    case 'HIDE_PR_CELEBRATION':
      draft.showPRCelebration = null;
      break;

    case 'HIDE_CONFETTI':
      draft.showConfetti = false;
      break;
  }
};

// ============================================================
// DATA SLICE
// ============================================================

export const dataReducer = (draft: WorkoutState, action: WorkoutAction): void => {
  switch (action.type) {
    case 'UPDATE_SETTINGS':
      if (!draft.appSettings) {
        draft.appSettings = {} as typeof draft.appSettings;
      }
      // Base on DEFAULT_WORKOUT_SETTINGS so the merged result is a complete
      // WorkoutSettings (no cast needed). Existing values win over defaults,
      // and the incoming partial payload wins over both.
      draft.appSettings.workoutSettings = {
        ...DEFAULT_WORKOUT_SETTINGS,
        ...(draft.appSettings.workoutSettings || {}),
        ...action.payload,
      };
      break;

    case 'SET_PREVIOUS_DATA':
      draft.previousExerciseData = action.payload;
      break;

    case 'CLEAR_PENDING_HAPTIC':
      draft.pendingHaptic = null;
      break;

    case 'FINALIZE_WORKOUT':
      // Marks the workout as finished/discarded. The provider observes this and
      // stops persisting + clears the saved snapshot so it can't be restored.
      draft.finalized = true;
      break;

    case 'RESET_ACTIVE_WORKOUT':
      // Discard the current (restored) draft IN PLACE and start fresh — used
      // when a requested template start collides with a stale draft and the
      // user chose "התחל חדש". Unlike FINALIZE_WORKOUT, the session continues:
      // the provider keeps persisting (now-empty) state, and the template-load
      // effect fires because exercises is empty again.
      draft.exercises = [];
      draft.currentExerciseIndex = 0;
      draft.supersetGroups = [];
      draft.startTimestamp = Date.now();
      draft.totalPausedTime = 0;
      draft.lastPauseTimestamp = null;
      draft.isPaused = false;
      draft.restTimer = { active: false, endTime: null, totalTime: 0, timeLeft: 0 };
      draft.lastDeletedSet = null;
      draft.pendingHaptic = null;
      draft.showConfetti = false;
      draft.showPRCelebration = null;
      break;
  }
};

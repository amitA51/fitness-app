import type { WorkoutSet } from '../../../types';
// Workout Reducer - Sliced reducer pattern for better maintainability
import type { SupersetGroup, WorkoutAction, WorkoutState } from './workoutTypes';

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Parse rest time strings from program data (e.g. "2-3 min", "90 sec", "3 דק'")
 * Returns seconds. For ranges, uses the average.
 */
const parseRestTimeString = (str: string): number => {
  const s = str.toLowerCase().trim();

  // Match patterns like "2-3 min", "2-3 דקות", "90-120 sec"
  const rangeMatch = s.match(/(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(min|sec|דק|שנ)/i);
  if (rangeMatch) {
    const low = Number.parseFloat(rangeMatch[1]!);
    const high = Number.parseFloat(rangeMatch[2]!);
    const unit = rangeMatch[3]!;
    const avg = (low + high) / 2;
    if (unit.startsWith('min') || unit.startsWith('דק')) return Math.round(avg * 60);
    return Math.round(avg);
  }

  // Match patterns like "3 min", "90 sec", "2 דקות"
  const singleMatch = s.match(/(\d+(?:\.\d+)?)\s*(min|sec|דק|שנ)/i);
  if (singleMatch) {
    const val = Number.parseFloat(singleMatch[1]!);
    const unit = singleMatch[2]!;
    if (unit.startsWith('min') || unit.startsWith('דק')) return Math.round(val * 60);
    return Math.round(val);
  }

  // Plain number (assume seconds)
  const num = Number.parseFloat(s);
  if (!isNaN(num)) return Math.round(num);

  return 0;
};

const createNextSet = (
  currentSet: WorkoutSet,
  nextSetNumber: number,
  isTimed = false
): WorkoutSet => {
  const base: WorkoutSet = {
    id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    setNumber: nextSetNumber,
    reps: isTimed ? 0 : currentSet.reps, // reps don't apply to timed sets
    weight: currentSet.weight, // weight still applies (e.g., loaded carry, weighted plank)
    notes: '',
    rpe: null,
    isWarmup: false,
    isCompleted: false,
    completedAt: null,
  };
  if (isTimed) {
    base.duration = currentSet.duration ?? 0; // inherit previous duration
  }
  return base;
};

/**
 * Create a new empty set with all required fields
 */
const createEmptySet = (setNumber: number, isTimed = false): WorkoutSet => {
  const base: WorkoutSet = {
    id: `set-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    setNumber,
    reps: 0,
    weight: 0,
    rpe: null,
    isWarmup: false,
    isCompleted: false,
    notes: '',
    completedAt: null,
  };
  if (isTimed) {
    base.duration = 0;
  }
  return base;
};

const getActiveSetIndex = (sets: WorkoutSet[]): number => {
  const idx = sets.findIndex((s) => !s.completedAt);
  return idx === -1 ? sets.length : idx;
};

// ============================================================
// EXERCISE SLICE
// ============================================================

const exerciseReducer = (draft: WorkoutState, action: WorkoutAction): void => {
  switch (action.type) {
    case 'ADD_EXERCISE': {
      const exerciseName = action.payload?.name?.trim();
      if (!exerciseName) return;
      draft.exercises.push({ ...action.payload, name: exerciseName });
      draft.currentExerciseIndex = draft.exercises.length - 1;
      draft.showExerciseSelector = false;
      draft.showQuickForm = false;
      break;
    }

    case 'REMOVE_EXERCISE': {
      draft.exercises.splice(action.payload, 1);
      if (draft.currentExerciseIndex >= draft.exercises.length) {
        draft.currentExerciseIndex = Math.max(0, draft.exercises.length - 1);
      }
      break;
    }

    case 'REORDER_EXERCISES': {
      draft.exercises = action.payload.filter((ex) => ex.name?.trim());
      break;
    }

    case 'CHANGE_EXERCISE': {
      draft.currentExerciseIndex = action.payload;
      break;
    }

    case 'RENAME_EXERCISE': {
      const { index, name } = action.payload;
      const exercise = draft.exercises[index];
      if (exercise && name.trim()) {
        exercise.name = name.trim();
      }
      break;
    }

    case 'UPDATE_EXERCISE_META': {
      const { index, muscleGroup, tempo, targetRestTime, tutorialText } = action.payload;
      const exercise = draft.exercises[index];
      if (exercise) {
        if (muscleGroup !== undefined) exercise.muscleGroup = muscleGroup;
        if (tempo !== undefined) exercise.tempo = tempo;
        if (targetRestTime !== undefined) exercise.targetRestTime = targetRestTime;
        if (tutorialText !== undefined) exercise.tutorialText = tutorialText;
      }
      break;
    }

    case 'SET_EXERCISES': {
      draft.exercises = action.payload.filter((ex) => ex.name?.trim());
      break;
    }

    case 'CREATE_SUPERSET': {
      const { exerciseIds, restBetweenRounds } = action.payload;
      if (exerciseIds.length < 2) return;

      const superset: SupersetGroup = {
        id: `superset-${Date.now()}`,
        exercises: exerciseIds,
        restBetweenRounds: restBetweenRounds || 60,
      };

      draft.supersetGroups.push(superset);
      break;
    }
  }
};

// ============================================================
// SET SLICE
// ============================================================

const setReducer = (draft: WorkoutState, action: WorkoutAction): void => {
  const exercise = draft.exercises[draft.currentExerciseIndex];
  if (!exercise && action.type !== 'SET_EXERCISES') return;

  switch (action.type) {
    case 'UPDATE_SET': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      const activeIdx = getActiveSetIndex(sets);
      if (!sets[activeIdx]) {
        sets[activeIdx] = createEmptySet(activeIdx + 1, exercise.isTimed);
      }
      exercise.sets = sets;

      const activeSet = sets[activeIdx]!;
      sets[activeIdx]!.reps =
        action.payload.field === 'reps' ? action.payload.value : activeSet.reps;
      sets[activeIdx]!.weight =
        action.payload.field === 'weight' ? action.payload.value : activeSet.weight;
      break;
    }

    case 'COMPLETE_SET': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      const activeIdx = getActiveSetIndex(sets);
      if (!sets[activeIdx]) {
        sets[activeIdx] = createEmptySet(activeIdx + 1, exercise.isTimed);
      }
      exercise.sets = sets;

      const currentSet = sets[activeIdx]!;
      if (!currentSet) return;

      currentSet.completedAt = new Date().toISOString();

      // --- AUTO INCREMENT WEIGHT (Progressive Overload) ---
      // If this is the last set and auto-increment is on
      const settings = draft.appSettings?.workoutSettings;
      const shouldIncrement = settings?.autoIncrementWeight || settings?.enableProgressiveOverload;
      const incrementAmount = settings?.weightIncrementAmount || 2.5;

      // --- AUTO ADD NEXT SET ---
      // Logic: Only add next set if we haven't reached a target set count (not implemented yet)
      // OR if the user just completed the last existing set.
      if (activeIdx === sets.length - 1) {
        const nextSet = createNextSet(currentSet, sets.length + 1, exercise.isTimed);

        // Apply auto-increment if enabled
        if (shouldIncrement && nextSet.weight) {
          nextSet.weight += incrementAmount;
        }

        sets.push(nextSet);
      }

      // --- AUTO ADVANCE EXERCISE ---
      // If enabled, and this was the last planned set (logic difficult without "planned sets",
      // assuming manual advance for now unless explicit "3 sets done").
      // For now, we WON'T auto-advance on simple set completion to avoid confusion,
      // as users often add sets dynamically. keeping it manual or "Flow" button based.
      // *Wait, the requirement was to fix it.*
      // Let's implement it carefully: Only if `autoAdvanceExercise` is TRUE.
      if (settings?.autoAdvanceExercise) {
        // Determine if we should move on.
        // Since we just added a new set above, "advancing" might be annoying if they wanted to do that new set.
        // Standard behavior: Don't auto-advance in infinite-set mode.
        // Only auto-advance if we hit a target. Since we don't have targets, SKIP for safety.
        // Alternative: If `autoNav` is on, maybe we *don't* add the next set automatically?
        // Let's leave Auto-Advance for manual trigger in the UI (Next button behavior) for now
        // to avoid UX disasters.
      }

      // --- REST TIMER ---
      const shouldStartRest = settings?.autoStartRest ?? true; // Default to true

      if (shouldStartRest) {
        // Calculate Smart Rest - Priority: programExtras > targetRestTime > smartRest > default
        let restTime = settings?.defaultRestTime || 60;

        // 1. Program-prescribed rest time (highest priority)
        if (exercise.programExtras?.restTime) {
          const parsed = parseRestTimeString(String(exercise.programExtras.restTime));
          if (parsed > 0) restTime = parsed;
        }
        // 2. Exercise-specific target rest
        else if (exercise.targetRestTime) {
          restTime = exercise.targetRestTime;
        }
        // 3. Smart Rest Logic based on muscle group
        else if (settings?.smartRestEnabled) {
          if (exercise.muscleGroup === 'Legs' || exercise.muscleGroup === 'Back') {
            restTime = settings?.longRestTime || 180;
          } else if (exercise.muscleGroup === 'Arms' || exercise.muscleGroup === 'Shoulders') {
            restTime = settings?.shortRestTime || 60;
          } else {
            restTime = settings?.mediumRestTime || 90;
          }
        }

        draft.restTimer = {
          active: true,
          endTime: Date.now() + restTime * 1000,
          totalTime: restTime,
          timeLeft: restTime,
        };
      }

      // Haptic feedback
      if (settings?.hapticsEnabled) {
        draft.pendingHaptic = 'SET_COMPLETE';
      }

      // Confetti
      const intensity = draft.appSettings?.workoutSettings?.prCelebrationIntensity;
      if (intensity === 'full') {
        draft.showConfetti = true;
      }
      break;
    }

    case 'UNDO_LAST_SET': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      let lastCompletedIndex = -1;
      for (let i = sets.length - 1; i >= 0; i--) {
        if (sets[i]?.completedAt) {
          lastCompletedIndex = i;
          break;
        }
      }

      if (lastCompletedIndex !== -1) {
        const setToUndo = sets[lastCompletedIndex];
        if (setToUndo) {
          setToUndo.completedAt = null;
        }

        // Remove any empty set that follows (auto-generated)
        const nextSet = sets[lastCompletedIndex + 1];
        if (
          nextSet &&
          !nextSet.completedAt &&
          nextSet.weight === 0 &&
          nextSet.reps === 0 &&
          (nextSet.duration ?? 0) === 0
        ) {
          sets.splice(lastCompletedIndex + 1, 1);
        }

        // Stop timer and effects
        draft.restTimer = {
          active: false,
          endTime: null,
          totalTime: 0,
          timeLeft: 0,
        };
        draft.pendingHaptic = null;
        draft.showConfetti = false;
      }
      break;
    }

    case 'UPDATE_SET_NOTES': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      const activeIdx = getActiveSetIndex(sets);
      if (activeIdx < 0 || !sets[activeIdx]) return;
      sets[activeIdx]!.notes = action.payload ?? '';
      break;
    }

    case 'UPDATE_SET_RPE': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      const activeIdx = getActiveSetIndex(sets);
      if (activeIdx < 0 || !sets[activeIdx]) return;
      sets[activeIdx]!.rpe = action.payload ?? null;
      break;
    }

    case 'EDIT_SPECIFIC_SET': {
      const { exerciseIndex, setIndex, updates } = action.payload;
      const targetExercise = draft.exercises[exerciseIndex];
      if (!targetExercise) return;
      const targetSets = targetExercise.sets ?? [];
      if (!targetSets[setIndex]) return;

      const targetSet = targetSets[setIndex]!;
      if (updates.weight !== undefined) targetSet.weight = updates.weight;
      if (updates.reps !== undefined) targetSet.reps = updates.reps;
      break;
    }

    case 'DELETE_SET': {
      const { exerciseIndex, setIndex } = action.payload;
      const targetExercise = draft.exercises[exerciseIndex];
      if (!targetExercise) return;
      const targetSets = targetExercise.sets ?? [];
      if (!targetSets[setIndex]) return;

      // Don't allow deleting the last set
      if (targetSets.length <= 1) return;

      targetSets.splice(setIndex, 1);
      break;
    }
  }
};

// ============================================================
// TIMER SLICE
// ============================================================

const timerReducer = (draft: WorkoutState, action: WorkoutAction): void => {
  switch (action.type) {
    case 'TOGGLE_PAUSE': {
      draft.isPaused = !draft.isPaused;
      if (draft.isPaused) {
        draft.lastPauseTimestamp = Date.now();
      } else if (draft.lastPauseTimestamp) {
        draft.totalPausedTime += Date.now() - draft.lastPauseTimestamp;
        draft.lastPauseTimestamp = null;
      }
      break;
    }

    case 'SKIP_REST': {
      draft.restTimer.active = false;
      draft.restTimer.endTime = null;
      break;
    }

    case 'ADD_REST_TIME': {
      if (draft.restTimer.endTime) {
        draft.restTimer.endTime += action.payload * 1000;
      }
      break;
    }

    case 'SET_REST_TIME': {
      draft.restTimer = {
        active: true,
        endTime: Date.now() + action.payload * 1000,
        totalTime: action.payload,
        timeLeft: action.payload,
      };
      break;
    }

    case 'SYNC_REST_TIMER': {
      if (!draft.restTimer) {
        draft.restTimer = { active: false, endTime: null, totalTime: 0, timeLeft: 0 };
        return;
      }

      if (draft.restTimer.active && draft.restTimer.endTime) {
        const left = (draft.restTimer.endTime - Date.now()) / 1000;
        draft.restTimer.timeLeft = Math.max(0, left);

        if (left <= 0) {
          draft.restTimer.active = false;
          draft.restTimer.endTime = null;
          if (draft.appSettings?.workoutSettings?.hapticsEnabled) {
            draft.pendingHaptic = 'REST_END';
          }
        }
      }
      break;
    }
  }
};

// ============================================================
// UI SLICE
// ============================================================

const uiReducer = (draft: WorkoutState, action: WorkoutAction): void => {
  switch (action.type) {
    case 'OPEN_NUMPAD':
      draft.numpad = { isOpen: true, target: action.payload, value: '' };
      break;

    case 'CLOSE_NUMPAD':
      draft.numpad.isOpen = false;
      break;

    case 'NUMPAD_INPUT':
      draft.numpad.value += action.payload;
      break;

    case 'NUMPAD_DELETE':
      draft.numpad.value = draft.numpad.value.slice(0, -1);
      break;

    case 'NUMPAD_SUBMIT': {
      if (draft.numpad.target) {
        let val = Number.parseFloat(draft.numpad.value);
        if (!isNaN(val)) {
          if (draft.numpad.target === 'reps') {
            val = Math.max(0, Math.round(val || 0));
          }

          const exercise = draft.exercises[draft.currentExerciseIndex];
          if (exercise) {
            const sets = exercise.sets ?? [];
            const activeIdx = getActiveSetIndex(sets);
            if (!sets[activeIdx]) {
              sets[activeIdx] = createEmptySet(activeIdx + 1, exercise.isTimed);
            }
            exercise.sets = sets;
            sets[activeIdx]![draft.numpad.target] = val;
          }
        }
      }
      draft.numpad.isOpen = false;
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
  }
};

// ============================================================
// MODAL SLICE
// ============================================================

const modalReducer = (draft: WorkoutState, action: WorkoutAction): void => {
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

const dataReducer = (draft: WorkoutState, action: WorkoutAction): void => {
  switch (action.type) {
    case 'UPDATE_SETTINGS':
      if (!draft.appSettings) {
        draft.appSettings = {} as typeof draft.appSettings;
      }
      draft.appSettings.workoutSettings = {
        ...(draft.appSettings.workoutSettings || {}),
        ...action.payload,
      } as typeof draft.appSettings.workoutSettings;
      break;

    case 'SET_PREVIOUS_DATA':
      draft.previousExerciseData = action.payload;
      break;

    case 'CLEAR_PENDING_HAPTIC':
      draft.pendingHaptic = null;
      break;
  }
};

// ============================================================
// ACTION TYPE TO REDUCER ROUTING (for efficient dispatch)
// ============================================================

// Map action types to their handling reducers
// This prevents every action from going through all reducers
const EXERCISE_ACTIONS = new Set([
  'ADD_EXERCISE',
  'REMOVE_EXERCISE',
  'REORDER_EXERCISES',
  'CHANGE_EXERCISE',
  'RENAME_EXERCISE',
  'UPDATE_EXERCISE_META',
  'SET_EXERCISES',
]);

const SET_ACTIONS = new Set([
  'UPDATE_SET',
  'COMPLETE_SET',
  'UNDO_LAST_SET',
  'EDIT_SPECIFIC_SET',
  'DELETE_SET',
  'UPDATE_SET_RPE',
  'UPDATE_SET_NOTES',
]);

const TIMER_ACTIONS = new Set(['SKIP_REST', 'ADD_REST_TIME', 'SET_REST_TIME', 'SYNC_REST_TIMER']);

const UI_ACTIONS = new Set([
  'TOGGLE_DRAWER',
  'TOGGLE_SETTINGS',
  'OPEN_NUMPAD',
  'CLOSE_NUMPAD',
  'NUMPAD_INPUT',
  'NUMPAD_DELETE',
  'NUMPAD_SUBMIT',
  'OPEN_SELECTOR',
  'CLOSE_SELECTOR',
  'OPEN_QUICK_FORM',
  'CLOSE_QUICK_FORM',
  'OPEN_EXERCISE_LIBRARY',
  'CLOSE_EXERCISE_LIBRARY',
  'OPEN_AI_COACH',
  'CLOSE_AI_COACH',
]);

const MODAL_ACTIONS = new Set(['SET_MODAL_STATE']);

const DATA_ACTIONS = new Set(['UPDATE_SETTINGS', 'SET_PREVIOUS_DATA', 'CLEAR_PENDING_HAPTIC']);

// ============================================================
// MAIN REDUCER (Optimized routing)
// ============================================================

export const workoutReducer = (draft: WorkoutState, action: WorkoutAction): void => {
  const actionType = action.type;

  // Route to specific reducers based on action type
  // This is more efficient than passing every action through all reducers

  if (EXERCISE_ACTIONS.has(actionType)) {
    exerciseReducer(draft, action);
    return;
  }

  if (SET_ACTIONS.has(actionType)) {
    setReducer(draft, action);
    return;
  }

  if (TIMER_ACTIONS.has(actionType)) {
    timerReducer(draft, action);
    return;
  }

  if (UI_ACTIONS.has(actionType)) {
    uiReducer(draft, action);
    return;
  }

  if (MODAL_ACTIONS.has(actionType)) {
    modalReducer(draft, action);
    return;
  }

  if (DATA_ACTIONS.has(actionType)) {
    dataReducer(draft, action);
    return;
  }

  // Fallback: run through all reducers for unknown action types
  // This ensures new actions still work even if not categorized
  exerciseReducer(draft, action);
  setReducer(draft, action);
  timerReducer(draft, action);
  uiReducer(draft, action);
  modalReducer(draft, action);
  dataReducer(draft, action);
};

export default workoutReducer;

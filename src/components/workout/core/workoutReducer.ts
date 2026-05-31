import type { WorkoutSet } from '../../../types';
import type { WorkoutSettings } from '../../../types';
import { logger } from '../../../utils/logger';
import { DEFAULT_WORKOUT_SETTINGS } from '../hooks/useWorkoutSettings';
import { resolveActiveSet } from './setHelpers';
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
  if (!Number.isNaN(num)) return Math.round(num);

  return 0;
};

/**
 * Calculate smart rest time based on priority: superset > programExtras > targetRestTime > smartRest > default
 */
const calculateRestTime = (
  settings: WorkoutSettings | undefined,
  exercise: {
    muscleGroup?: string;
    targetRestTime?: number;
    programExtras?: { restTime?: unknown };
  },
  supersetShortRest: number | null,
  isDropSet: boolean
): number => {
  if (isDropSet) return 0;

  let restTime = settings?.defaultRestTime ?? DEFAULT_WORKOUT_SETTINGS.defaultRestTime;

  if (supersetShortRest !== null) {
    restTime = supersetShortRest;
  }
  // 1. Program-prescribed rest time
  else if (exercise.programExtras?.restTime) {
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
      restTime = settings?.longRestTime ?? DEFAULT_WORKOUT_SETTINGS.longRestTime;
    } else if (exercise.muscleGroup === 'Arms' || exercise.muscleGroup === 'Shoulders') {
      restTime = settings?.shortRestTime ?? DEFAULT_WORKOUT_SETTINGS.shortRestTime;
    } else {
      restTime = settings?.mediumRestTime ?? DEFAULT_WORKOUT_SETTINGS.mediumRestTime;
    }

    // 4. Scale by training goal (only when smart-rest computed the base)
    const goal = settings?.defaultWorkoutGoal;
    const factor = goal === 'strength' ? 1.8 : goal === 'endurance' ? 0.5 : 1.0; // hypertrophy/maintenance/general
    restTime = Math.round(restTime * factor);
    // Sanity clamp
    if (restTime < 30) restTime = 30;
    if (restTime > 600) restTime = 600;
  }

  return restTime;
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

/**
 * Re-export the shared, dependency-free active-set helper so existing importers
 * of `./workoutReducer` keep working while the implementation lives in one place
 * (see setHelpers.ts). The binding is imported at the top of this module.
 */
export { resolveActiveSet };

const getActiveSetIndex = (sets: WorkoutSet[]): number => resolveActiveSet(sets).activeSetIndex;

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

    case 'REMOVE_SUPERSET': {
      const { exerciseId } = action.payload;
      draft.supersetGroups = draft.supersetGroups.filter((g) => !g.exercises.includes(exerciseId));
      break;
    }
  }
};

// ============================================================
// SET SLICE
// ============================================================

const setReducer = (draft: WorkoutState, action: WorkoutAction): void => {
  const exercise = draft.exercises[draft.currentExerciseIndex];
  // No blanket early return: EDIT_SPECIFIC_SET/DELETE_SET target an exercise by
  // action.payload.exerciseIndex and must work even when currentExerciseIndex is
  // invalid. Cases that read the active exercise guard with `if (!exercise) return;`.

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
      currentSet.isCompleted = true;

      // --- SUPERSET MEMBERSHIP / TRANSITION (computed BEFORE auto-add) ---
      // If current exercise is part of a superset and not the last in the group,
      // we will jump to the next exercise + use a short between-exercise rest.
      // Round rest (full prescribed rest) applies only after the last exercise.
      // Detect a transition up front so we can skip auto-adding a trailing set
      // to the exercise we're leaving (otherwise it leaks an empty set there).
      const supersetMembership = draft.supersetGroups.find((g) =>
        g.exercises.includes(exercise.id)
      );
      let supersetShortRest: number | null = null;
      let isSupersetTransition = false;
      let nextSupersetIdx = -1;
      if (supersetMembership) {
        const orderInGroup = supersetMembership.exercises.indexOf(exercise.id);
        const isLastInGroup = orderInGroup === supersetMembership.exercises.length - 1;
        if (!isLastInGroup) {
          const nextExerciseId = supersetMembership.exercises[orderInGroup + 1];
          const nextIdx = draft.exercises.findIndex((e) => e.id === nextExerciseId);
          if (nextIdx !== -1) {
            isSupersetTransition = true;
            nextSupersetIdx = nextIdx;
            // Short transitional rest between superset exercises (default 15s)
            supersetShortRest = 15;
          }
        } else {
          // Last exercise of round → use group's restBetweenRounds
          supersetShortRest = supersetMembership.restBetweenRounds ?? 60;
        }
      }

      // --- AUTO INCREMENT WEIGHT (Progressive Overload) ---
      // If this is the last set and auto-increment is on
      const settings = draft.appSettings?.workoutSettings;
      const shouldIncrement = settings?.autoIncrementWeight || settings?.enableProgressiveOverload;
      const incrementAmount = settings?.weightIncrementAmount || 2.5;

      // --- AUTO ADD NEXT SET ---
      // Logic: Only add next set if we haven't reached a target set count (not implemented yet)
      // OR if the user just completed the last existing set.
      // Skip when transitioning to the next exercise in a superset group — the
      // active exercise is changing, so a trailing set here would just leak.
      if (activeIdx === sets.length - 1 && !isSupersetTransition) {
        const nextSet = createNextSet(currentSet, sets.length + 1, exercise.isTimed);
        nextSet.autoGenerated = true;

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

      // --- SUPERSET AUTO-ADVANCE (apply the transition computed above) ---
      if (isSupersetTransition) {
        draft.currentExerciseIndex = nextSupersetIdx;
      }

      // --- REST TIMER ---
      const shouldStartRest = settings?.autoStartRest ?? true; // Default to true

      if (shouldStartRest) {
        const restTime = calculateRestTime(
          settings,
          exercise,
          supersetShortRest,
          currentSet.isDropSet ?? false
        );

        if (restTime > 0) {
          draft.restTimer = {
            active: true,
            endTime: Date.now() + restTime * 1000,
            totalTime: restTime,
            timeLeft: restTime,
          };
        }
      }

      // Haptic feedback
      if (settings?.hapticsEnabled) {
        draft.pendingHaptic = 'SET_COMPLETE';
      }

      // Confetti is NOT fired here. Mere set completion is not a PR; confetti is
      // gated on an actual PR via the SHOW_PR_CELEBRATION handler (honoring
      // prCelebrationIntensity), which is dispatched only when a record is set.
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
          setToUndo.isCompleted = false;
        }

        // Remove any auto-generated set that follows (orphan from auto-increment)
        const nextSet = sets[lastCompletedIndex + 1];
        if (
          nextSet &&
          !nextSet.completedAt &&
          (nextSet.autoGenerated ||
            (nextSet.weight === 0 && nextSet.reps === 0 && (nextSet.duration ?? 0) === 0))
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

    case 'SET_TECHNIQUE': {
      if (!exercise) return;
      const sets = exercise.sets ?? [];
      const activeIdx = getActiveSetIndex(sets);
      if (!sets[activeIdx]) {
        sets[activeIdx] = createEmptySet(activeIdx + 1, exercise.isTimed);
      }
      exercise.sets = sets;
      const target = sets[activeIdx]!;
      const { technique, value } = action.payload;
      if (technique === 'warmup') target.isWarmup = value;
      else if (technique === 'dropSet') target.isDropSet = value;
      else if (technique === 'failure') target.isFailure = value;
      else if (technique === 'restPause') target.isRestPause = value;
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
        // Freeze rest timer: convert absolute endTime → remaining ms encoded
        // as a negative endTime (-msRemaining). SYNC_REST_TIMER ignores it
        // while isPaused; on resume we reconstruct a fresh absolute endTime.
        if (draft.restTimer.active && draft.restTimer.endTime) {
          const remainingMs = Math.max(0, draft.restTimer.endTime - Date.now());
          draft.restTimer.endTime = -remainingMs;
          draft.restTimer.timeLeft = remainingMs / 1000;
        }
      } else if (draft.lastPauseTimestamp) {
        draft.totalPausedTime += Date.now() - draft.lastPauseTimestamp;
        draft.lastPauseTimestamp = null;
        // Thaw rest timer: rebuild absolute endTime from frozen remaining.
        if (
          draft.restTimer.active &&
          draft.restTimer.endTime !== null &&
          draft.restTimer.endTime <= 0
        ) {
          const remainingMs = -draft.restTimer.endTime;
          draft.restTimer.endTime = Date.now() + remainingMs;
        }
      }
      break;
    }

    case 'SKIP_REST': {
      draft.restTimer.active = false;
      draft.restTimer.endTime = null;
      break;
    }

    case 'ADD_REST_TIME': {
      if (draft.restTimer.endTime !== null) {
        if (draft.restTimer.endTime <= 0) {
          // Frozen (paused): endTime encodes -remainingMs; adjust the magnitude
          const newRemaining = Math.max(1000, -draft.restTimer.endTime + action.payload * 1000);
          draft.restTimer.endTime = -newRemaining;
          draft.restTimer.timeLeft = newRemaining / 1000;
        } else {
          // Active: adjust absolute endTime
          const next = draft.restTimer.endTime + action.payload * 1000;
          const floor = Date.now() + 1000;
          draft.restTimer.endTime = Math.max(next, floor);
        }
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

      // Frozen (paused) timer: endTime is negative-remaining-ms; do not tick down.
      if (draft.isPaused || (draft.restTimer.endTime !== null && draft.restTimer.endTime <= 0)) {
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

    case 'NUMPAD_SUBMIT': {
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

const dataReducer = (draft: WorkoutState, action: WorkoutAction): void => {
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
  'CREATE_SUPERSET',
  'REMOVE_SUPERSET',
]);

const SET_ACTIONS = new Set([
  'UPDATE_SET',
  'COMPLETE_SET',
  'UNDO_LAST_SET',
  'EDIT_SPECIFIC_SET',
  'DELETE_SET',
  'UPDATE_SET_RPE',
  'UPDATE_SET_NOTES',
  'SET_TECHNIQUE',
]);

const TIMER_ACTIONS = new Set([
  'SKIP_REST',
  'ADD_REST_TIME',
  'SET_REST_TIME',
  'SYNC_REST_TIMER',
  'TOGGLE_PAUSE',
]);

const UI_ACTIONS = new Set([
  'TOGGLE_DRAWER',
  'TOGGLE_SETTINGS',
  'OPEN_NUMPAD',
  'CLOSE_NUMPAD',
  'NUMPAD_INPUT',
  'SET_NUMPAD_VALUE',
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
  'OPEN_PLATE_CALC',
  'CLOSE_PLATE_CALC',
]);

const MODAL_ACTIONS = new Set([
  'SET_MODAL_STATE',
  'SHOW_TUTORIAL',
  'SHOW_PR_CELEBRATION',
  'HIDE_PR_CELEBRATION',
  'HIDE_CONFETTI',
]);

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

  // No matching slice: explicit no-op. Previously this re-ran EVERY slice for
  // an unmapped action, which risked unintended state changes (and masked
  // typos). All known actions are routed above; anything else is ignored.
  if (import.meta.env.DEV) {
    logger.workout?.warn?.(`workoutReducer: unhandled action type "${actionType}"`);
  }
};

export default workoutReducer;

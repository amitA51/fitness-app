import { logger } from '../../../utils/logger';
import { resolveActiveSet } from './setHelpers';
import { exerciseReducer } from './workoutReducerExerciseHandlers';
// Workout Reducer - Sliced reducer pattern for better maintainability
import { DEFAULT_SUPERSET_ROUND_REST, SUPERSET_TRANSITION_REST } from './workoutReducerHelpers';
import { setReducer } from './workoutReducerSetHandlers';
import { timerReducer } from './workoutReducerTimerHandlers';
import { dataReducer, modalReducer, uiReducer } from './workoutReducerUiHandlers';
import type { WorkoutAction, WorkoutState } from './workoutTypes';

// ============================================================
// CONSTANTS
// ============================================================

/**
 * Re-export the superset rest-timing constants so existing importers of
 * `./workoutReducer` keep working while the implementation lives alongside the
 * rest-calculation helpers (see workoutReducerHelpers.ts).
 */
export { SUPERSET_TRANSITION_REST, DEFAULT_SUPERSET_ROUND_REST };

/**
 * Re-export the shared, dependency-free active-set helper so existing importers
 * of `./workoutReducer` keep working while the implementation lives in one place
 * (see setHelpers.ts). The binding is imported at the top of this module.
 */
export { resolveActiveSet };

// ============================================================
// ACTION TYPE TO REDUCER ROUTING (for efficient dispatch)
// ============================================================

// Map action types to their handling reducers
// This prevents every action from going through all reducers
const EXERCISE_ACTIONS = new Set([
  'ADD_EXERCISE',
  'ADD_EXERCISES',
  'REMOVE_EXERCISE',
  'REORDER_EXERCISES',
  'CHANGE_EXERCISE',
  'RENAME_EXERCISE',
  'UPDATE_EXERCISE_META',
  'SET_EXERCISES',
  'CREATE_SUPERSET',
  'REMOVE_SUPERSET',
  'SWAP_EXERCISE',
]);

const SET_ACTIONS = new Set([
  'UPDATE_SET',
  'COMPLETE_SET',
  'ADD_SET',
  'ADD_WARMUP_RAMP',
  'SKIP_SET',
  'UPDATE_SET_SEGMENTS',
  'UNDO_LAST_SET',
  'EDIT_SPECIFIC_SET',
  'DELETE_SET',
  'RESTORE_DELETED_SET',
  'UPDATE_SET_RPE',
  'UPDATE_SET_RPE_TAG',
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
  'NUMPAD_CLEAR',
  'NUMPAD_SUBMIT',
  'OPEN_SELECTOR',
  'CLOSE_SELECTOR',
  'OPEN_QUICK_FORM',
  'CLOSE_QUICK_FORM',
  'OPEN_EXERCISE_LIBRARY',
  'CLOSE_EXERCISE_LIBRARY',
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

const DATA_ACTIONS = new Set([
  'UPDATE_SETTINGS',
  'SET_PREVIOUS_DATA',
  'CLEAR_PENDING_HAPTIC',
  'FINALIZE_WORKOUT',
  'RESET_ACTIVE_WORKOUT',
]);

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

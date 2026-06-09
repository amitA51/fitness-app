import type { WorkoutAction, WorkoutState } from './workoutTypes';

// ============================================================
// TIMER SLICE
// ============================================================

export const timerReducer = (draft: WorkoutState, action: WorkoutAction): void => {
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

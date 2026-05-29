// useSupersetMode - Owns superset selection state and its create/remove handlers.
// Extracted from ActiveWorkoutNew. The hook tracks the two-step "pick first
// exercise, then pick second" selection flow and dispatches the resulting
// CREATE_SUPERSET / REMOVE_SUPERSET actions. The component consumes `supersetMode`
// for its indicator and wires the two handlers into ExerciseDisplay unchanged.
import type React from 'react';
import { useCallback, useState } from 'react';

import { triggerHaptic } from '../../../utils/haptics';
import type { WorkoutAction } from '../core/workoutTypes';

interface UseSupersetModeParams {
  dispatch: React.Dispatch<WorkoutAction>;
  defaultRestTime: number | undefined;
}

interface UseSupersetModeReturn {
  supersetMode: boolean;
  handleCreateSuperset: (exerciseId: string) => void;
  handleRemoveSuperset: (exerciseId: string) => void;
}

/**
 * Encapsulates the superset selection state machine.
 *
 * `handleCreateSuperset` is a two-step toggle: the first call enters superset
 * mode and records the first exercise; the second call (with a different
 * exercise) dispatches CREATE_SUPERSET and resets. `handleRemoveSuperset`
 * removes a superset and clears any in-progress selection.
 */
export function useSupersetMode({
  dispatch,
  defaultRestTime,
}: UseSupersetModeParams): UseSupersetModeReturn {
  const [supersetMode, setSupersetMode] = useState(false);
  const [supersetFirstExerciseId, setSupersetFirstExerciseId] = useState<string | null>(null);

  const handleCreateSuperset = useCallback(
    (exerciseId: string) => {
      if (!supersetMode) {
        // Enter superset mode - select first exercise
        triggerHaptic('medium');
        setSupersetMode(true);
        setSupersetFirstExerciseId(exerciseId);
      } else if (supersetFirstExerciseId && supersetFirstExerciseId !== exerciseId) {
        // Create superset with two exercises
        triggerHaptic('success');
        dispatch({
          type: 'CREATE_SUPERSET',
          payload: {
            exerciseIds: [supersetFirstExerciseId, exerciseId],
            restBetweenRounds: defaultRestTime || 60,
          },
        });
        setSupersetMode(false);
        setSupersetFirstExerciseId(null);
      }
    },
    [dispatch, supersetMode, supersetFirstExerciseId, defaultRestTime]
  );

  const handleRemoveSuperset = useCallback(
    (exerciseId: string) => {
      triggerHaptic('medium');
      dispatch({ type: 'REMOVE_SUPERSET', payload: { exerciseId } });
      setSupersetMode(false);
      setSupersetFirstExerciseId(null);
    },
    [dispatch]
  );

  return { supersetMode, handleCreateSuperset, handleRemoveSuperset };
}

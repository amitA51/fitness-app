// useSupersetMode - Owns superset creation via a picker bottom sheet.
//
// Previous design was a fragile two-step "tap the chip on exercise A, then
// navigate to exercise B and tap again" flow with no way to pick, cancel, or
// build a 3+ giant set. This version opens a `SupersetPicker` anchored on the
// exercise whose chip was tapped; the user multi-selects the other members and
// confirms, which dispatches a single CREATE_SUPERSET. `handleRemoveSuperset`
// removes the group an exercise belongs to.
import type React from 'react';
import { useCallback, useState } from 'react';

import { triggerHaptic } from '../../../utils/haptics';
import type { WorkoutAction } from '../core/workoutTypes';

interface UseSupersetModeParams {
  dispatch: React.Dispatch<WorkoutAction>;
  defaultRestTime: number | undefined;
}

interface UseSupersetModeReturn {
  /** Whether the SupersetPicker bottom sheet is open. */
  supersetPickerOpen: boolean;
  /** The exercise the picker was opened from (pre-selected and locked). */
  supersetAnchorId: string | null;
  /** Open the picker anchored on an exercise (wired to the "סופרסט" chip). */
  openSupersetPicker: (exerciseId: string) => void;
  /** Close the picker without creating a group. */
  closeSupersetPicker: () => void;
  /** Confirm the selection → dispatch CREATE_SUPERSET and close. */
  confirmSuperset: (exerciseIds: string[]) => void;
  /** Remove the superset group an exercise belongs to. */
  handleRemoveSuperset: (exerciseId: string) => void;
}

export function useSupersetMode({
  dispatch,
  defaultRestTime,
}: UseSupersetModeParams): UseSupersetModeReturn {
  const [supersetAnchorId, setSupersetAnchorId] = useState<string | null>(null);

  const openSupersetPicker = useCallback((exerciseId: string) => {
    triggerHaptic('medium');
    setSupersetAnchorId(exerciseId);
  }, []);

  const closeSupersetPicker = useCallback(() => {
    setSupersetAnchorId(null);
  }, []);

  const confirmSuperset = useCallback(
    (exerciseIds: string[]) => {
      if (exerciseIds.length < 2) {
        setSupersetAnchorId(null);
        return;
      }
      triggerHaptic('success');
      dispatch({
        type: 'CREATE_SUPERSET',
        payload: {
          exerciseIds,
          restBetweenRounds: defaultRestTime || 60,
        },
      });
      setSupersetAnchorId(null);
    },
    [dispatch, defaultRestTime]
  );

  const handleRemoveSuperset = useCallback(
    (exerciseId: string) => {
      triggerHaptic('medium');
      dispatch({ type: 'REMOVE_SUPERSET', payload: { exerciseId } });
      setSupersetAnchorId(null);
    },
    [dispatch]
  );

  return {
    supersetPickerOpen: supersetAnchorId !== null,
    supersetAnchorId,
    openSupersetPicker,
    closeSupersetPicker,
    confirmSuperset,
    handleRemoveSuperset,
  };
}

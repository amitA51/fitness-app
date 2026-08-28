import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Exercise, WorkoutGoal } from '../../../../types';
import type { WorkoutAction } from '../../core/workoutTypes';
import { useWorkoutEffects } from '../useWorkoutEffects';

vi.mock('../../../../services/dataService', () => ({ getWorkoutTemplate: vi.fn() }));
vi.mock('../../../../utils/haptics', () => ({ triggerHaptic: vi.fn() }));
vi.mock('../../../ui/GlobalToast', () => ({ showToast: vi.fn() }));

/**
 * Only the auto-open-selector effect is under test: no template id, so the
 * template-load effect bails, and `warmupPreference: 'never'` plus a stored goal
 * keep the start flow from dispatching modal actions into the same spy.
 */
const makeOptions = (
  dispatch: React.Dispatch<WorkoutAction>,
  overrides: { showExerciseSelector?: boolean; preWorkoutScreenShown?: boolean } = {}
) => ({
  dispatch,
  exercises: [] as Exercise[],
  currentExerciseIndex: 0,
  workoutSettings: {
    warmupPreference: 'never' as const,
    defaultWorkoutGoal: 'strength' as WorkoutGoal,
  },
  showGoalSelector: false,
  showWarmup: false,
  showCooldown: false,
  showExerciseSelector: false,
  showQuickForm: false,
  initialTemplateId: undefined,
  preWorkoutScreenShown: true,
  completedSetsCount: 0,
  currentExercise: null,
  keepScreenAwake: () => undefined,
  announceSetComplete: vi.fn(),
  pendingTimeouts: { current: [] as ReturnType<typeof setTimeout>[] },
  ...overrides,
});

const openSelectorCalls = (dispatch: ReturnType<typeof vi.fn>) =>
  dispatch.mock.calls.filter(([action]) => action.type === 'OPEN_SELECTOR');

describe('useWorkoutEffects — pre-workout selector auto-open', () => {
  it('opens the selector once after the welcome screen was dismissed', () => {
    const dispatch = vi.fn();
    renderHook((props: Parameters<typeof useWorkoutEffects>[0]) => useWorkoutEffects(props), {
      initialProps: makeOptions(dispatch),
    });

    expect(openSelectorCalls(dispatch)).toHaveLength(1);
  });

  it('does NOT reopen the selector after the user closed it (back gesture)', () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(
      (props: Parameters<typeof useWorkoutEffects>[0]) => useWorkoutEffects(props),
      { initialProps: makeOptions(dispatch) }
    );

    // The reducer honours the auto-open: the sheet is now on screen.
    rerender(makeOptions(dispatch, { showExerciseSelector: true }));
    // Back / X / "ביטול" / backdrop → CLOSE_SELECTOR. The workout still has no
    // exercises and the pre-workout intent is still set, which is exactly the
    // state that used to re-satisfy the auto-open condition and slam the sheet
    // straight back open, so "back" never reached the welcome screen.
    rerender(makeOptions(dispatch, { showExerciseSelector: false }));

    expect(openSelectorCalls(dispatch)).toHaveLength(1);
  });

  it('does NOT reopen when the HOST opened the sheet before this effect ran', () => {
    const dispatch = vi.fn();
    // The real sequence: "התחל אימון" sets the intent AND dispatches OPEN_SELECTOR
    // in the same tap, so the first render this effect ever sees already has the
    // sheet open. The intent must count as served anyway — otherwise the one-shot
    // is never claimed and the first close reopens the sheet in the next commit
    // (measured in the browser at 4 ms).
    const { rerender } = renderHook(
      (props: Parameters<typeof useWorkoutEffects>[0]) => useWorkoutEffects(props),
      { initialProps: makeOptions(dispatch, { showExerciseSelector: true }) }
    );
    expect(openSelectorCalls(dispatch)).toHaveLength(0);

    rerender(makeOptions(dispatch, { showExerciseSelector: false }));

    expect(openSelectorCalls(dispatch)).toHaveLength(0);
  });

  it('re-arms for the next fresh start once the pre-workout intent is cleared', () => {
    const dispatch = vi.fn();
    const { rerender } = renderHook(
      (props: Parameters<typeof useWorkoutEffects>[0]) => useWorkoutEffects(props),
      { initialProps: makeOptions(dispatch) }
    );

    rerender(makeOptions(dispatch, { showExerciseSelector: true }));
    // Closing the sheet clears the intent (back to the welcome screen)…
    rerender(makeOptions(dispatch, { preWorkoutScreenShown: false }));
    // …and tapping "התחל אימון" again sets it, so the safety net may fire anew.
    rerender(makeOptions(dispatch, { preWorkoutScreenShown: true }));

    expect(openSelectorCalls(dispatch)).toHaveLength(2);
  });
});

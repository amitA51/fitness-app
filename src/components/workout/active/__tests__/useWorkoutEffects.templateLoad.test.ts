import { renderHook, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Exercise, WorkoutGoal } from '../../../../types';
import type { WorkoutAction } from '../../core/workoutTypes';
import { useWorkoutEffects } from '../useWorkoutEffects';

// The template lookup is the async boundary the guard has to survive.
const getWorkoutTemplate = vi.fn();
vi.mock('../../../../services/dataService', () => ({
  getWorkoutTemplate: (...args: unknown[]) => getWorkoutTemplate(...args),
}));
vi.mock('../../../../utils/haptics', () => ({ triggerHaptic: vi.fn() }));
vi.mock('../../../ui/GlobalToast', () => ({ showToast: vi.fn() }));

const TEMPLATE = {
  id: 'tpl-1',
  exercises: [{ name: 'Bench Press' }, { name: 'Row' }, { name: 'Curl' }],
};

/** Minimal options object — only the template-load path is under test. */
const makeOptions = (dispatch: React.Dispatch<WorkoutAction>, exercises: Exercise[] = []) => ({
  dispatch,
  exercises,
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
  initialTemplateId: 'tpl-1',
  preWorkoutScreenShown: false,
  completedSetsCount: 0,
  currentExercise: null,
  keepScreenAwake: () => undefined,
  announceSetComplete: vi.fn(),
  pendingTimeouts: { current: [] },
});

describe('useWorkoutEffects — initial template load', () => {
  beforeEach(() => {
    getWorkoutTemplate.mockReset();
    getWorkoutTemplate.mockResolvedValue(TEMPLATE);
  });

  it('adds the template exactly once under StrictMode double-mount', async () => {
    const dispatch = vi.fn();
    // StrictMode mounts → cleans up → mounts the effect again. Both passes see an
    // empty exercise list because the fetch has not resolved, so the length guard
    // alone lets both through and the plan gets appended twice.
    renderHook(() => useWorkoutEffects(makeOptions(dispatch)), { wrapper: StrictMode });

    await waitFor(() => {
      expect(dispatch.mock.calls.some(([a]) => a.type === 'ADD_EXERCISES')).toBe(true);
    });

    const adds = dispatch.mock.calls.filter(([a]) => a.type === 'ADD_EXERCISES');
    expect(adds).toHaveLength(1);
    expect(adds[0]?.[0].payload).toHaveLength(3);
    expect(getWorkoutTemplate).toHaveBeenCalledTimes(1);
  });

  it('leaves a restored draft alone instead of appending the template to it', async () => {
    const dispatch = vi.fn();
    const draft = [{ id: 'ex-1', name: 'Squat', sets: [] } as unknown as Exercise];
    renderHook(() => useWorkoutEffects(makeOptions(dispatch, draft)), { wrapper: StrictMode });

    await Promise.resolve();
    expect(getWorkoutTemplate).not.toHaveBeenCalled();
    expect(dispatch.mock.calls.some(([a]) => a.type === 'ADD_EXERCISES')).toBe(false);
  });
});

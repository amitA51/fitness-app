import { renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Exercise, WorkoutSet } from '../../../../types';
import { WorkoutDispatchProvider, WorkoutStateProvider } from '../../core/WorkoutContext';
import type { WorkoutState } from '../../core/workoutTypes';
import { usePersonalRecords } from '../usePersonalRecords';

// No PR history → empty prMap → every positive-weight set is a weight PR.
vi.mock('../../../../services/dataService', () => ({
  getAllWorkoutSessions: vi.fn().mockResolvedValue([]),
}));

const dispatch = vi.fn();

const state = {} as unknown as WorkoutState;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <WorkoutDispatchProvider value={dispatch}>
    <WorkoutStateProvider value={state}>{children}</WorkoutStateProvider>
  </WorkoutDispatchProvider>
);

const mkSet = (overrides: Partial<WorkoutSet>): WorkoutSet =>
  ({
    id: 'set',
    setNumber: 1,
    reps: 5,
    weight: 100,
    rpe: null,
    isWarmup: false,
    isCompleted: false,
    notes: '',
    completedAt: null,
    ...overrides,
  }) as WorkoutSet;

const mkExercise = (id: string, sets: WorkoutSet[]): Exercise =>
  ({ id, name: id, sets }) as unknown as Exercise;

describe('usePersonalRecords · superset PR detection (finding [6])', () => {
  beforeEach(() => {
    dispatch.mockClear();
  });

  it('fires a celebration for a set completed on exercise A even when currentExerciseIndex has auto-advanced to B', async () => {
    // Arrange — exercise A has one open set, B is untouched, index starts at A.
    const exA = mkExercise('A', [mkSet({ id: 'a1', completedAt: null })]);
    const exB = mkExercise('B', [mkSet({ id: 'b1', completedAt: null })]);

    const { rerender } = renderHook(
      ({ exercises, idx }: { exercises: Exercise[]; idx: number }) =>
        usePersonalRecords(exercises, idx),
      { wrapper, initialProps: { exercises: [exA, exB], idx: 0 } }
    );

    // Wait for the (empty) history load to settle so prMap is ready.
    await waitFor(() => expect(dispatch).not.toHaveBeenCalled());

    // Act — simulate the superset COMPLETE_SET dispatch: A's set is now
    // completed AND the index has already advanced to B in the same update.
    const exACompleted = mkExercise('A', [
      mkSet({ id: 'a1', weight: 100, reps: 5, completedAt: '2026-06-05T10:00:00.000Z' }),
    ]);
    rerender({ exercises: [exACompleted, exB], idx: 1 });

    // Assert — the celebration is for A's set, not B (B has no completed set).
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SHOW_PR_CELEBRATION',
          payload: expect.objectContaining({ exerciseName: 'A' }),
        })
      );
    });
  });

  it('does not re-fire for the same completed set on a subsequent render', async () => {
    const exA = mkExercise('A', [
      mkSet({ id: 'a1', weight: 100, reps: 5, completedAt: '2026-06-05T10:00:00.000Z' }),
    ]);

    const { rerender } = renderHook(
      ({ exercises, idx }: { exercises: Exercise[]; idx: number }) =>
        usePersonalRecords(exercises, idx),
      { wrapper, initialProps: { exercises: [exA], idx: 0 } }
    );

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'SHOW_PR_CELEBRATION' })
      )
    );
    const callsAfterFirst = dispatch.mock.calls.length;

    // Re-render with the SAME completed set — must not celebrate again.
    rerender({ exercises: [exA], idx: 0 });
    await Promise.resolve();
    expect(dispatch.mock.calls.length).toBe(callsAfterFirst);
  });
});

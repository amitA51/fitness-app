import { renderHook, waitFor } from '@testing-library/react';
import { type Mock, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Exercise, WorkoutGoal } from '../../../../types';
import { completedSetsVolume, computeSessionStats } from '../../../../utils/workoutMath';
import { resolveActiveSet } from '../../core/setHelpers';
import type { WorkoutAction } from '../../core/workoutTypes';
import { useWorkoutEffects } from '../useWorkoutEffects';

// The template lookup is the async boundary the loader crosses.
const getWorkoutTemplate = vi.fn();
vi.mock('../../../../services/dataService', () => ({
  getWorkoutTemplate: (...args: unknown[]) => getWorkoutTemplate(...args),
}));
vi.mock('../../../../utils/haptics', () => ({ triggerHaptic: vi.fn() }));
vi.mock('../../../ui/GlobalToast', () => ({ showToast: vi.fn() }));

/** Minimal options object — only the template-load path is under test. */
const makeOptions = (dispatch: React.Dispatch<WorkoutAction>) => ({
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
  initialTemplateId: 'tpl-1',
  preWorkoutScreenShown: false,
  completedSetsCount: 0,
  currentExercise: null,
  keepScreenAwake: () => undefined,
  announceSetComplete: vi.fn(),
  pendingTimeouts: { current: [] },
});

/** Mount the hook against the mocked template and return the loaded exercises. */
const loadTemplate = async (template: unknown): Promise<Exercise[]> => {
  getWorkoutTemplate.mockResolvedValue(template);
  const dispatch = vi.fn() as Mock;
  renderHook(() => useWorkoutEffects(makeOptions(dispatch)));

  await waitFor(() => {
    expect(dispatch.mock.calls.some(([a]) => a.type === 'ADD_EXERCISES')).toBe(true);
  });
  const add = dispatch.mock.calls.find(([a]) => a.type === 'ADD_EXERCISES');
  return (add?.[0] as { payload: Exercise[] }).payload;
};

describe('useWorkoutEffects — template set/rep prescription', () => {
  beforeEach(() => {
    getWorkoutTemplate.mockReset();
  });

  it('opens a 4×8 regular template exercise with four sets and 8 as the rep target', async () => {
    // Exactly what builtInWorkoutTemplates ships for squat — and no
    // programExtras, so this is an ORDINARY template, not a structured program.
    const loaded = await loadTemplate({
      id: 'tpl-1',
      exercises: [{ name: 'סקוואט', targetSets: 4, targetReps: 8 }],
    });

    const sets = loaded[0]?.sets ?? [];
    expect(sets).toHaveLength(4);
    expect(sets.map((s) => s.reps)).toEqual([8, 8, 8, 8]);
    // warmupCount stays program-only: a regular template carries no warmup data.
    expect(sets.some((s) => s.isWarmup)).toBe(false);
  });

  it('counts none of the pre-created sets as completed, in any tally the app reports', async () => {
    const loaded = await loadTemplate({
      id: 'tpl-1',
      exercises: [
        { name: 'סקוואט', targetSets: 4, targetReps: 8 },
        { name: 'לחיצת חזה', targetSets: 3, targetReps: 12 },
      ],
    });
    const sets = loaded.flatMap((ex) => ex.sets ?? []);
    expect(sets).toHaveLength(7);

    // Every completion flag the app actually reads, on every pre-created set:
    // `completedAt` (ExerciseDisplay's counter, resolveActiveSet, the persisted
    // shape) and `isCompleted` (completedSetsVolume, the reducer). A target also
    // carries no logged load, so it cannot contribute volume even unguarded.
    for (const s of sets) {
      expect(s.completedAt).toBeNull();
      expect(s.isCompleted).toBe(false);
      expect(s.weight).toBe(0);
    }

    // The runner opens ON set 1. A list that read as already-logged would put
    // the active index past the end instead.
    expect(resolveActiveSet(sets).activeSetIndex).toBe(0);

    // The finish dialog's own numbers — WorkoutSummary calls computeSessionStats
    // with exactly these options.
    const stats = computeSessionStats({ exercises: loaded }, { excludeWarmup: true });
    expect(stats.completedSets).toBe(0);
    expect(stats.totalSets).toBe(0);
    expect(stats.totalReps).toBe(0);
    expect(stats.totalVolume).toBe(0);
    expect(stats.exerciseCount).toBe(0);
    expect(stats.exerciseStats).toEqual([]);

    // The shared completed-sets volume sum used by analytics / progression /
    // training load.
    expect(completedSetsVolume(sets)).toBe(0);
  });

  it('still opens a template exercise with no stored targets as exactly one blank set', async () => {
    const loaded = await loadTemplate({
      id: 'tpl-1',
      exercises: [{ name: 'פלאנק' }],
    });

    const sets = loaded[0]?.sets ?? [];
    expect(sets).toHaveLength(1);
    expect(sets[0]?.reps).toBe(0);
    expect(sets[0]?.weight).toBe(0);
    expect(sets[0]?.completedAt).toBeNull();
  });

  it('leaves the structured-program path untouched (warmups, notes, targets)', async () => {
    const loaded = await loadTemplate({
      id: 'tpl-1',
      exercises: [
        {
          name: 'דדליפט',
          targetSets: 3,
          targetReps: 10,
          notes: 'גב ישר',
          programExtras: { warmupSets: 1 },
        },
      ],
    });

    const sets = loaded[0]?.sets ?? [];
    // [ warmup, ...working ] — warmup first, no target reps on the ramp-up.
    expect(sets).toHaveLength(4);
    expect(sets[0]?.isWarmup).toBe(true);
    expect(sets[0]?.reps).toBe(0);
    expect(sets.slice(1).map((s) => s.reps)).toEqual([10, 10, 10]);
    expect(loaded[0]?.notes).toBe('גב ישר');
  });
});

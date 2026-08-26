// Tests for the ADD_WARMUP_RAMP reducer handler — the auto warm-up generator
// (Hevy warm-up-calculator pattern): 40/60/80% ramp before the first working
// set, 2.5kg rounding, idempotent.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings, Exercise } from '../../../../types';
import { workoutReducer } from '../workoutReducer';
import { createInitialState } from '../workoutTypes';
import type { WorkoutState } from '../workoutTypes';

const mkSettings = (): AppSettings =>
  ({
    workoutSettings: {},
    unitSystem: 'metric',
  }) as unknown as AppSettings;

const mkSet = (n: number, weight: number, reps: number) => ({
  id: `set-${n}`,
  setNumber: n,
  reps,
  weight,
  rpe: null,
  isWarmup: false,
  isCompleted: false,
  notes: '',
  completedAt: null,
});

const mkExercise = (sets: ReturnType<typeof mkSet>[]): Exercise =>
  ({
    id: 'ex-1',
    name: 'Bench Press',
    sets,
    notes: '',
    restSeconds: 90,
    isCompleted: false,
  }) as unknown as Exercise;

const apply = (state: WorkoutState, action: Parameters<typeof workoutReducer>[1]): WorkoutState => {
  const draft = structuredClone(state);
  workoutReducer(draft, action);
  return draft;
};

describe('ADD_WARMUP_RAMP', () => {
  let baseState: WorkoutState;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00Z'));
    baseState = createInitialState(
      [mkExercise([mkSet(1, 100, 5), mkSet(2, 100, 5)])],
      0,
      mkSettings()
    );
  });

  it('inserts a 40/60/80% ramp before the working sets and renumbers', () => {
    const state = apply(baseState, {
      type: 'ADD_WARMUP_RAMP',
      payload: { workingWeight: 100 },
    });

    const sets = state.exercises[0]!.sets!;
    expect(sets.length).toBe(5);
    expect(sets.map((s) => s.isWarmup)).toEqual([true, true, true, false, false]);
    expect(sets.map((s) => s.weight)).toEqual([40, 60, 80, 100, 100]);
    expect(sets.map((s) => s.reps)).toEqual([8, 5, 3, 5, 5]);
    expect(sets.map((s) => s.setNumber)).toEqual([1, 2, 3, 4, 5]);
  });

  it('rounds to 2.5kg plates and drops duplicate weights', () => {
    const state = apply(
      (() => {
        const s = structuredClone(baseState);
        s.exercises[0]!.sets = [mkSet(1, 62.5, 8)];
        return s;
      })(),
      { type: 'ADD_WARMUP_RAMP', payload: { workingWeight: 62.5 } }
    );

    const sets = state.exercises[0]!.sets!;
    // 62.5 → 40%=25 · 60%=37.5 · 80%=50 — all valid 2.5 multiples, unique.
    expect(sets.filter((x) => x.isWarmup).map((x) => x.weight)).toEqual([25, 37.5, 50]);
  });

  it('is a no-op when the exercise already has warmups', () => {
    const withWarm = structuredClone(baseState);
    const warm = mkSet(1, 40, 8);
    (warm as { isWarmup: boolean }).isWarmup = true;
    withWarm.exercises[0]!.sets!.unshift(warm as never);

    const state = apply(withWarm, {
      type: 'ADD_WARMUP_RAMP',
      payload: { workingWeight: 100 },
    });
    expect(state.exercises[0]!.sets!.length).toBe(3);
  });

  it('does nothing for light weights (<20kg)', () => {
    const light = structuredClone(baseState);
    light.exercises[0]!.sets = [mkSet(1, 15, 12)];

    const state = apply(light, {
      type: 'ADD_WARMUP_RAMP',
      payload: { workingWeight: 15 },
    });
    expect(state.exercises[0]!.sets!.length).toBe(1);
  });
});

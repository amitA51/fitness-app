import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getWorkoutSessions } from '../../../../services/dataService';
import { calculateProgression } from '../../../../services/progressionService';
import type { WorkoutSession } from '../../../../types';
import { clearPreviousDataCache, usePreviousData } from '../usePreviousData';
import {
  parseRepRangeTop,
  toProgressionSuggestion,
  useProgressionSuggestion,
} from '../useProgressionSuggestion';

vi.mock('../../../../services/dataService', () => ({
  getWorkoutSessions: vi.fn(),
}));

const mockedGetSessions = vi.mocked(getWorkoutSessions);

let uid = 0;
// Saved the way the live workout saves: a fresh random exercise id every time.
const session = (
  date: string,
  name: string,
  sets: { weight: number; reps: number; rpe?: number }[]
): WorkoutSession => {
  uid += 1;
  return {
    id: `s-${uid}`,
    date,
    startTime: `${date}T10:00:00.000Z`,
    endTime: `${date}T11:00:00.000Z`,
    exercises: [
      {
        id: `ex-${uid}`,
        exerciseId: `ex-${uid}`,
        exerciseName: name,
        targetMuscle: 'Other',
        sets: sets.map((s, i) => ({
          id: `set-${uid}-${i}`,
          setNumber: i + 1,
          reps: s.reps,
          weight: s.weight,
          rpe: s.rpe ?? null,
          isWarmup: false,
          isCompleted: true,
          notes: '',
          completedAt: `${date}T10:0${i}:00.000Z`,
        })),
        notes: '',
        restSeconds: 90,
        isCompleted: true,
        order: 0,
      },
    ],
    duration: 3600,
    status: 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume: 0,
    caloriesBurned: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T11:00:00.000Z`,
  };
};

const sets = (weight: number, reps: number[], rpe?: number) =>
  reps.map((r) => ({ weight, reps: r, rpe }));

const verdict = (
  name: string,
  history: WorkoutSession[],
  extra: { equipment?: string; prescribedReps?: number } = {}
) =>
  calculateProgression({
    exerciseId: '',
    exerciseName: name,
    targetReps: 8,
    targetSets: 3,
    sessions: history,
    ...extra,
  });

describe('parseRepRangeTop', () => {
  it.each([
    ['8-10', 10],
    ['~6–8', 8],
    ['12', 12],
    ['8 - 12', 12],
    ['AMRAP', null],
    ['', null],
    [undefined, null],
  ])('%s → %s', (range, top) => {
    expect(parseRepRangeTop(range)).toBe(top);
  });
});

describe('toProgressionSuggestion', () => {
  it('stays away for a new exercise (fewer than two sessions)', () => {
    const one = verdict('Row', [session('2026-09-01', 'Row', sets(50, [10, 10, 10]))]);
    expect(toProgressionSuggestion(one)).toBeNull();
  });

  it('stays away for a plain hold with no evidence behind it', () => {
    const pyramid = [
      { weight: 50, reps: 12 },
      { weight: 60, reps: 10 },
      { weight: 70, reps: 8 },
    ];
    const hold = verdict('Row', [
      session('2026-09-01', 'Row', pyramid),
      session('2026-09-04', 'Row', pyramid),
    ]);
    expect(hold.reasons[0]?.code).toBe('GENERAL_MAINTAIN');
    expect(toProgressionSuggestion(hold)).toBeNull();
  });

  it('an increase fills the new load only', () => {
    const chip = toProgressionSuggestion(
      verdict(
        'Bench Press',
        [
          session('2026-09-01', 'Bench Press', sets(60, [8, 8, 8])),
          session('2026-09-04', 'Bench Press', sets(60, [8, 8, 8])),
        ],
        { equipment: 'barbell' }
      )
    );
    expect(chip).toMatchObject({ kind: 'increase', weight: 62.5, reps: null, value: '62.5 ק״ג' });
    expect(chip?.reason).toBe('8 חזרות בכל הסטים: הזמן לעלות במשקל');
    expect(chip?.ariaLabel).toContain('להעלות ל-62.5 ק״ג');
  });

  it('a hold waiting on reps keeps the load and fills the rep target', () => {
    const chip = toProgressionSuggestion(
      verdict(
        'Bench Press',
        [
          session('2026-09-01', 'Bench Press', sets(60, [8, 8, 8])),
          session('2026-09-04', 'Bench Press', sets(62.5, [8, 7, 6])),
        ],
        { equipment: 'barbell' }
      )
    );
    expect(chip).toMatchObject({ kind: 'hold', weight: 62.5, reps: 8, value: '62.5 ק״ג' });
    expect(chip?.reason).toContain('קודם 8 חזרות');
  });

  it('a bodyweight movement is suggested in reps, never in kg', () => {
    const chip = toProgressionSuggestion(
      verdict(
        'Push-up',
        [
          session('2026-09-01', 'Push-up', sets(0, [15, 15, 14])),
          session('2026-09-04', 'Push-up', sets(0, [15, 15, 15])),
        ],
        { equipment: 'bodyweight' }
      )
    );
    expect(chip).toMatchObject({ kind: 'increase', weight: null, reps: 16, value: '16 חזרות' });
  });

  it('a back-off is a decrease to a loadable weight', () => {
    const chip = toProgressionSuggestion(
      verdict(
        'Bench Press',
        [
          session('2026-09-01', 'Bench Press', sets(80, [5, 5, 5], 8)),
          session('2026-09-04', 'Bench Press', sets(80, [5, 4, 3], 10)),
        ],
        { equipment: 'barbell' }
      )
    );
    expect(chip).toMatchObject({ kind: 'decrease', weight: 72.5, value: '72.5 ק״ג' });
    expect(chip?.ariaLabel).toContain('להוריד ל-72.5 ק״ג');
  });
});

describe('useProgressionSuggestion', () => {
  beforeEach(() => {
    clearPreviousDataCache();
    mockedGetSessions.mockReset();
  });

  it('reads the recent sessions and returns the chip for the exercise on screen', async () => {
    mockedGetSessions.mockResolvedValue([
      session('2026-09-01', 'Goblet Squat', sets(20, [10, 10, 10])),
      session('2026-09-04', 'Goblet Squat', sets(20, [10, 10, 10])),
    ]);
    const { result } = renderHook(() =>
      useProgressionSuggestion({
        exerciseName: 'Goblet Squat',
        equipment: 'dumbbell',
        repRange: undefined,
        workingSets: 3,
      })
    );
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toMatchObject({ kind: 'increase', weight: 22 });
  });

  it('shares ONE read with the "last time" strip when both open an exercise together', async () => {
    mockedGetSessions.mockResolvedValue([
      session('2026-09-01', 'Row', sets(50, [10, 10, 10])),
      session('2026-09-04', 'Row', sets(50, [10, 10, 10])),
    ]);
    const { result } = renderHook(() => ({
      previous: usePreviousData('Row'),
      chip: useProgressionSuggestion({
        exerciseName: 'Row',
        equipment: 'cable',
        repRange: undefined,
        workingSets: 3,
      }),
    }));
    await waitFor(() => expect(result.current.chip).not.toBeNull());
    await waitFor(() => expect(result.current.previous.previousSets).not.toBeNull());
    expect(mockedGetSessions).toHaveBeenCalledTimes(1);
    expect(result.current.chip?.weight).toBe(52.5);
  });

  it('honours a program rep range as the bar', async () => {
    mockedGetSessions.mockResolvedValue([
      session('2026-09-01', 'Row', sets(50, [10, 10, 10])),
      session('2026-09-04', 'Row', sets(50, [10, 10, 10])),
    ]);
    const { result } = renderHook(() =>
      useProgressionSuggestion({
        exerciseName: 'Row',
        equipment: 'cable',
        repRange: '10-12',
        workingSets: 3,
      })
    );
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toMatchObject({ kind: 'hold', weight: 50, reps: 12 });
  });

  it('stays null when the read fails', async () => {
    mockedGetSessions.mockRejectedValue(new Error('idb down'));
    const { result } = renderHook(() =>
      useProgressionSuggestion({
        exerciseName: 'Row',
        equipment: 'cable',
        repRange: undefined,
        workingSets: 3,
      })
    );
    await waitFor(() => expect(mockedGetSessions).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});

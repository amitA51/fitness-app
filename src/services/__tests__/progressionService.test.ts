import { describe, expect, it } from 'vitest';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../types';
import {
  type SessionSnapshot,
  calculateProgression,
  calculateRPEDelta,
  getExerciseSnapshot,
  getLoadingProfile,
  snapToGrid,
} from '../progressionService';

const completedSet = (
  id: string,
  weight: number,
  reps: number,
  rpe: number,
  setNumber: number
): WorkoutSet => ({
  id,
  setNumber,
  reps,
  weight,
  rpe,
  isWarmup: false,
  isCompleted: true,
  notes: '',
  completedAt: '2026-04-20T10:00:00.000Z',
});

const sessionForExercise = (
  id: string,
  date: string,
  weight: number,
  reps: number,
  rpe: number
): WorkoutSession => {
  const exercise: WorkoutExercise = {
    id: `workout-${id}`,
    exerciseId: 'bench',
    exerciseName: 'Bench Press',
    targetMuscle: 'Chest',
    sets: [
      completedSet(`${id}-1`, weight, reps, rpe, 1),
      completedSet(`${id}-2`, weight, reps, rpe, 2),
      completedSet(`${id}-3`, weight, reps, rpe, 3),
    ],
    notes: '',
    restSeconds: 120,
    isCompleted: true,
    order: 0,
  };

  return {
    id,
    date,
    startTime: `${date}T10:00:00.000Z`,
    endTime: `${date}T11:00:00.000Z`,
    exercises: [exercise],
    duration: 3600,
    status: 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume: weight * reps * 3,
    caloriesBurned: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T11:00:00.000Z`,
  };
};

const easyCompletedHistory = [
  sessionForExercise('s3', '2026-04-19', 80, 8, 6),
  sessionForExercise('s2', '2026-04-12', 80, 8, 6),
  sessionForExercise('s1', '2026-04-05', 80, 8, 6),
];

describe('calculateProgression recovery readiness', () => {
  it('keeps the existing progression behavior when recovery is not supplied', () => {
    const result = calculateProgression({
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      targetReps: 8,
      targetSets: 3,
      sessions: easyCompletedHistory,
    });

    expect(result.recommendation).toBe('INCREASE_WEIGHT');
    expect(result.suggestedWeight).toBeGreaterThan(result.currentWeight);
  });

  it('turns an increase recommendation into a deload when recovery is poor', () => {
    const result = calculateProgression({
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      targetReps: 8,
      targetSets: 3,
      sessions: easyCompletedHistory,
      recoveryScore: 32,
    });

    expect(result.recommendation).toBe('DELOAD');
    expect(result.suggestedWeight).toBeLessThan(result.currentWeight);
    expect(result.reasons[0]?.code).toBe('LOW_RECOVERY');
  });

  it('caps progression at maintain when recovery is only fair', () => {
    const result = calculateProgression({
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      targetReps: 8,
      targetSets: 3,
      sessions: easyCompletedHistory,
      recoveryScore: 55,
    });

    expect(result.recommendation).toBe('MAINTAIN');
    expect(result.suggestedWeight).toBe(result.currentWeight);
    expect(result.reasons.some((reason) => reason.code === 'FAIR_RECOVERY')).toBe(true);
  });

  it('turns an increase recommendation into a deload when fatigue is high', () => {
    const result = calculateProgression({
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      targetReps: 8,
      targetSets: 3,
      sessions: easyCompletedHistory,
      fatigueScore: 72,
    });

    expect(result.recommendation).toBe('DELOAD');
    expect(result.suggestedWeight).toBeLessThan(result.currentWeight);
    expect(result.reasons[0]?.code).toBe('HIGH_TRAINING_LOAD');
  });

  it('caps progression at maintain when fatigue is elevated but not deload-level', () => {
    const result = calculateProgression({
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      targetReps: 8,
      targetSets: 3,
      sessions: easyCompletedHistory,
      fatigueScore: 46,
    });

    expect(result.recommendation).toBe('MAINTAIN');
    expect(result.suggestedWeight).toBe(result.currentWeight);
    expect(result.reasons.some((reason) => reason.code === 'ELEVATED_TRAINING_LOAD')).toBe(true);
  });
});

describe('calculateRPEDelta', () => {
  const snap = (rpe: number | null): SessionSnapshot => ({
    date: '2026-04-01',
    weight: 80,
    reps: 24,
    volume: 1920,
    rpe,
    setsCompleted: 3,
    setsTarget: 3,
    wasCompleted: true,
  });

  it('returns the full delta for two data points (no index overlap)', () => {
    // Previously [6, 9] gave 1.5 because index 0 fell into both halves.
    expect(calculateRPEDelta([snap(6), snap(9)])).toBe(3);
  });

  it('splits three points into non-overlapping halves', () => {
    // older = [6], recent = [7, 9] -> 8 - 6 = 2
    expect(calculateRPEDelta([snap(6), snap(7), snap(9)])).toBe(2);
  });

  it('ignores null RPEs and needs at least two numeric values', () => {
    expect(calculateRPEDelta([snap(null), snap(6), snap(null), snap(9)])).toBe(3);
    expect(calculateRPEDelta([snap(7)])).toBeNull();
    expect(calculateRPEDelta([snap(null), snap(null)])).toBeNull();
  });
});

describe('calculateExerciseVolume via calculateProgression', () => {
  it('excludes a completed warmup set and returns only working volume', () => {
    const warmupSet: WorkoutSet = {
      id: 'w1',
      setNumber: 1,
      reps: 10,
      weight: 40,
      rpe: null,
      isWarmup: true,
      isCompleted: true,
      notes: '',
      completedAt: '2026-04-20T10:00:00.000Z',
    };
    const workingSet: WorkoutSet = {
      id: 'w2',
      setNumber: 2,
      reps: 8,
      weight: 80,
      rpe: 7,
      isWarmup: false,
      isCompleted: true,
      notes: '',
      completedAt: '2026-04-20T10:01:00.000Z',
    };

    const session: WorkoutSession = {
      id: 'vol-test',
      date: '2026-04-20',
      startTime: '2026-04-20T10:00:00.000Z',
      endTime: '2026-04-20T11:00:00.000Z',
      exercises: [
        {
          id: 'ex1',
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          targetMuscle: 'Chest',
          sets: [warmupSet, workingSet],
          notes: '',
          restSeconds: 120,
          isCompleted: true,
          order: 0,
        },
      ],
      duration: 3600,
      status: 'completed',
      templateId: null,
      notes: '',
      rating: null,
      totalVolume: 640,
      caloriesBurned: null,
      createdAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-20T11:00:00.000Z',
    };

    const result = calculateProgression({
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      targetReps: 8,
      targetSets: 1,
      sessions: [session],
    });

    // Volume should be 80*8 = 640 (working set only), not 80*8 + 40*10 = 1040
    expect(result.lastSession?.volume).toBe(640);
  });
});

describe('getExerciseSnapshot wasCompleted via getExerciseSnapshot', () => {
  it('returns wasCompleted=false for an exercise whose sets are all warmups', () => {
    const warmupSet1: WorkoutSet = {
      id: 'wu1',
      setNumber: 1,
      reps: 10,
      weight: 30,
      rpe: null,
      isWarmup: true,
      isCompleted: true,
      notes: '',
      completedAt: '2026-04-20T10:00:00.000Z',
    };
    const warmupSet2: WorkoutSet = {
      id: 'wu2',
      setNumber: 2,
      reps: 10,
      weight: 40,
      rpe: null,
      isWarmup: true,
      isCompleted: true,
      notes: '',
      completedAt: '2026-04-20T10:01:00.000Z',
    };

    const session: WorkoutSession = {
      id: 'warmup-only',
      date: '2026-04-20',
      startTime: '2026-04-20T10:00:00.000Z',
      endTime: '2026-04-20T11:00:00.000Z',
      exercises: [
        {
          id: 'ex-warmup',
          exerciseId: 'warmup-ex',
          exerciseName: 'Warmup Exercise',
          targetMuscle: 'Full Body',
          sets: [warmupSet1, warmupSet2],
          notes: '',
          restSeconds: 60,
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
      createdAt: '2026-04-20T10:00:00.000Z',
      updatedAt: '2026-04-20T11:00:00.000Z',
    };

    const snapshot = getExerciseSnapshot(session, 'warmup-ex');

    expect(snapshot).not.toBeNull();
    expect(snapshot?.wasCompleted).toBe(false);
  });
});

describe('getExerciseSnapshot wasCompleted with zero completed working sets', () => {
  it('returns wasCompleted=false when exercise.isCompleted is true but no working sets are completed', () => {
    const incompleteSets: WorkoutSet[] = [
      {
        id: 's1',
        setNumber: 1,
        reps: 8,
        weight: 60,
        rpe: null,
        isWarmup: false,
        isCompleted: false,
        notes: '',
        completedAt: undefined as unknown as string,
      },
      {
        id: 's2',
        setNumber: 2,
        reps: 8,
        weight: 60,
        rpe: null,
        isWarmup: false,
        isCompleted: false,
        notes: '',
        completedAt: undefined as unknown as string,
      },
    ];

    const session: WorkoutSession = {
      id: 'zero-completed',
      date: '2026-05-01',
      startTime: '2026-05-01T10:00:00.000Z',
      endTime: '2026-05-01T11:00:00.000Z',
      exercises: [
        {
          id: 'ex-zero',
          exerciseId: 'curl',
          exerciseName: 'Bicep Curl',
          targetMuscle: 'Biceps',
          sets: incompleteSets,
          notes: '',
          restSeconds: 60,
          isCompleted: true, // marked completed despite no sets done
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
      createdAt: '2026-05-01T10:00:00.000Z',
      updatedAt: '2026-05-01T11:00:00.000Z',
    };

    const snapshot = getExerciseSnapshot(session, 'curl');
    expect(snapshot).not.toBeNull();
    expect(snapshot?.wasCompleted).toBe(false);
  });
});

// ============================================================================
// T-129: the engine the set screen now shows
// ============================================================================

interface SetSpec {
  weight: number;
  reps: number;
  rpe?: number | null;
  warmup?: boolean;
}

let uid = 0;
// A saved session exactly as the live workout writes one: the exercise id is a
// fresh random id every workout (WorkoutActions maps exerciseId from the live
// exercise's minted `ex-<uuid>`), and only the sets that were done are kept.
const savedSession = (date: string, name: string, sets: SetSpec[]): WorkoutSession => {
  uid += 1;
  const exerciseId = `ex-random-${uid}`;
  return {
    id: `session-${uid}`,
    date,
    startTime: `${date}T10:00:00.000Z`,
    endTime: `${date}T11:00:00.000Z`,
    exercises: [
      {
        id: exerciseId,
        exerciseId,
        exerciseName: name,
        targetMuscle: 'Other',
        sets: sets.map((s, i) => ({
          id: `${exerciseId}-${i}`,
          setNumber: i + 1,
          reps: s.reps,
          weight: s.weight,
          rpe: s.rpe ?? null,
          isWarmup: !!s.warmup,
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

const straight = (weight: number, reps: number[], rpe: number | null = null): SetSpec[] =>
  reps.map((r) => ({ weight, reps: r, rpe }));

const progress = (
  name: string,
  sessions: WorkoutSession[],
  extra: Partial<Parameters<typeof calculateProgression>[0]> = {}
) =>
  calculateProgression({
    exerciseId: '',
    exerciseName: name,
    targetReps: 8,
    targetSets: 3,
    sessions,
    ...extra,
  });

describe('history identity: live exercise ids are random per workout', () => {
  it('finds history by name, ignoring case and spacing, when every session has a new id', () => {
    const result = progress('לחיצת חזה', [
      savedSession('2026-09-01', 'לחיצת חזה ', straight(60, [8, 8, 8])),
      savedSession('2026-09-04', '  לחיצת  חזה', straight(60, [8, 8, 8])),
    ]);
    expect(result.history).toHaveLength(2);
    expect(result.recommendation).toBe('INCREASE_WEIGHT');
  });

  it('does not borrow another exercise that happens to share the session', () => {
    const result = progress('Squat', [
      savedSession('2026-09-01', 'Bench Press', straight(60, [8, 8, 8])),
      savedSession('2026-09-04', 'Bench Press', straight(60, [8, 8, 8])),
    ]);
    expect(result.history).toHaveLength(0);
    expect(result.reasons[0]?.code).toBe('NEW_EXERCISE');
  });

  it('still matches by id when no name is given (older callers)', () => {
    const session = savedSession('2026-09-01', 'Row', straight(50, [10, 10]));
    const id = session.exercises[0]?.exerciseId ?? '';
    expect(getExerciseSnapshot(session, id)?.weight).toBe(50);
  });
});

describe('rep bar (double progression) when no set was rated', () => {
  it('raises the load once every set at the top weight matched the best set', () => {
    const result = progress(
      'Bench Press',
      [
        savedSession('2026-09-01', 'Bench Press', straight(60, [8, 8, 7])),
        savedSession('2026-09-04', 'Bench Press', straight(60, [8, 8, 8])),
      ],
      { equipment: 'barbell' }
    );
    expect(result.recommendation).toBe('INCREASE_WEIGHT');
    expect(result.suggestedWeight).toBe(62.5);
    expect(result.reasons[0]?.code).toBe('REP_TARGET_MET');
    expect(result.reasons[0]?.short).toContain('8');
  });

  it('holds the load and names the rep target while a set fell short', () => {
    const result = progress(
      'Bench Press',
      [
        savedSession('2026-09-01', 'Bench Press', straight(60, [8, 8, 8])),
        savedSession('2026-09-04', 'Bench Press', straight(62.5, [8, 7, 6])),
      ],
      { equipment: 'barbell' }
    );
    expect(result.recommendation).toBe('MAINTAIN');
    expect(result.suggestedWeight).toBe(62.5);
    expect(result.suggestedReps).toBe(8);
    expect(result.reasons[0]?.code).toBe('REP_TARGET_SHORT');
  });

  it('is not overridden to "increase" by the long-term rule after many sessions', () => {
    const sessions = ['2026-09-01', '2026-09-03', '2026-09-05', '2026-09-08', '2026-09-10'].map(
      (d) => savedSession(d, 'Bench Press', straight(62.5, [8, 7, 6]))
    );
    const result = progress('Bench Press', sessions, { equipment: 'barbell' });
    expect(result.recommendation).toBe('MAINTAIN');
    expect(result.reasons.map((r) => r.code)).not.toContain('CONSISTENT_LONG_TERM');
  });

  it('uses the prescribed top of the range as the bar when a program sets one', () => {
    const history = [
      savedSession('2026-09-01', 'Bench Press', straight(60, [8, 8, 8])),
      savedSession('2026-09-04', 'Bench Press', straight(60, [8, 8, 8])),
    ];
    const short = progress('Bench Press', history, { equipment: 'barbell', prescribedReps: 10 });
    expect(short.recommendation).toBe('MAINTAIN');
    expect(short.suggestedReps).toBe(10);

    const met = progress(
      'Bench Press',
      [
        savedSession('2026-09-01', 'Bench Press', straight(60, [10, 9, 9])),
        savedSession('2026-09-04', 'Bench Press', straight(60, [10, 10, 10])),
      ],
      { equipment: 'barbell', prescribedReps: 10 }
    );
    expect(met.recommendation).toBe('INCREASE_WEIGHT');
  });

  it('says nothing (plain hold) from a single top set with no prescription', () => {
    const pyramid = (d: string) =>
      savedSession(d, 'Bench Press', [
        { weight: 50, reps: 12 },
        { weight: 60, reps: 10 },
        { weight: 70, reps: 8 },
      ]);
    const result = progress('Bench Press', [
      pyramid('2026-09-01'),
      pyramid('2026-09-03'),
      pyramid('2026-09-05'),
      pyramid('2026-09-08'),
    ]);
    expect(result.recommendation).toBe('MAINTAIN');
    expect(result.reasons[0]?.code).toBe('GENERAL_MAINTAIN');
  });
});

describe('loading profiles: the step and the grid follow the implement', () => {
  const metTwice = (name: string, weight: number) => [
    savedSession('2026-09-01', name, straight(weight, [10, 10, 10])),
    savedSession('2026-09-04', name, straight(weight, [10, 10, 10])),
  ];

  it.each([
    ['barbell', 60, 62.5],
    ['dumbbell', 12, 14],
    ['dumbbell', 12.5, 15],
    ['machine', 45, 50],
    ['cable', 17.5, 20],
    ['kettlebell', 16, 20],
    ['plate', 10, 15],
    [undefined, 40, 42.5],
    ['something-custom', 40, 42.5],
  ])('%s at %s kg steps to %s kg', (equipment, weight, expected) => {
    const result = progress('Lift', metTwice('Lift', weight), { equipment });
    expect(result.recommendation).toBe('INCREASE_WEIGHT');
    expect(result.suggestedWeight).toBe(expected);
  });

  it('never suggests added weight on a bodyweight movement: reps go up instead', () => {
    const result = progress(
      'Push-up',
      [
        savedSession('2026-09-01', 'Push-up', straight(0, [12, 12, 11])),
        savedSession('2026-09-04', 'Push-up', straight(0, [12, 12, 12])),
      ],
      { equipment: 'bodyweight' }
    );
    expect(result.history).toHaveLength(2); // unloaded sessions count for reps-only work
    expect(result.recommendation).toBe('INCREASE_REPS');
    expect(result.suggestedWeight).toBe(0);
    expect(result.suggestedReps).toBe(13);
  });

  it('snaps an off-grid barbell load to the next loadable weight', () => {
    const result = progress('Bench Press', metTwice('Bench Press', 71), { equipment: 'barbell' });
    expect(result.suggestedWeight).toBe(72.5);
  });

  it('takes the bigger barbell step only on a clearly easy squat, never on a split squat', () => {
    const easy = (name: string) => [
      savedSession('2026-09-01', name, straight(100, [5, 5, 5], 6)),
      savedSession('2026-09-04', name, straight(100, [5, 5, 5], 6)),
    ];
    expect(
      progress('Back Squat', easy('Back Squat'), { equipment: 'barbell' }).suggestedWeight
    ).toBe(105);
    expect(
      progress('סקוואט אחורי', easy('סקוואט אחורי'), { equipment: 'barbell' }).suggestedWeight
    ).toBe(105);
    expect(
      progress('Bulgarian Split Squat', easy('Bulgarian Split Squat'), { equipment: 'barbell' })
        .suggestedWeight
    ).toBe(102.5);
    expect(
      progress('Bench Press', easy('Bench Press'), { equipment: 'barbell' }).suggestedWeight
    ).toBe(102.5);
  });

  it('exposes the table and the snapping for callers', () => {
    expect(getLoadingProfile('dumbbell')).toMatchObject({ step: 2, grid: 2, repsOnly: false });
    expect(getLoadingProfile('dumbbell', 17.5)).toMatchObject({ step: 2.5, grid: 2.5 });
    expect(getLoadingProfile('BODYWEIGHT').repsOnly).toBe(true);
    expect(getLoadingProfile('').equipment).toBe('');
    expect(snapToGrid(73.4, 2.5, 'nearest')).toBe(72.5);
    expect(snapToGrid(73.4, 2.5, 'up')).toBe(75);
    expect(snapToGrid(73.4, 2.5, 'down')).toBe(72.5);
    expect(snapToGrid(10.8, 2, 'nearest')).toBe(10);
  });
});

describe('backing off', () => {
  it('a hard session costs 10%, not 40%, and lands on a loadable weight', () => {
    const result = progress(
      'Bench Press',
      [
        savedSession('2026-09-01', 'Bench Press', straight(80, [5, 5, 5], 8)),
        savedSession('2026-09-04', 'Bench Press', straight(80, [5, 4, 3], 10)),
      ],
      { equipment: 'barbell' }
    );
    expect(result.recommendation).toBe('DECREASE_WEIGHT');
    expect(result.suggestedWeight).toBe(72.5);
    expect(result.reasons[0]?.code).toBe('HIGH_RPE');
  });

  it('one set rated 10 (the last set, taken to failure) holds the weight, it does not cut it', () => {
    const lastSetToFailure: SetSpec[] = [
      { weight: 80, reps: 5 },
      { weight: 80, reps: 5 },
      { weight: 80, reps: 5, rpe: 10 },
    ];
    const result = progress(
      'Bench Press',
      [
        savedSession('2026-09-01', 'Bench Press', lastSetToFailure),
        savedSession('2026-09-04', 'Bench Press', lastSetToFailure),
      ],
      { equipment: 'barbell' }
    );
    expect(result.recommendation).toBe('MAINTAIN');
    expect(result.suggestedWeight).toBe(80);
    expect(result.reasons[0]?.code).toBe('REP_TARGET_AT_LIMIT');
  });

  it('rising effort holds the weight even after many sessions', () => {
    const rpes = [7, 7, 8, 9, 9];
    const sessions = rpes.map((rpe, i) =>
      savedSession(`2026-09-0${i + 1}`, 'Bench Press', straight(80, [5, 5, 5], rpe))
    );
    const result = progress('Bench Press', sessions, { equipment: 'barbell' });
    expect(result.recommendation).toBe('MAINTAIN');
    expect(result.reasons[0]?.code).toBe('RPE_INCREASING');
  });

  it('a reps-only movement backs off in reps', () => {
    const result = progress(
      'Pull-up',
      [
        savedSession('2026-09-01', 'Pull-up', straight(0, [10, 10, 10], 9)),
        savedSession('2026-09-04', 'Pull-up', straight(0, [10, 9, 8], 10)),
      ],
      { equipment: 'bodyweight' }
    );
    expect(result.recommendation).toBe('DECREASE_WEIGHT');
    expect(result.suggestedWeight).toBe(0);
    expect(result.suggestedReps).toBe(8);
  });
});

describe('INCREASE_REPS keeps the load it asks more reps at', () => {
  it('resets the suggested weight to the current one', () => {
    // Easy (RPE 4) but far below the planned volume: 2 sets of 5 against 4 x 10.
    const result = progress(
      'Bench Press',
      [
        savedSession('2026-09-01', 'Bench Press', straight(60, [5, 5], 4)),
        savedSession('2026-09-04', 'Bench Press', straight(60, [5, 5], 4)),
      ],
      { equipment: 'barbell', targetReps: 10, targetSets: 4 }
    );
    expect(result.recommendation).toBe('INCREASE_REPS');
    expect(result.suggestedWeight).toBe(result.currentWeight);
    expect(result.suggestedReps).toBe(6);
  });
});

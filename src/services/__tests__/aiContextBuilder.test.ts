import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../../types';
import { oneRepMax } from '../../utils/workoutMath';
import { buildContext, buildSystemPrompt } from '../ai/contextBuilder';
import type { RecoveryLog } from '../bodyStatsService';
import { calculateRecoveryScore } from '../bodyStatsService';

const dateDaysAgo = (daysAgo: number): string => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0] ?? '';
};

const session = (id: string, daysAgo: number, totalVolume: number): WorkoutSession => {
  const date = dateDaysAgo(daysAgo);

  return {
    id,
    date,
    startTime: `${date}T10:00:00.000Z`,
    endTime: `${date}T11:00:00.000Z`,
    exercises: [
      {
        id: `${id}-exercise`,
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        targetMuscle: 'Chest',
        muscleGroup: 'Chest',
        sets: [],
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
    totalVolume,
    caloriesBurned: null,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T11:00:00.000Z`,
  };
};

const recoveryLog = (overrides: Partial<RecoveryLog> = {}): RecoveryLog => ({
  id: 'rec-1',
  date: dateDaysAgo(0),
  createdAt: new Date().toISOString(),
  sleepHours: 8,
  sleepQuality: 5,
  sorenessLevel: 5,
  energyLevel: 5,
  stressLevel: 5,
  tightAreas: [],
  notes: '',
  ...overrides,
});

describe('buildContext deterministic fitness math', () => {
  it('uses the canonical recovery score calculation', () => {
    const log = recoveryLog({ stressLevel: 5 });
    const context = buildContext([session('s-1', 1, 1000)], [log]);

    expect(context.recoveryScore).toBe(calculateRecoveryScore(log).overall);
  });

  it('calculates weekly volume change and readiness from workout load', () => {
    const context = buildContext([
      session('this-week-1', 1, 2000),
      session('this-week-2', 2, 2000),
      session('prev-week', 9, 2000),
    ]);

    expect(context.weeklyVolume).toBe(4000);
    expect(context.previousWeeklyVolume).toBe(2000);
    expect(context.volumeChangePercent).toBe(100);
    expect(context.readinessScore).toBeLessThan(80);
    expect(context.primaryConstraint).toBe('load_spike');
  });

  it('puts the deterministic readiness score into the AI system prompt', () => {
    const context = buildContext([session('s-1', 1, 1000)], [recoveryLog()]);
    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain(`ציון מוכנות מתמטי: ${context.readinessScore}/100`);
    expect(prompt).toContain('שינוי נפח שבועי');
  });
});

describe('weakMuscles uses only completed sets volume', () => {
  it('ignores volume from an incomplete set', () => {
    const date = dateDaysAgo(1);
    const sessionWithIncompleteSets: WorkoutSession = {
      id: 'incomplete-test',
      date,
      startTime: `${date}T10:00:00.000Z`,
      endTime: `${date}T11:00:00.000Z`,
      exercises: [
        {
          id: 'ex-chest',
          exerciseId: 'bench',
          exerciseName: 'Bench Press',
          targetMuscle: 'Chest',
          muscleGroup: 'Chest',
          sets: [
            {
              id: 's1',
              setNumber: 1,
              weight: 100,
              reps: 10,
              rpe: null,
              isWarmup: false,
              isCompleted: true,
              notes: '',
              completedAt: `${date}T10:05:00.000Z`,
            },
            {
              id: 's2',
              setNumber: 2,
              weight: 100,
              reps: 10,
              rpe: null,
              isWarmup: false,
              isCompleted: false, // NOT completed — should be ignored
              notes: '',
              completedAt: null,
            },
          ],
          notes: '',
          restSeconds: 120,
          isCompleted: false,
          order: 0,
        },
        {
          id: 'ex-back',
          exerciseId: 'row',
          exerciseName: 'Barbell Row',
          targetMuscle: 'Back',
          muscleGroup: 'Back',
          sets: [
            {
              id: 's3',
              setNumber: 1,
              weight: 100,
              reps: 10,
              rpe: null,
              isWarmup: false,
              isCompleted: true,
              notes: '',
              completedAt: `${date}T10:10:00.000Z`,
            },
            {
              id: 's4',
              setNumber: 2,
              weight: 100,
              reps: 10,
              rpe: null,
              isWarmup: false,
              isCompleted: true,
              notes: '',
              completedAt: `${date}T10:15:00.000Z`,
            },
          ],
          notes: '',
          restSeconds: 120,
          isCompleted: true,
          order: 1,
        },
      ],
      duration: 3600,
      status: 'completed',
      templateId: null,
      notes: '',
      rating: null,
      totalVolume: 4000,
      caloriesBurned: null,
      createdAt: `${date}T10:00:00.000Z`,
      updatedAt: `${date}T11:00:00.000Z`,
    };

    const context = buildContext([sessionWithIncompleteSets]);

    // Chest: only 1 completed set = 100*10 = 1000
    // Back: 2 completed sets = 100*10*2 = 2000
    // Average = 1500, threshold = 1500 * 0.75 = 1125
    // Chest (1000) < 1125 => weak
    expect(context.weakMuscles).toContain('Chest');
    expect(context.weakMuscles).not.toContain('Back');
  });
});

describe('topExercises enrichment', () => {
  const sessionWithSets = (
    id: string,
    daysAgo: number,
    exerciseName: string,
    exerciseId: string,
    sets: Array<{ weight: number; reps: number; isCompleted: boolean }>
  ): WorkoutSession => {
    const date = dateDaysAgo(daysAgo);
    return {
      id,
      date,
      startTime: `${date}T10:00:00.000Z`,
      endTime: `${date}T11:00:00.000Z`,
      exercises: [
        {
          id: `${id}-ex`,
          exerciseId,
          exerciseName,
          targetMuscle: 'Chest',
          muscleGroup: 'Chest',
          sets: sets.map((s, i) => ({
            id: `${id}-set-${i}`,
            setNumber: i + 1,
            weight: s.weight,
            reps: s.reps,
            rpe: null,
            isWarmup: false,
            isCompleted: s.isCompleted,
            notes: '',
            completedAt: s.isCompleted ? `${date}T10:0${i}:00.000Z` : null,
          })),
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
      totalVolume: 0,
      caloriesBurned: null,
      createdAt: `${date}T10:00:00.000Z`,
      updatedAt: `${date}T11:00:00.000Z`,
    };
  };

  it('currentEst1RM equals oneRepMax of the best completed working set', () => {
    const sessions = [
      sessionWithSets('s1', 1, 'Bench Press', 'bench', [
        { weight: 100, reps: 5, isCompleted: true },
        { weight: 90, reps: 8, isCompleted: true },
        { weight: 110, reps: 3, isCompleted: false }, // not completed — ignored
      ]),
    ];

    const context = buildContext(sessions);
    const benchEntry = context.topExercises?.find((e) => e.exerciseName === 'Bench Press');

    // Best completed set: 100x5 => oneRepMax(100, 5) or 90x8 => oneRepMax(90, 8)
    const expected = Math.max(oneRepMax(100, 5), oneRepMax(90, 8));
    expect(benchEntry).toBeDefined();
    expect(benchEntry!.currentEst1RM).toBe(expected);
  });

  it('buildSystemPrompt output contains the exercise name and its 1RM value', () => {
    const sessions = [
      sessionWithSets('s1', 1, 'Bench Press', 'bench', [
        { weight: 100, reps: 5, isCompleted: true },
      ]),
    ];

    const context = buildContext(sessions);
    const prompt = buildSystemPrompt(context);
    const benchEntry = context.topExercises?.find((e) => e.exerciseName === 'Bench Press');

    expect(prompt).toContain('Bench Press');
    expect(prompt).toContain(`1RM=${benchEntry!.currentEst1RM}`);
  });

  it('computes progressPercent between earliest and best 1RM', () => {
    const sessions = [
      // Most recent (index 0) — heavier
      sessionWithSets('s2', 1, 'Bench Press', 'bench', [
        { weight: 110, reps: 5, isCompleted: true },
      ]),
      // Older (index 1) — lighter
      sessionWithSets('s1', 7, 'Bench Press', 'bench', [
        { weight: 100, reps: 5, isCompleted: true },
      ]),
    ];

    const context = buildContext(sessions);
    const benchEntry = context.topExercises?.find((e) => e.exerciseName === 'Bench Press');

    const best1RM = oneRepMax(110, 5);
    const earliest1RM = oneRepMax(100, 5);
    const expectedProgress = Math.round(((best1RM - earliest1RM) / earliest1RM) * 100);

    expect(benchEntry!.progressPercent).toBe(expectedProgress);
  });
});

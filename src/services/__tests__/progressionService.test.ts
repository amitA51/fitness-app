import { describe, expect, it } from 'vitest';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../types';
import {
  type SessionSnapshot,
  calculateProgression,
  calculateRPEDelta,
  getExerciseSnapshot,
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

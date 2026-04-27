import { describe, expect, it } from 'vitest';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../types';
import { calculateProgression } from '../progressionService';

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

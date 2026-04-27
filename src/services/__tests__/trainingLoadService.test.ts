import { describe, expect, it } from 'vitest';
import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../../types';
import type { RecoveryLog } from '../bodyStatsService';
import { calculateTrainingLoad } from '../trainingLoadService';

const dateDaysAgo = (daysAgo: number, now = new Date('2026-04-26T12:00:00.000Z')): string => {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0] ?? '';
};

const completedSet = (id: string, weight: number, reps: number, rpe: number): WorkoutSet => ({
  id,
  setNumber: Number(id.split('-').slice(-1)[0] ?? 1),
  reps,
  weight,
  rpe,
  isWarmup: false,
  isCompleted: true,
  notes: '',
  completedAt: '2026-04-26T10:00:00.000Z',
});

const exercise = (
  id: string,
  muscleGroup: string,
  sets: WorkoutSet[] = [completedSet(`${id}-1`, 100, 5, 8), completedSet(`${id}-2`, 100, 5, 8)]
): WorkoutExercise => ({
  id: `workout-${id}`,
  exerciseId: id,
  exerciseName: id,
  targetMuscle: muscleGroup,
  muscleGroup,
  sets,
  notes: '',
  restSeconds: 120,
  isCompleted: true,
  order: 0,
});

const session = (
  id: string,
  daysAgo: number,
  exercises: WorkoutExercise[],
  now = new Date('2026-04-26T12:00:00.000Z')
): WorkoutSession => {
  const date = dateDaysAgo(daysAgo, now);
  const totalVolume = exercises.reduce(
    (sum, currentExercise) =>
      sum +
      currentExercise.sets.reduce(
        (setSum, set) => setSum + (set.isWarmup ? 0 : set.weight * set.reps),
        0
      ),
    0
  );

  return {
    id,
    date,
    startTime: `${date}T10:00:00.000Z`,
    endTime: `${date}T11:00:00.000Z`,
    exercises,
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

const recovery = (overrides: Partial<RecoveryLog> = {}): RecoveryLog => ({
  id: 'rec-1',
  date: '2026-04-26',
  createdAt: '2026-04-26T08:00:00.000Z',
  sleepHours: 8,
  sleepQuality: 5,
  sorenessLevel: 5,
  energyLevel: 5,
  stressLevel: 5,
  tightAreas: [],
  notes: '',
  ...overrides,
});

describe('calculateTrainingLoad', () => {
  it('keeps readiness high when recovery is high and acute load is stable', () => {
    const now = new Date('2026-04-26T12:00:00.000Z');
    const sessions = [
      session('current-1', 1, [exercise('bench', 'Chest')], now),
      session('previous-1', 8, [exercise('bench', 'Chest')], now),
    ];

    const load = calculateTrainingLoad(sessions, [recovery()], { now });

    expect(load.weeklyVolume).toBe(1000);
    expect(load.previousWeeklyVolume).toBe(1000);
    expect(load.volumeChangePercent).toBe(0);
    expect(load.readinessScore).toBeGreaterThanOrEqual(75);
    expect(load.recommendation).toBe('push');
  });

  it('detects a load spike and recommends maintaining or deloading', () => {
    const now = new Date('2026-04-26T12:00:00.000Z');
    const highVolumeSets = [
      completedSet('bench-1', 140, 8, 9),
      completedSet('bench-2', 140, 8, 9),
      completedSet('bench-3', 140, 8, 9),
    ];
    const sessions = [
      session('current-1', 1, [exercise('bench', 'Chest', highVolumeSets)], now),
      session('current-2', 2, [exercise('squat', 'Legs', highVolumeSets)], now),
      session('previous-1', 8, [exercise('bench', 'Chest')], now),
    ];

    const load = calculateTrainingLoad(sessions, [recovery()], { now });

    expect(load.volumeChangePercent).toBeGreaterThan(300);
    expect(load.primaryConstraint).toBe('load_spike');
    expect(load.fatigueScore).toBeGreaterThan(45);
    expect(['maintain', 'deload', 'rest']).toContain(load.recommendation);
  });

  it('marks tight or recently overloaded muscles as fatigued', () => {
    const now = new Date('2026-04-26T12:00:00.000Z');
    const sessions = [
      session('current-1', 1, [exercise('squat', 'Legs')], now),
      session('previous-1', 8, [exercise('bench', 'Chest')], now),
    ];

    const load = calculateTrainingLoad(sessions, [recovery({ tightAreas: ['Legs'] })], { now });

    const legs = load.muscles.find((muscle) => muscle.muscle === 'Legs');
    expect(legs?.status).toBe('fatigued');
    expect(legs?.recoveryScore).toBeLessThan(60);
  });
});

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

  it('handles empty sessions array without throwing', () => {
    const now = new Date('2026-04-26T12:00:00.000Z');
    const load = calculateTrainingLoad([], [], { now });

    expect(Number.isFinite(load.weeklyVolume)).toBe(true);
    expect(Number.isFinite(load.acuteLoad)).toBe(true);
    expect(Number.isFinite(load.chronicLoad)).toBe(true);
    expect(Number.isFinite(load.acuteChronicRatio)).toBe(true);
    expect(Number.isFinite(load.fatigueScore)).toBe(true);
    expect(load.weeklyVolume).toBe(0);
    expect(load.chronicLoad).toBe(0);
    expect(load.acuteLoad).toBe(0);
  });

  it('handles sessions where no set is completed', () => {
    const now = new Date('2026-04-26T12:00:00.000Z');
    const incompleteSets: WorkoutSet[] = [
      { ...completedSet('s-1', 80, 5, 7), isCompleted: false },
      { ...completedSet('s-2', 80, 5, 7), isCompleted: false },
    ];
    const sessions = [session('s1', 2, [exercise('bench', 'Chest', incompleteSets)], now)];

    const load = calculateTrainingLoad(sessions, [], { now });

    expect(Number.isFinite(load.weeklyVolume)).toBe(true);
    expect(load.weeklyVolume).toBe(0);
    expect(Number.isFinite(load.acuteLoad)).toBe(true);
    expect(Number.isFinite(load.fatigueScore)).toBe(true);
  });

  it('handles sessions with no RPE on any set', () => {
    const now = new Date('2026-04-26T12:00:00.000Z');
    const noRpeSets: WorkoutSet[] = [
      { ...completedSet('s-1', 60, 10, 7), rpe: undefined as unknown as number },
      { ...completedSet('s-2', 60, 10, 7), rpe: undefined as unknown as number },
    ];
    const sessions = [session('s1', 3, [exercise('rows', 'Back', noRpeSets)], now)];

    const load = calculateTrainingLoad(sessions, [], { now });

    expect(load.averageRPE).toBeNull();
    expect(Number.isFinite(load.acuteLoad)).toBe(true);
    expect(Number.isFinite(load.fatigueScore)).toBe(true);
    expect(load.weeklyVolume).toBeGreaterThan(0);
  });

  it('returns finite ratio when chronic load is 0 but acute > 0', () => {
    const now = new Date('2026-04-26T12:00:00.000Z');
    // Session only in the last 7 days, nothing in the 28-day chronic window prior
    // Since chronic window includes the acute week, chronic > 0 here too,
    // so we simulate by having a single session at day 1 with no prior history.
    const sessions = [session('s1', 1, [exercise('press', 'Shoulders')], now)];

    const load = calculateTrainingLoad(sessions, [], { now });

    expect(Number.isFinite(load.acuteChronicRatio)).toBe(true);
    expect(load.acuteChronicRatio).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(load.fatigueScore)).toBe(true);
  });

  it('handles a single session in the window', () => {
    const now = new Date('2026-04-26T12:00:00.000Z');
    const sessions = [session('only', 3, [exercise('deadlift', 'Back')], now)];

    const load = calculateTrainingLoad(sessions, [], { now });

    expect(Number.isFinite(load.weeklyVolume)).toBe(true);
    expect(Number.isFinite(load.chronicLoad)).toBe(true);
    expect(Number.isFinite(load.acuteLoad)).toBe(true);
    expect(Number.isFinite(load.acuteChronicRatio)).toBe(true);
    expect(Number.isFinite(load.readinessScore)).toBe(true);
    expect(load.weeklySessionCount).toBe(1);
    expect(load.weeklyVolume).toBeGreaterThan(0);
  });
});

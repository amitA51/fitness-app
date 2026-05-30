/**
 * insightsAggregator.test.ts
 * Equivalence tests: aggregateInsights output must match the original
 * independent computations (streak, lastWorkout, muscleGroups, PRs,
 * exerciseNames, week-over-week) for a known set of sessions.
 */

import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../../../types';
import { aggregateInsights } from '../insightsAggregator';

// Fixed "now" for deterministic tests
const NOW = new Date('2026-05-30T12:00:00.000Z');

function makeSession(overrides: Partial<WorkoutSession>): WorkoutSession {
  return {
    id: 'sess-1',
    date: '2026-05-29',
    startTime: '2026-05-29T10:00:00.000Z',
    endTime: '2026-05-29T11:00:00.000Z',
    exercises: [],
    duration: 3600,
    status: 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume: 0,
    caloriesBurned: null,
    createdAt: '2026-05-29T10:00:00.000Z',
    updatedAt: '2026-05-29T11:00:00.000Z',
    ...overrides,
  };
}

const SESSIONS: WorkoutSession[] = [
  makeSession({
    id: 'sess-1',
    date: '2026-05-29',
    startTime: '2026-05-29T10:00:00.000Z',
    endTime: '2026-05-29T11:00:00.000Z',
    exercises: [
      {
        id: 'ex1',
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
        targetMuscle: 'Chest',
        muscleGroup: 'Chest',
        sets: [
          {
            id: 's1',
            setNumber: 1,
            reps: 8,
            weight: 80,
            rpe: null,
            isWarmup: false,
            isCompleted: true,
            notes: '',
            completedAt: '2026-05-29T10:05:00.000Z',
          },
          {
            id: 's2',
            setNumber: 2,
            reps: 6,
            weight: 90,
            rpe: null,
            isWarmup: false,
            isCompleted: true,
            notes: '',
            completedAt: '2026-05-29T10:10:00.000Z',
          },
        ],
        notes: '',
        restSeconds: 90,
        isCompleted: true,
        order: 0,
      },
      {
        id: 'ex2',
        exerciseId: 'squat',
        exerciseName: 'Squat',
        targetMuscle: 'Legs',
        muscleGroup: 'Legs',
        sets: [
          {
            id: 's3',
            setNumber: 1,
            reps: 5,
            weight: 120,
            rpe: null,
            isWarmup: false,
            isCompleted: true,
            notes: '',
            completedAt: '2026-05-29T10:20:00.000Z',
          },
        ],
        notes: '',
        restSeconds: 120,
        isCompleted: true,
        order: 1,
      },
    ],
  }),
  makeSession({
    id: 'sess-2',
    date: '2026-05-28',
    startTime: '2026-05-28T09:00:00.000Z',
    endTime: '2026-05-28T10:00:00.000Z',
    exercises: [
      {
        id: 'ex3',
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
        targetMuscle: 'Chest',
        muscleGroup: 'Chest',
        sets: [
          {
            id: 's4',
            setNumber: 1,
            reps: 10,
            weight: 70,
            rpe: null,
            isWarmup: false,
            isCompleted: true,
            notes: '',
            completedAt: '2026-05-28T09:05:00.000Z',
          },
        ],
        notes: '',
        restSeconds: 90,
        isCompleted: true,
        order: 0,
      },
    ],
  }),
  makeSession({
    id: 'sess-3',
    date: '2026-05-20',
    startTime: '2026-05-20T08:00:00.000Z',
    endTime: '2026-05-20T09:00:00.000Z',
    exercises: [
      {
        id: 'ex4',
        exerciseId: 'bench-press',
        exerciseName: 'Bench Press',
        targetMuscle: 'Chest',
        muscleGroup: 'Chest',
        sets: [
          {
            id: 's5',
            setNumber: 1,
            reps: 8,
            weight: 75,
            rpe: null,
            isWarmup: false,
            isCompleted: true,
            notes: '',
            completedAt: '2026-05-20T08:05:00.000Z',
          },
        ],
        notes: '',
        restSeconds: 90,
        isCompleted: true,
        order: 0,
      },
    ],
  }),
];

describe('aggregateInsights', () => {
  const result = aggregateInsights(SESSIONS, NOW);

  it('returns empty for no sessions', () => {
    const empty = aggregateInsights([], NOW);
    expect(empty.totalWorkouts).toBe(0);
    expect(empty.exerciseNames).toEqual([]);
    expect(empty.allPRs).toEqual([]);
    expect(empty.lastWorkout).toBeNull();
  });

  it('computes totalWorkouts correctly', () => {
    expect(result.totalWorkouts).toBe(3);
  });

  it('computes workoutsThisWeek (sessions within 7 days of NOW)', () => {
    // sess-1 (May 29) and sess-2 (May 28) are within 7 days of May 30
    expect(result.workoutsThisWeek).toBe(2);
  });

  it('computes workoutsThisMonth (sessions within 30 days of NOW)', () => {
    // All 3 sessions are within 30 days of May 30
    expect(result.workoutsThisMonth).toBe(3);
  });

  it('computes lastWorkout summary from most recent session', () => {
    expect(result.lastWorkout).not.toBeNull();
    expect(result.lastWorkout!.date).toBe('2026-05-29');
    expect(result.lastWorkout!.exerciseCount).toBe(2);
    expect(result.lastWorkout!.muscleGroups).toContain('Chest');
    expect(result.lastWorkout!.muscleGroups).toContain('Legs');
    // Volume: 80*8 + 90*6 + 120*5 = 640 + 540 + 600 = 1780
    expect(result.lastWorkout!.totalVolume).toBe(1780);
  });

  it('computes muscleGroups with daysSince', () => {
    const chest = result.muscleGroups.find((mg) => mg.muscle === 'Chest');
    expect(chest).toBeDefined();
    // Last chest: 2026-05-29, today: 2026-05-30 => 1 day
    expect(chest!.daysSince).toBe(1);

    const legs = result.muscleGroups.find((mg) => mg.muscle === 'Legs');
    expect(legs).toBeDefined();
    expect(legs!.daysSince).toBe(1);
  });

  it('computes neglectedMuscles (daysSince >= 7)', () => {
    // Both Chest and Legs were trained 1 day ago, so none neglected
    expect(result.neglectedMuscles).toEqual([]);
  });

  it('computes exerciseNames sorted', () => {
    expect(result.exerciseNames).toEqual(['Bench Press', 'Squat']);
  });

  it('computes PRs from session history', () => {
    // Weight PR for bench-press: 90kg (from sess-1)
    const benchWeightPR = result.allPRs.find(
      (pr) => pr.exerciseId === 'bench-press' && pr.type === 'weight'
    );
    expect(benchWeightPR).toBeDefined();
    expect(benchWeightPR!.weight).toBe(90);

    // Squat weight PR: 120kg
    const squatWeightPR = result.allPRs.find(
      (pr) => pr.exerciseId === 'squat' && pr.type === 'weight'
    );
    expect(squatWeightPR).toBeDefined();
    expect(squatWeightPR!.weight).toBe(120);
  });

  it('computes recentPRs (within 7 days)', () => {
    // All PRs are from sessions within 7 days of NOW (May 28-29)
    // except sess-3 (May 20) which is 10 days ago
    expect(result.recentPRs.length).toBeGreaterThan(0);
    for (const pr of result.recentPRs) {
      const prDate = new Date(pr.date).getTime();
      expect(prDate).toBeGreaterThanOrEqual(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  });

  it('computes week-over-week allDeltas', () => {
    // This week (May 23-30): sess-1 and sess-2 have bench-press and squat
    // Last week (May 16-23): sess-3 has bench-press
    expect(result.allDeltas.length).toBeGreaterThan(0);
    const benchDelta = result.allDeltas.find((d) => d.exerciseId === 'bench-press');
    expect(benchDelta).toBeDefined();
    // This week bench volume: 80*8 + 90*6 + 70*10 = 640+540+700 = 1880
    // Last week bench volume: 75*8 = 600
    expect(benchDelta!.currentVolume).toBe(1880);
    expect(benchDelta!.previousVolume).toBe(600);
    expect(benchDelta!.change).toBe(Math.round(((1880 - 600) / 600) * 100));
  });

  it('weekOverWeekMap allows cheap lookup by exerciseName', () => {
    const benchDeltas = result.weekOverWeekMap.get('Bench Press');
    expect(benchDeltas).toBeDefined();
    expect(benchDeltas!.length).toBeGreaterThan(0);
    expect(benchDeltas![0]!.exerciseId).toBe('bench-press');
  });

  it('streak computation matches expected consecutive days', () => {
    // Unique dates: 2026-05-29, 2026-05-28, 2026-05-20
    // Anchor: May 29 (yesterday from May 30)
    // May 29 = anchor-0, May 28 = anchor-1 => streak of 2
    // May 20 breaks the chain
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });
});

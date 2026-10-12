import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../../../types';
import { buildCardioSession } from '../../../utils/cardio';
import { toLocalDateStr } from '../../../utils/dateUtils';
import { aggregateInsights } from '../insightsAggregator';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 14, 12, 0);

const run = (daysAgo: number, km = 8): WorkoutSession =>
  buildCardioSession(
    {
      activity: 'run',
      startTime: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
      durationSec: km * 330,
      distanceKm: km,
    },
    NOW.getTime()
  );

const bench = (id: string, daysAgo: number, weight: number): WorkoutSession => {
  const start = new Date(NOW.getTime() - daysAgo * DAY);
  const iso = start.toISOString();
  return {
    id,
    date: toLocalDateStr(start),
    startTime: iso,
    endTime: iso,
    duration: 3600,
    status: 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume: weight * 10,
    caloriesBurned: null,
    createdAt: iso,
    updatedAt: iso,
    exercises: [
      {
        id: `${id}-bench`,
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        targetMuscle: 'Chest',
        muscleGroup: 'Chest',
        notes: '',
        restSeconds: 90,
        isCompleted: true,
        order: 0,
        sets: [
          {
            id: `${id}-s1`,
            setNumber: 1,
            reps: 10,
            weight,
            rpe: null,
            isWarmup: false,
            isCompleted: true,
            notes: '',
            completedAt: iso,
          },
        ],
      },
    ],
  };
};

describe('aggregateInsights with cardio', () => {
  // Runs every day this week and last; bench once a week.
  const sessions = [
    run(0),
    run(1),
    bench('b1', 2, 80),
    run(3),
    run(8),
    run(9),
    bench('b2', 10, 70),
  ];
  const result = aggregateInsights(sessions, NOW);

  it('counts runs as training days — totals and streak', () => {
    expect(result.totalWorkouts).toBe(7);
    expect(result.workoutsThisWeek).toBe(4);
    expect(result.currentStreak).toBe(4);
  });

  it('never flags Cardio as a muscle to train', () => {
    expect(result.muscleGroups.map((m) => m.muscle)).toEqual(['Chest']);
    expect(result.neglectedMuscles).not.toContain('Cardio');
  });

  it('adds no 0 kg week-over-week delta, PR or progression pick for a run', () => {
    expect(result.allDeltas.map((d) => d.exerciseId)).toEqual(['bench']);
    expect(result.allPRs.every((pr) => pr.exerciseId === 'bench')).toBe(true);
    expect(result.exerciseNames).toEqual(['Bench Press']);
  });

  it('a run as the last workout names no muscle and keeps its 0 kg honestly', () => {
    expect(result.lastWorkout).toMatchObject({
      exerciseCount: 1,
      totalVolume: 0,
      muscleGroups: [],
    });
  });

  it('a lifter whose last run is 10 days old gets no "neglected Cardio" finding', () => {
    const r = aggregateInsights([run(10), bench('b', 1, 80)], NOW);
    expect(r.neglectedMuscles).toEqual([]);
    expect(r.muscleGroups.map((m) => m.muscle)).toEqual(['Chest']);
  });
});

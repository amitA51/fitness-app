import { describe, expect, it } from 'vitest';
import type { CardioActivity, WorkoutSession } from '../../../types';
import { buildCardioSession } from '../../../utils/cardio';
import { cardioLastWeeks, computeClientAnalytics, summarizeCardio } from '../coachAnalytics';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 11, 20).getTime();

const cardio = (
  activity: CardioActivity,
  daysAgo: number,
  durationSec: number,
  distanceKm?: number
): WorkoutSession =>
  buildCardioSession(
    { activity, startTime: new Date(NOW - daysAgo * DAY).toISOString(), durationSec, distanceKm },
    NOW
  );

/** A gym session with a 10-minute treadmill walk before the lifting. */
const gymWithTreadmill = (daysAgo: number): WorkoutSession => {
  const start = new Date(NOW - daysAgo * DAY).toISOString();
  const walk = buildCardioSession({
    activity: 'treadmill',
    startTime: start,
    durationSec: 600,
    distanceKm: 1,
  });
  return {
    ...walk,
    totalVolume: 4000,
    exercises: [
      ...walk.exercises,
      {
        id: 'bench',
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        targetMuscle: 'Chest',
        notes: '',
        restSeconds: 90,
        isCompleted: true,
        order: 1,
        sets: [
          {
            id: 'b1',
            setNumber: 1,
            reps: 8,
            weight: 80,
            rpe: null,
            isWarmup: false,
            isCompleted: true,
            notes: '',
            completedAt: start,
          },
        ],
      },
    ],
  };
};

describe('summarizeCardio', () => {
  it('sums each discipline once, runs first, and skips nothing-recorded sessions', () => {
    const sessions = [
      cardio('run', 1, 1720, 5.2),
      cardio('run', 3, 3600, 10),
      cardio('walk', 2, 2400, 3),
      cardio('elliptical', 4, 1200),
    ];

    const totals = summarizeCardio(sessions, () => true);

    expect(totals.map((t) => t.discipline)).toEqual(['running', 'walking', 'other']);
    expect(totals[0]).toMatchObject({ discipline: 'running', count: 2, durationSec: 5320 });
    expect(totals[0]?.distanceKm).toBeCloseTo(15.2, 6);
    expect(totals[2]).toMatchObject({ count: 1, distanceKm: 0, durationSec: 1200 });
  });

  it('counts the treadmill block of a gym session (a slow one as walking)', () => {
    const totals = summarizeCardio([gymWithTreadmill(1)], () => true);
    expect(totals).toEqual([{ discipline: 'walking', count: 1, distanceKm: 1, durationSec: 600 }]);
  });

  it('returns [] for lifting-only history', () => {
    const lifting = { ...gymWithTreadmill(1), exercises: gymWithTreadmill(1).exercises.slice(1) };
    expect(summarizeCardio([lifting], () => true)).toEqual([]);
  });
});

describe('cardioLastWeeks', () => {
  it('keeps the same trailing 28-day window as volumeByWeek', () => {
    const sessions = [
      cardio('run', 2, 1800, 5),
      cardio('run', 27, 1800, 5),
      cardio('run', 29, 1800, 5),
    ];
    const [running] = cardioLastWeeks(sessions, 4, NOW);
    expect(running).toMatchObject({ discipline: 'running', count: 2, distanceKm: 10 });
  });
});

describe('computeClientAnalytics with cardio sessions', () => {
  it('counts a run as activity but adds nothing to lifting volume', () => {
    const sessions = [cardio('run', 1, 1800, 5), gymWithTreadmill(2)];
    const result = computeClientAnalytics(sessions, 7, NOW);
    expect(result.sessionsLast7).toBe(2);
    expect(result.level).toBe('active');
    expect(result.volumeByWeek).toEqual([0, 0, 0, 4000]);
  });
});

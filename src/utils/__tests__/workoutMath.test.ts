import { describe, expect, test } from 'vitest';
import { computeSessionStats, exerciseVolume, sessionVolume, setVolume } from '../workoutMath';

describe('setVolume / exerciseVolume / sessionVolume', () => {
  test('warmup sets contribute zero volume', () => {
    expect(setVolume({ weight: 100, reps: 5, isWarmup: true })).toBe(0);
    expect(setVolume({ weight: 100, reps: 5 })).toBe(500);
  });

  test('missing weight or reps are treated as zero', () => {
    expect(setVolume({ reps: 5 })).toBe(0);
    expect(setVolume({ weight: 100 })).toBe(0);
  });

  test('exercise and session volume sum working sets', () => {
    const ex = {
      sets: [
        { weight: 50, reps: 10 },
        { weight: 60, reps: 5, isWarmup: true },
      ],
    };
    expect(exerciseVolume(ex)).toBe(500);
    expect(sessionVolume({ exercises: [ex, ex] })).toBe(1000);
  });
});

describe('computeSessionStats', () => {
  test('persisted shape excludes warmups and gates volume on weight+reps (WorkoutSummary)', () => {
    const session = {
      exercises: [
        {
          name: 'Bench',
          sets: [
            { weight: 60, reps: 10, isWarmup: true, completedAt: '2026-01-01' }, // warmup -> ignored
            { weight: 100, reps: 5, completedAt: '2026-01-01' }, // counts
            { weight: 100, reps: 5, completedAt: '2026-01-01' }, // counts, best by volume tie
            { reps: 8, completedAt: '2026-01-01' }, // reps only, no weight -> reps count, no volume
            { weight: 80, reps: 5 }, // not completed -> ignored
          ],
        },
      ],
    };

    const stats = computeSessionStats(session, { excludeWarmup: true });

    expect(stats.totalVolume).toBe(1000); // 2 * (100*5)
    expect(stats.completedSets).toBe(3); // three completed non-warmup sets
    expect(stats.totalSets).toBe(3);
    expect(stats.totalReps).toBe(18); // 5 + 5 + 8
    expect(stats.exerciseCount).toBe(1);
    expect(stats.exerciseStats[0]?.bestSet).toEqual({ weight: 100, reps: 5 });
  });

  test('history shape counts warmups toward sets/volume (WorkoutHistoryScreen)', () => {
    const session = {
      exercises: [
        {
          sets: [
            { weight: 60, reps: 10, isWarmup: true, completedAt: '2026-01-01' }, // counted
            { weight: 100, reps: 5, completedAt: '2026-01-01' },
          ],
        },
      ],
    };

    const stats = computeSessionStats(session);

    // warmup setVolume is still 0, but the set is counted as completed
    expect(stats.totalVolume).toBe(500);
    expect(stats.completedSets).toBe(2);
  });

  test('live shape uses completed boolean, target totals, and avg RPE (PerformanceAnalytics)', () => {
    const exercises = [
      {
        name: 'Squat',
        targetSets: 3,
        sets: [
          { weight: 100, reps: 5, completed: true, rpe: 8 },
          { weight: 100, reps: 5, completed: true, rpe: 9 },
          { weight: 100, reps: 5, completed: false },
        ],
      },
    ];

    const stats = computeSessionStats(
      { exercises },
      { excludeWarmup: false, requireWeightAndReps: false, totalSetsMode: 'target' }
    );

    expect(stats.totalVolume).toBe(1000); // 2 completed * 500
    expect(stats.completedSets).toBe(2);
    expect(stats.totalSets).toBe(3); // sum of targetSets
    expect(stats.avgRPE).toBe(8.5);
  });
});

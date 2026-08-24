import { describe, expect, it } from 'vitest';
import { computeWorkoutXp } from '../workoutXp';

describe('computeWorkoutXp', () => {
  it('earns 1 XP per 100 kg of volume', () => {
    expect(computeWorkoutXp({ totalVolumeKg: 2500, completedSets: 0 })).toBe(25);
  });

  it('adds a flat 5 XP per completed set', () => {
    expect(computeWorkoutXp({ totalVolumeKg: 0, completedSets: 10 })).toBe(50);
  });

  it('multiplies PRs by 25 on top of work done', () => {
    const base = computeWorkoutXp({ totalVolumeKg: 2000, completedSets: 12 });
    const withPrs = computeWorkoutXp({
      totalVolumeKg: 2000,
      completedSets: 12,
      personalRecords: 3,
    });
    expect(withPrs - base).toBe(75);
  });

  it('floors partial volume — a 199kg session is not 2 XP', () => {
    expect(computeWorkoutXp({ totalVolumeKg: 199, completedSets: 0 })).toBe(1);
  });

  it('returns 0 for an empty session', () => {
    expect(computeWorkoutXp({ totalVolumeKg: 0, completedSets: 0 })).toBe(0);
  });
});

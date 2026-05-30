import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../../types';
import { calculateStreak } from '../achievementService';

/** Helper: minimal session stub with only the fields calculateStreak uses. */
const session = (startTime: string): WorkoutSession =>
  ({
    id: crypto.randomUUID(),
    startTime,
    date: startTime.slice(0, 10),
  }) as unknown as WorkoutSession;

describe('calculateStreak', () => {
  // Pin "now" to Wednesday 2025-01-15 at 10:00 local
  const now = new Date(2025, 0, 15, 10, 0, 0);

  it('returns zeros for empty sessions', () => {
    const result = calculateStreak([], now);
    expect(result).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      lastWorkoutDate: null,
      workoutsThisWeek: 0,
    });
  });

  it('counts a consecutive-day streak correctly', () => {
    // Trained 15, 14, 13 Jan (3 consecutive days ending today)
    const sessions = [
      session('2025-01-15T08:00:00'),
      session('2025-01-14T07:00:00'),
      session('2025-01-13T09:00:00'),
    ];
    const result = calculateStreak(sessions, now);
    expect(result.currentStreak).toBe(3);
    expect(result.longestStreak).toBe(3);
  });

  it('a gap breaks the current streak', () => {
    // Trained 15, 14, 12 (gap on 13th)
    const sessions = [
      session('2025-01-15T08:00:00'),
      session('2025-01-14T07:00:00'),
      session('2025-01-12T09:00:00'),
    ];
    const result = calculateStreak(sessions, now);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(2);
  });

  it('trained today: streak includes today', () => {
    const sessions = [session('2025-01-15T06:00:00')];
    const result = calculateStreak(sessions, now);
    expect(result.currentStreak).toBe(1);
  });

  it('not yet trained today: streak anchors from yesterday', () => {
    // Last workout was yesterday (14th), "now" is 15th morning
    const sessions = [session('2025-01-14T18:00:00'), session('2025-01-13T18:00:00')];
    const result = calculateStreak(sessions, now);
    // Anchor shifts to yesterday so the streak is still alive
    expect(result.currentStreak).toBe(2);
  });

  it('longestStreak reflects a past streak longer than current', () => {
    // Past streak: 5 days (Jan 5-9), current streak: 2 days (Jan 14-15)
    const sessions = [
      session('2025-01-15T08:00:00'),
      session('2025-01-14T08:00:00'),
      session('2025-01-09T08:00:00'),
      session('2025-01-08T08:00:00'),
      session('2025-01-07T08:00:00'),
      session('2025-01-06T08:00:00'),
      session('2025-01-05T08:00:00'),
    ];
    const result = calculateStreak(sessions, now);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(5);
  });

  it('workoutsThisWeek counts sessions in the current week', () => {
    // now is Wed Jan 15; week starts Sun Jan 12
    const sessions = [
      session('2025-01-15T08:00:00'),
      session('2025-01-13T08:00:00'),
      session('2025-01-12T08:00:00'),
      session('2025-01-11T08:00:00'), // Saturday before — outside week
    ];
    const result = calculateStreak(sessions, now);
    expect(result.workoutsThisWeek).toBe(3);
  });
});

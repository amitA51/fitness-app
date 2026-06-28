import { describe, expect, it } from 'vitest';
import { deriveRingGoals } from './ringGoals';

const session = (startTime: string, totalVolume: number, durationSec: number) => ({
  startTime,
  totalVolume,
  duration: durationSec,
});

// All dates are local-time and comfortably mid-week so timezone offsets can
// never push a session across a 7-day baseline boundary.
describe('deriveRingGoals', () => {
  const DEFAULTS = { workouts: 4, volume: 8000, minutes: 240 };
  const start = new Date('2026-06-15T12:00:00');

  it('falls back to defaults when there is no history', () => {
    expect(deriveRingGoals([], start)).toEqual(DEFAULTS);
  });

  it('falls back to defaults with fewer than two active baseline weeks', () => {
    // Only week i=1 ([06-08, 06-15)) has a session → 1 active week < MIN(2).
    expect(deriveRingGoals([session('2026-06-11T12:00:00', 5000, 3600)], start)).toEqual(DEFAULTS);
  });

  it('excludes sessions in or after the current week', () => {
    const currentAndFuture = [
      session('2026-06-16T12:00:00', 9999, 9999), // after the current week start
      session('2026-06-15T18:00:00', 9999, 9999), // inside the current week
    ];
    expect(deriveRingGoals(currentAndFuture, start)).toEqual(DEFAULTS);
  });

  it('derives clamped workouts and median volume/minutes from baseline weeks', () => {
    const sessions = [
      // Week i=1 ([06-08, 06-15)): 3 sessions → 12000 volume, 10800s (180 min)
      session('2026-06-11T12:00:00', 4000, 3600),
      session('2026-06-11T13:00:00', 4000, 3600),
      session('2026-06-11T14:00:00', 4000, 3600),
      // Week i=2 ([06-01, 06-08)): 1 session → 8000 volume, 3600s (60 min)
      session('2026-06-04T12:00:00', 8000, 3600),
    ];
    // counts [3,1] → avg 2 → clamped up to the min of 3; medians of [12000,8000]
    // and [180,60] are 10000 and 120.
    expect(deriveRingGoals(sessions, start)).toEqual({ workouts: 3, volume: 10000, minutes: 120 });
  });

  it('clamps the derived workout goal to the max of 6', () => {
    const many = (day: string, n: number) =>
      Array.from({ length: n }, (_, i) => session(`${day}T${10 + i}:00:00`, 5000, 3600));
    const sessions = [...many('2026-06-11', 8), ...many('2026-06-04', 8)];
    // counts [8,8] → avg 8 → clamped down to 6
    expect(deriveRingGoals(sessions, start).workouts).toBe(6);
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  addRestDay,
  computeStreakWithRests,
  getRestDays,
  isRestDay,
  removeRestDay,
} from '../restDays';

// Day-key helper — local dates like the app uses (YYYY-MM-DD).
const key = (y: number, m: number, d: number): string =>
  `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

// Fixed "now": Thursday 2026-08-06 local.
const NOW = new Date(2026, 7, 6);

beforeEach(() => {
  localStorage.clear();
});

describe('restDays storage', () => {
  it('adds, checks and removes a rest day idempotently', () => {
    const k = key(2026, 8, 5);
    expect(isRestDay(k)).toBe(false);
    addRestDay(k);
    addRestDay(k);
    expect(getRestDays().size).toBe(1);
    expect(isRestDay(k)).toBe(true);
    removeRestDay(k);
    expect(isRestDay(k)).toBe(false);
  });
});

describe('computeStreakWithRests', () => {
  it('matches plain semantics with no rest days', () => {
    // Trained today + yesterday → streak 2.
    const days = new Set([key(2026, 8, 6), key(2026, 8, 5)]);
    expect(computeStreakWithRests(days, new Set(), NOW)).toEqual({
      currentStreak: 2,
      longestStreak: 2,
    });
  });

  it('a declared rest day bridges a one-day gap', () => {
    // Trained Mon Aug 3 and Thu Aug 6; Tue declared rest; Wed gap.
    const days = new Set([key(2026, 8, 3), key(2026, 8, 6)]);
    const rests = new Set([key(2026, 8, 4), key(2026, 8, 5)]);
    const { currentStreak } = computeStreakWithRests(days, rests, NOW);
    // Walk: today grace, Thu workout (+1), Wed rest bridge, Tue rest bridge,
    // Mon workout (+1), Sun nothing → current = 2 workouts bridged by rests.
    expect(currentStreak).toBe(2);
  });

  it('an undeclared gap still breaks the streak', () => {
    const days = new Set([key(2026, 8, 3), key(2026, 8, 6)]);
    expect(computeStreakWithRests(days, new Set(), NOW).currentStreak).toBe(1);
  });

  it("today unlogged doesn't kill the run (grace preserved)", () => {
    const days = new Set([key(2026, 8, 5), key(2026, 8, 4)]);
    expect(computeStreakWithRests(days, new Set(), NOW).currentStreak).toBe(2);
    // And with the anchor yesterday, an extra rest day before extends it:
    const rests = new Set([key(2026, 8, 3)]);
    const more = new Set([...days, key(2026, 8, 2)]);
    expect(computeStreakWithRests(more, rests, NOW).currentStreak).toBe(3);
  });

  it('longest streak bridges only when EVERY gap day is a rest day', () => {
    // Jul 28..31 workouts, Aug 1 rest, then Aug 3+4 workouts, Aug 2 NOT rest.
    const days = new Set([key(2026, 7, 30), key(2026, 7, 31), key(2026, 8, 3), key(2026, 8, 4)]);
    const noBridge = computeStreakWithRests(days, new Set([key(2026, 8, 1)]), NOW);
    expect(noBridge.longestStreak).toBe(2); // two separate runs

    const fullBridgeRests = new Set([key(2026, 8, 1), key(2026, 8, 2), key(2026, 7, 29)]);
    const bridged = computeStreakWithRests(days, fullBridgeRests, NOW);
    // Runs now join: 30,31,+rest1,+rest2,3,4 → longest = 4 workouts.
    expect(bridged.longestStreak).toBe(4);
  });

  it('empty workout days stays at zero regardless of rests', () => {
    const rests = new Set([key(2026, 8, 5)]);
    expect(computeStreakWithRests(new Set(), rests, NOW)).toEqual({
      currentStreak: 0,
      longestStreak: 0,
    });
  });

  it('a rest day never inflates the count beyond workouts in the run', () => {
    // One workout + six declared rest days after it: still counts 1 workout.
    const days = new Set([key(2026, 8, 5)]);
    const rests = new Set([
      key(2026, 8, 4),
      key(2026, 8, 3),
      key(2026, 8, 2),
      key(2026, 8, 1),
      key(2026, 7, 31),
      key(2026, 7, 30),
    ]);
    expect(computeStreakWithRests(days, rests, NOW).currentStreak).toBe(1);
  });
});

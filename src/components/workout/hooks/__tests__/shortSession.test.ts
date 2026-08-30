// Unit tests for the Apple-HIG short-session gate in useWorkoutSave.
// A finished session under SHORT_SESSION_SECONDS must be flagged so the
// confirm overlay can ask "record or drop?" instead of silently saving junk.
import { describe, expect, it, vi } from 'vitest';
import { SHORT_SESSION_SECONDS, isShortSession } from '../useWorkoutSave';

describe('isShortSession — Apple HIG short-session gate', () => {
  const start = 1_000_000_000; // arbitrary epoch ms

  it('flags a session under 60s as short', () => {
    expect(isShortSession(start, 0, start + 30_000)).toBe(true);
    expect(isShortSession(start, 0, start + 59_999)).toBe(true);
  });

  it('does not flag a session at/over 60s', () => {
    expect(isShortSession(start, 0, start + 60_000)).toBe(false);
    expect(isShortSession(start, 0, start + SHORT_SESSION_SECONDS * 1000)).toBe(false);
    expect(isShortSession(start, 0, start + 10 * 60_000)).toBe(false);
  });

  it('excludes paused time from the elapsed duration', () => {
    // 70s wall-clock minus 30s paused = 40s active → still short.
    expect(isShortSession(start, 30_000, start + 70_000)).toBe(true);
    // 130s wall-clock minus 60s paused = 70s active → not short.
    expect(isShortSession(start, 60_000, start + 130_000)).toBe(false);
  });

  // T-102: the gate decides whether the user is asked "was this accidental?".
  // Judging it against a captured/stale elapsed would ask that of someone who
  // genuinely trained for minutes. Pin that the DEFAULT `now` is the live clock.
  it('judges against the live clock when no `now` is supplied', () => {
    vi.useFakeTimers();
    try {
      const startedAt = Date.now();
      // A real 5-minute session: never an accidental micro-session.
      vi.setSystemTime(startedAt + 5 * 60_000);
      expect(isShortSession(startedAt, 0)).toBe(false);

      // ...and a genuine 3s session still is one.
      vi.setSystemTime(startedAt + 3_000);
      expect(isShortSession(startedAt, 0)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

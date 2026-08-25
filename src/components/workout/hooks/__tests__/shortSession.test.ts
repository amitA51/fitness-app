// Unit tests for the Apple-HIG short-session gate in useWorkoutSave.
// A finished session under SHORT_SESSION_SECONDS must be flagged so the
// confirm overlay can ask "record or drop?" instead of silently saving junk.
import { describe, expect, it } from 'vitest';
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
});

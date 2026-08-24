import { describe, expect, it } from 'vitest';
import { levelFromXp, xpForLevel } from '../workoutLevels';

describe('xpForLevel', () => {
  it('level 1 costs nothing', () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it('level 2 costs 100 XP (~1-2 sessions)', () => {
    expect(xpForLevel(2)).toBe(100);
  });

  it('widens steadily — L5→L6 costs more than L2→L3', () => {
    expect(xpForLevel(6) - xpForLevel(5)).toBeGreaterThan(xpForLevel(3) - xpForLevel(2));
  });
});

describe('levelFromXp', () => {
  it('zero XP is level 1', () => {
    expect(levelFromXp(0).level).toBe(1);
  });

  it('round-trips: xpForLevel(n) lands exactly on level n', () => {
    for (const n of [2, 3, 7, 12]) {
      expect(levelFromXp(xpForLevel(n)).level).toBe(n);
    }
  });

  it('one XP below a threshold stays at the previous level', () => {
    expect(levelFromXp(xpForLevel(3) - 1).level).toBe(2);
  });

  it('reports progress into the current level', () => {
    const { intoLevel, levelSpan } = levelFromXp(xpForLevel(4) + 30);
    expect(intoLevel).toBe(30);
    expect(levelSpan).toBe(xpForLevel(5) - xpForLevel(4));
  });
});

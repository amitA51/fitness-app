import { beforeEach, describe, expect, it } from 'vitest';
import { awardSessionXp, getTotalXp } from '../xpStore';

describe('xpStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts at zero', () => {
    expect(getTotalXp()).toBe(0);
  });

  it('awards XP and reports the new total', () => {
    const total = awardSessionXp(120, 's1');
    expect(total).toBe(120);
    expect(getTotalXp()).toBe(120);
  });

  it('never double-counts the same session id', () => {
    awardSessionXp(120, 's1');
    awardSessionXp(120, 's1');
    expect(getTotalXp()).toBe(120);
  });

  it('counts distinct sessions separately', () => {
    awardSessionXp(120, 's1');
    awardSessionXp(80, 's2');
    expect(getTotalXp()).toBe(200);
  });

  it('ignores zero/negative awards', () => {
    awardSessionXp(0, 's1');
    expect(getTotalXp()).toBe(0);
  });
});

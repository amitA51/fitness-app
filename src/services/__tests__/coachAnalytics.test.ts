import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '../../types';
import { clientStatusMeta, computeClientAnalytics } from '../coach/coachAnalytics';

const NOW = new Date('2026-05-29T12:00:00Z').getTime();
const DAY = 86_400_000;

const makeSession = (daysAgo: number, totalVolume = 0): WorkoutSession =>
  ({
    id: `s-${daysAgo}`,
    startTime: new Date(NOW - daysAgo * DAY).toISOString(),
    totalVolume,
    exercises: [],
  }) as unknown as WorkoutSession;

describe('computeClientAnalytics', () => {
  it('returns defaults for empty sessions', () => {
    const r = computeClientAnalytics([], 7, NOW);
    expect(r.level).toBe('new');
    expect(r.lastActivity).toBeNull();
    expect(r.daysSinceActivity).toBeNull();
    expect(r.volumeByWeek).toEqual([0, 0, 0, 0]);
    expect(r.sessionsLast7).toBe(0);
  });

  it('one session 2 days ago → active', () => {
    const r = computeClientAnalytics([makeSession(2)], 7, NOW);
    expect(r.level).toBe('active');
    expect(r.sessionsLast7).toBe(1);
    expect(r.daysSinceActivity).toBe(2);
  });

  it('only session 10 days ago → inactive', () => {
    const r = computeClientAnalytics([makeSession(10)], 7, NOW);
    expect(r.level).toBe('inactive');
    expect(r.daysSinceActivity).toBe(10);
  });

  it('sessions 8 and 11 days ago (none in last 7) → at_risk with inactiveDays=14', () => {
    const r = computeClientAnalytics([makeSession(8), makeSession(11)], 14, NOW);
    expect(r.level).toBe('at_risk');
    expect(r.sessionsLast7).toBe(0);
  });

  it('volumeByWeek buckets correctly', () => {
    const r = computeClientAnalytics([makeSession(0, 100), makeSession(21, 50)], 7, NOW);
    expect(r.volumeByWeek[3]).toBe(100);
    expect(r.volumeByWeek[0]).toBe(50);
  });
});

describe('clientStatusMeta', () => {
  it('returns correct Hebrew labels, colors, and severity dot shapes', () => {
    expect(clientStatusMeta('active')).toEqual({
      label: 'פעיל',
      color: 'var(--fs-accent)',
      dot: 'filled',
    });
    // at_risk and inactive share the warn color; the dot SHAPE carries severity.
    expect(clientStatusMeta('at_risk')).toEqual({
      label: 'בסיכון',
      color: 'var(--fs-warn)',
      dot: 'ring',
    });
    expect(clientStatusMeta('inactive')).toEqual({
      label: 'לא פעיל',
      color: 'var(--fs-warn)',
      dot: 'filled',
    });
    expect(clientStatusMeta('new')).toEqual({
      label: 'חדש',
      color: 'var(--fs-muted)',
      dot: 'none',
    });
  });
});

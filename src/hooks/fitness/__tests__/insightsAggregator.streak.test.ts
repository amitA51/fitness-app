import { describe, expect, it } from 'vitest';
import { computeStreak } from '../insightsAggregator';

describe('computeStreak', () => {
  it('returns zeros for empty set', () => {
    const result = computeStreak(new Set(), new Date('2026-05-30'));
    expect(result.currentStreak).toBe(0);
    expect(result.longestStreak).toBe(0);
  });

  it('historical 5-day streak longer than current 2-day streak', () => {
    // Current streak: May 29-30 (2 days ending at today)
    // Historical streak: Jan 10-14 (5 consecutive days)
    const dates = new Set([
      '2026-01-10',
      '2026-01-11',
      '2026-01-12',
      '2026-01-13',
      '2026-01-14',
      '2026-05-29',
      '2026-05-30',
    ]);
    const now = new Date('2026-05-30T12:00:00.000Z');
    const result = computeStreak(dates, now);
    expect(result.currentStreak).toBe(2);
    expect(result.longestStreak).toBe(5);
  });

  it('contiguous streak is both current and longest', () => {
    // 4 consecutive days ending at today
    const dates = new Set(['2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30']);
    const now = new Date('2026-05-30T12:00:00.000Z');
    const result = computeStreak(dates, now);
    expect(result.currentStreak).toBe(4);
    expect(result.longestStreak).toBe(4);
  });
});

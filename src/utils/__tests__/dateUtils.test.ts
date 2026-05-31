import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fmtDate,
  formatDateISO,
  formatDuration,
  formatDurationCompact,
  formatHebrewDate,
  formatHebrewTime,
  formatVolume,
  getWeekNumber,
  getWeekStart,
  toLocalDateStr,
  todayStr,
} from '../dateUtils';

describe('formatDuration', () => {
  it('uses the singular form for exactly one hour', () => {
    expect(formatDuration(3600)).toBe('שעה');
  });

  it('uses the plural form for multiple whole hours', () => {
    expect(formatDuration(7200)).toBe('2 שעות');
  });

  it('includes minutes when present', () => {
    expect(formatDuration(5400)).toBe('1 שעה ו-30 דקות');
  });

  it('shows minutes for sub-hour durations', () => {
    expect(formatDuration(1800)).toBe('30 דקות');
  });
});

describe('fmtDate', () => {
  it('returns an empty string for an invalid date instead of "Invalid Date"', () => {
    expect(fmtDate('not-a-date')).toBe('');
  });
});

describe('fmtDate - calendar-day and future-date correctness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "היום" for a timestamp earlier the same calendar day', () => {
    // Arrange: now = 2026-05-15 13:00 local; entry = same day 08:00
    vi.setSystemTime(new Date(2026, 4, 15, 13, 0, 0));

    // Act / Assert
    expect(fmtDate('2026-05-15T08:00:00')).toBe('היום');
  });

  it('labels the previous calendar day "אתמול" even within a 24h window', () => {
    // Arrange: now = 2026-05-15 01:00 local; entry = 2026-05-14 23:00 local.
    // Only ~2h apart, so the old 24h-window math wrongly returned "היום".
    vi.setSystemTime(new Date(2026, 4, 15, 1, 0, 0));

    // Act / Assert
    expect(fmtDate('2026-05-14T23:00:00')).toBe('אתמול');
  });

  it('returns "לפני N ימים" for a date a few calendar days back', () => {
    // Arrange
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));

    // Act / Assert
    expect(fmtDate('2026-05-12T12:00:00')).toBe('לפני 3 ימים');
  });

  it('does not produce a negative "לפני" label for a future date', () => {
    // Arrange: entry is 5 days in the future (negative diff).
    vi.setSystemTime(new Date(2026, 4, 15, 12, 0, 0));

    // Act
    const result = fmtDate('2026-05-20T12:00:00');

    // Assert: falls through to the absolute date, never "לפני -5 ימים".
    expect(result).not.toContain('לפני');
    expect(result).not.toBe('היום');
    expect(result).not.toBe('אתמול');
  });
});

describe('formatHebrewDate', () => {
  it('returns empty string for invalid input', () => {
    expect(formatHebrewDate('garbage')).toBe('');
  });

  it('formats a valid date in Hebrew', () => {
    // 2024-03-15 is a Friday
    expect(formatHebrewDate('2024-03-15')).toBe('יום שישי, 15 מרץ');
  });
});

describe('formatHebrewTime', () => {
  it('returns empty string for invalid input', () => {
    expect(formatHebrewTime('not-a-time')).toBe('');
  });

  it('formats a valid ISO string to HH:MM', () => {
    const result = formatHebrewTime('2024-03-15T14:30:00Z');
    // Should contain hour and minute digits separated by colon
    expect(result).toMatch(/\d{2}:\d{2}/);
  });
});

describe('formatDateISO', () => {
  it('returns empty string for invalid input', () => {
    expect(formatDateISO('xyz')).toBe('');
  });

  it('formats a valid date as DD.MM.YY', () => {
    expect(formatDateISO('2024-03-05')).toBe('05.03.24');
  });

  it('formats another valid date correctly', () => {
    expect(formatDateISO('2025-12-31')).toBe('31.12.25');
  });
});

describe('getWeekStart', () => {
  it('returns Monday for a Sunday input', () => {
    // 2024-03-17 is a Sunday
    const result = getWeekStart(new Date(2024, 2, 17));
    // Sunday getDay()=0 triggers the -6 branch -> Monday March 11
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(11);
  });

  it('returns Monday for a midweek (Wednesday) input', () => {
    // 2024-03-13 is a Wednesday
    const result = getWeekStart(new Date(2024, 2, 13));
    expect(result.getDay()).toBe(1); // Monday
    expect(result.getDate()).toBe(11);
  });
});

describe('getWeekNumber', () => {
  it('handles Dec 31 that falls in ISO week 1 of next year', () => {
    // 2024-12-31 is a Tuesday -> ISO week 1 of 2025
    expect(getWeekNumber(new Date(2024, 11, 31))).toBe(1);
  });

  it('returns 1 for Jan 1 2024 (Monday)', () => {
    expect(getWeekNumber(new Date(2024, 0, 1))).toBe(1);
  });
});

describe('todayStr', () => {
  it('returns a YYYY-MM-DD formatted string matching today', () => {
    const result = todayStr();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });
});

describe('formatVolume', () => {
  it('returns k notation for values >= 1000', () => {
    expect(formatVolume(1000)).toBe('1.0k');
    expect(formatVolume(2500)).toBe('2.5k');
    expect(formatVolume(10000)).toBe('10.0k');
  });

  it('returns locale string for values < 1000', () => {
    const result = formatVolume(500);
    // toLocaleString may vary, but should represent 500
    expect(result).toContain('500');
  });
});

describe('formatDurationCompact', () => {
  it('returns minutes for sub-hour durations', () => {
    expect(formatDurationCompact(1800)).toBe('30min');
    expect(formatDurationCompact(300)).toBe('5min');
  });

  it('returns hours only when no remaining minutes', () => {
    expect(formatDurationCompact(3600)).toBe('1h');
    expect(formatDurationCompact(7200)).toBe('2h');
  });

  it('returns hours and zero-padded minutes', () => {
    expect(formatDurationCompact(5400)).toBe('1h30');
    expect(formatDurationCompact(3900)).toBe('1h05');
  });
});

describe('toLocalDateStr', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns YYYY-MM-DD in local timezone', () => {
    const date = new Date(2026, 4, 31); // May 31, 2026 local
    expect(toLocalDateStr(date)).toBe('2026-05-31');
  });

  it('returns correct local date at 01:30 Israel time (UTC+3) — would be previous day in UTC', () => {
    // Simulate 2026-06-01 01:30 local (Israel UTC+3) = 2026-05-31 22:30 UTC
    // toLocalDateStr should return 2026-06-01 (local), not 2026-05-31 (UTC)
    vi.setSystemTime(new Date('2026-05-31T22:30:00Z'));
    const now = new Date();
    const result = toLocalDateStr(now);
    // The local date depends on the test runner's timezone, but the function
    // must use local components, not UTC. Verify it matches local getDate().
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });

  it('pads single-digit months and days', () => {
    const date = new Date(2026, 0, 5); // Jan 5
    expect(toLocalDateStr(date)).toBe('2026-01-05');
  });

  it('todayStr matches toLocalDateStr(new Date())', () => {
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 59));
    expect(todayStr()).toBe(toLocalDateStr(new Date()));
  });
});

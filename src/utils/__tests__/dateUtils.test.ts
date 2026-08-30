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

// Hebrew keeps the noun SINGULAR at a cardinal of one and has a dedicated DUAL
// for two, so a count-plus-noun label cannot be built as `${n} <plural>`.
//
// Two assertions here were INVERTED (not deleted) when the formatter was fixed:
// - 7200s pinned "2 שעות"; Hebrew uses the dual "שעתיים".
// - 5400s pinned "1 שעה ו-30 דקות"; Hebrew wants a bare "שעה" with no numeral.
// Both were pinning the defect. The NUMBERS are unchanged in every case.
describe('formatDuration', () => {
  it('uses the singular form for exactly one hour', () => {
    expect(formatDuration(3600)).toBe('שעה');
  });

  it('uses the Hebrew DUAL for exactly two hours, never "2 שעות"', () => {
    expect(formatDuration(7200)).toBe('שעתיים');
  });

  it('uses the plural form from three hours up', () => {
    expect(formatDuration(10800)).toBe('3 שעות');
  });

  it('includes minutes when present, with no numeral before the singular hour', () => {
    expect(formatDuration(5400)).toBe('שעה ו-30 דקות');
  });

  it('attaches the vav directly for a single trailing minute (no hyphen)', () => {
    expect(formatDuration(3660)).toBe('שעה ודקה');
  });

  it('hyphenates the vav before a numeral for multiple trailing minutes', () => {
    expect(formatDuration(9000)).toBe('שעתיים ו-30 דקות');
  });

  it('shows minutes for sub-hour durations', () => {
    expect(formatDuration(1800)).toBe('30 דקות');
  });

  it('uses the singular minute for a one-minute session, never "1 דקות"', () => {
    // 69s rounds to one minute — the ARITHMETIC is untouched, only the noun.
    expect(formatDuration(69)).toBe('דקה אחת');
    expect(formatDuration(60)).toBe('דקה אחת');
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

describe('getWeekStart (Sunday-based, Israeli week)', () => {
  it('returns the same day for a Sunday input — a Sunday workout opens the new week', () => {
    // 2024-03-17 is a Sunday
    const result = getWeekStart(new Date(2024, 2, 17));
    expect(result.getDay()).toBe(0); // Sunday
    expect(result.getDate()).toBe(17);
  });

  it('returns the previous Sunday for a midweek (Wednesday) input', () => {
    // 2024-03-13 is a Wednesday
    const result = getWeekStart(new Date(2024, 2, 13));
    expect(result.getDay()).toBe(0); // Sunday
    expect(result.getDate()).toBe(10);
  });

  it('returns the previous Sunday for a Saturday input (end of the Israeli week)', () => {
    // 2024-03-16 is a Saturday
    const result = getWeekStart(new Date(2024, 2, 16));
    expect(result.getDay()).toBe(0); // Sunday
    expect(result.getDate()).toBe(10);
  });

  it('normalizes the result to local midnight so same-day sessions are included', () => {
    const result = getWeekStart(new Date(2024, 2, 17, 18, 45, 30));
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
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

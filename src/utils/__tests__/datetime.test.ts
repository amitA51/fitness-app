import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dayKeyInTz,
  dayKeyToStartOfDay,
  endOfDayInTz,
  formatDate,
  formatTime,
  getDeviceTimeZone,
  isTodayInTz,
  parseDayKey,
  resolveTimeZone,
  startOfDayInTz,
  todayKeyInTz,
} from '../datetime';

// Coverage-loop run #2 target (see plans/loop-state/test-coverage.md).
// datetime.ts is pure + Intl-based; timezone math is asserted against fixed UTC
// instants. Dates are kept in June 2026 so Asia/Jerusalem is unambiguously IDT
// (UTC+3) — no DST seam to reason about.
const JERUSALEM = 'Asia/Jerusalem';

describe('getDeviceTimeZone', () => {
  it('resolves to a non-empty IANA zone string', () => {
    const tz = getDeviceTimeZone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
  });
});

describe('resolveTimeZone', () => {
  it('returns a valid IANA zone unchanged', () => {
    expect(resolveTimeZone('America/New_York')).toBe('America/New_York');
  });

  it('falls back to the device zone for an unknown zone', () => {
    expect(resolveTimeZone('Not/ARealZone')).toBe(getDeviceTimeZone());
  });

  it('falls back to the device zone for empty/undefined input', () => {
    expect(resolveTimeZone('')).toBe(getDeviceTimeZone());
    expect(resolveTimeZone(undefined)).toBe(getDeviceTimeZone());
  });
});

describe('dayKeyInTz', () => {
  it('keys an instant to its wall-clock day in the target zone', () => {
    // 22:30Z on the 7th is already 01:30 on the 8th in Jerusalem (UTC+3).
    const instant = new Date('2026-06-07T22:30:00Z');
    expect(dayKeyInTz(instant, JERUSALEM)).toBe('2026-06-08');
    expect(dayKeyInTz(instant, 'UTC')).toBe('2026-06-07');
  });

  it('falls back to "now" for an invalid date instead of throwing', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T10:00:00Z'));
    expect(dayKeyInTz(new Date('nonsense'), 'UTC')).toBe('2026-06-08');
    vi.useRealTimers();
  });
});

describe('todayKeyInTz / isTodayInTz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // 23:30Z on the 7th → still the 7th in UTC, already the 8th in Jerusalem.
    vi.setSystemTime(new Date('2026-06-07T23:30:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reads "today" per zone, not per the raw UTC instant', () => {
    expect(todayKeyInTz('UTC')).toBe('2026-06-07');
    expect(todayKeyInTz(JERUSALEM)).toBe('2026-06-08');
  });

  it('matches a day key against today in the same zone', () => {
    expect(isTodayInTz('2026-06-08', JERUSALEM)).toBe(true);
    expect(isTodayInTz('2026-06-07', JERUSALEM)).toBe(false);
  });
});

describe('startOfDayInTz / endOfDayInTz', () => {
  it('returns the UTC instant of local midnight for the day', () => {
    const within = new Date('2026-06-08T10:00:00Z');
    // Local midnight Jun 8 in Jerusalem (UTC+3) is 21:00Z on Jun 7.
    expect(startOfDayInTz(within, JERUSALEM).toISOString()).toBe('2026-06-07T21:00:00.000Z');
    expect(startOfDayInTz(within, 'UTC').toISOString()).toBe('2026-06-08T00:00:00.000Z');
  });

  it('returns the last millisecond of the local day', () => {
    const within = new Date('2026-06-08T10:00:00Z');
    expect(endOfDayInTz(within, JERUSALEM).toISOString()).toBe('2026-06-08T20:59:59.999Z');
  });

  it('falls back to "now" for an invalid date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T10:00:00Z'));
    expect(startOfDayInTz(new Date('bad'), 'UTC').toISOString()).toBe('2026-06-08T00:00:00.000Z');
    vi.useRealTimers();
  });
});

describe('parseDayKey', () => {
  it('parses a well-formed YYYY-MM-DD key without UTC drift', () => {
    expect(parseDayKey('2026-06-08')).toEqual({ year: 2026, month: 6, day: 8 });
  });

  it('falls back to today for a malformed key', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-08T10:00:00Z'));
    const parts = parseDayKey('not-a-day');
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(6);
    vi.useRealTimers();
  });
});

describe('dayKeyToStartOfDay', () => {
  it('builds local midnight for a day key without the new Date(key) UTC pitfall', () => {
    expect(dayKeyToStartOfDay('2026-06-08', JERUSALEM).toISOString()).toBe(
      '2026-06-07T21:00:00.000Z'
    );
  });
});

describe('formatDate', () => {
  it('returns an empty string for an invalid date', () => {
    expect(formatDate(new Date('invalid'), 'UTC')).toBe('');
  });

  it('formats a valid date in the target zone (he-IL default)', () => {
    const label = formatDate(new Date('2026-06-08T10:00:00Z'), 'UTC');
    expect(label).not.toBe('');
    expect(label).toContain('2026');
  });

  it('still formats (device zone) when the zone is invalid', () => {
    expect(formatDate(new Date('2026-06-08T10:00:00Z'), 'Bad/Zone')).not.toBe('');
  });

  it('honors Intl option overrides', () => {
    const withWeekday = formatDate(new Date('2026-06-08T10:00:00Z'), 'UTC', { weekday: 'long' });
    expect(withWeekday).not.toBe('');
  });
});

describe('formatTime', () => {
  it('returns an empty string for an invalid date', () => {
    expect(formatTime(new Date('invalid'), 'UTC')).toBe('');
  });

  it('formats 24-hour time in the target zone by default', () => {
    expect(formatTime(new Date('2026-06-08T10:00:00Z'), 'UTC')).toBe('10:00');
  });

  it('shifts the displayed hour by the zone offset', () => {
    // 10:00Z is 13:00 in Jerusalem (UTC+3).
    expect(formatTime(new Date('2026-06-08T10:00:00Z'), JERUSALEM)).toBe('13:00');
  });
});

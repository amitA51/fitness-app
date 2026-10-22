import { beforeEach, describe, expect, it } from 'vitest';
import {
  NEW_ACCOUNT_WINDOW_MS,
  isNewAccount,
  readLastKnownGood,
  writeLastKnownGood,
} from '../lastKnownGood';

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  localStorage.clear();
});

describe('lastKnownGood', () => {
  it('returns what was stored while it is younger than the TTL', () => {
    writeLastKnownGood('k', { ok: true }, 1_000);
    expect(readLastKnownGood('k', DAY, 1_000 + DAY - 1)).toEqual({ ok: true });
  });

  it('returns null once the entry is older than the TTL', () => {
    writeLastKnownGood('k', { ok: true }, 1_000);
    expect(readLastKnownGood('k', DAY, 1_000 + DAY + 1)).toBeNull();
  });

  it('returns null for a missing or malformed entry', () => {
    expect(readLastKnownGood('missing', DAY)).toBeNull();
    localStorage.setItem('bad', '{"value":1}');
    expect(readLastKnownGood('bad', DAY)).toBeNull();
    localStorage.setItem('garbage', 'not json');
    expect(readLastKnownGood('garbage', DAY)).toBeNull();
  });

  it('keeps a falsy value distinguishable from "nothing stored"', () => {
    writeLastKnownGood('empty', [], 1_000);
    expect(readLastKnownGood('empty', DAY, 1_000)).toEqual([]);
  });

  it('drops an answer to a question asked BEFORE the stored one', () => {
    writeLastKnownGood('k', 'newer', 2_000, 3_000);
    writeLastKnownGood('k', 'stale', 1_000, 3_000);
    expect(readLastKnownGood('k', DAY, 3_000)).toBe('newer');
  });

  it('still overwrites a stored stamp from the future (the clock moved back)', () => {
    writeLastKnownGood('k', 'from-the-future', 10_000, 10_000);
    writeLastKnownGood('k', 'now', 1_000, 1_000);
    expect(readLastKnownGood('k', DAY, 1_000)).toBe('now');
  });
});

describe('isNewAccount', () => {
  const NOW = Date.parse('2026-10-22T12:00:00Z');

  it('is true inside the window and false after it', () => {
    expect(isNewAccount({ id: 'a', created_at: '2026-10-21T12:00:00Z' }, NOW)).toBe(true);
    expect(
      isNewAccount(
        { id: 'a', created_at: new Date(NOW - NEW_ACCOUNT_WINDOW_MS - 1).toISOString() },
        NOW
      )
    ).toBe(false);
  });

  it('treats a missing or unreadable created_at as an established account', () => {
    expect(isNewAccount({ id: 'a' }, NOW)).toBe(false);
    expect(isNewAccount({ id: 'a', created_at: 'garbage' }, NOW)).toBe(false);
  });
});

/**
 * Regression tests for the second reliability pass.
 *
 * Each block covers a defect that lost data silently — no error, no log, and a
 * sync that reported success.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isRetriableError } from '../offlineQueue';
import {
  correctTimestamp,
  getClockOffsetMs,
  observeServerDate,
  resetClockOffset,
  serverNowIso,
} from '../serverClock';

describe('serverClock — a wrong device clock must not silently discard writes', () => {
  // `sync_lww_guard` DROPS an update whose updated_at is older than the stored
  // row and PostgREST reports no error, so a slow device clock made every edit
  // vanish while the push reported success.
  beforeEach(() => {
    resetClockOffset();
    vi.restoreAllMocks();
  });

  it('ignores a healthy clock so normal devices are unaffected', () => {
    const now = Date.now();
    observeServerDate(new Date(now).toUTCString(), now);
    expect(getClockOffsetMs()).toBe(0);
    // No offset means timestamps pass through byte-for-byte.
    expect(correctTimestamp('2026-07-20T10:00:00.000Z')).toBe('2026-07-20T10:00:00.000Z');
  });

  it('detects a device running five minutes slow and corrects forward', () => {
    const deviceNow = Date.now();
    const serverNow = deviceNow + 5 * 60_000;
    observeServerDate(new Date(serverNow).toUTCString(), deviceNow);

    // ~5 minutes, allowing for the round-trip halving and second-resolution header.
    expect(getClockOffsetMs()).toBeGreaterThan(4 * 60_000);
    expect(getClockOffsetMs()).toBeLessThan(6 * 60_000);

    const corrected = new Date(correctTimestamp('2026-07-20T10:00:00.000Z')).getTime();
    const original = new Date('2026-07-20T10:00:00.000Z').getTime();
    expect(corrected).toBeGreaterThan(original);
  });

  it('caps a nonsense measurement so it cannot forge a far-future timestamp', () => {
    // A device (or proxy) claiming the server is a year ahead must not be able to
    // make itself win every future last-write-wins comparison.
    const deviceNow = Date.now();
    observeServerDate(new Date(deviceNow + 365 * 24 * 60 * 60_000).toUTCString(), deviceNow);
    expect(getClockOffsetMs()).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });

  it('drops the correction once the clock is fixed mid-session', () => {
    const deviceNow = Date.now();
    observeServerDate(new Date(deviceNow + 5 * 60_000).toUTCString(), deviceNow);
    expect(getClockOffsetMs()).not.toBe(0);

    const later = Date.now();
    observeServerDate(new Date(later).toUTCString(), later);
    expect(getClockOffsetMs()).toBe(0);
  });

  it('ignores a missing or malformed Date header instead of throwing', () => {
    expect(() => observeServerDate(null, Date.now())).not.toThrow();
    expect(() => observeServerDate('not a date', Date.now())).not.toThrow();
    expect(getClockOffsetMs()).toBe(0);
  });

  it('passes an unparseable timestamp through rather than rewriting it to now', () => {
    const deviceNow = Date.now();
    observeServerDate(new Date(deviceNow + 5 * 60_000).toUTCString(), deviceNow);
    expect(correctTimestamp('garbage')).toBe('garbage');
  });

  it('serverNowIso returns a valid ISO string', () => {
    expect(Number.isNaN(new Date(serverNowIso()).getTime())).toBe(false);
  });
});

describe('isRetriableError — transient database conflicts must be retried', () => {
  it('retries a serialization failure instead of dead-lettering it', () => {
    // 40001 is Postgres asking the caller to retry. The old rule was "any 5-digit
    // SQLSTATE is permanent", which sent a perfectly good write to the
    // dead-letter store where it needed manual recovery from Settings.
    expect(isRetriableError({ code: '40001' })).toBe(true);
  });

  it('retries a deadlock', () => {
    expect(isRetriableError({ code: '40P01' })).toBe(true);
  });

  it('retries capacity and connection failures', () => {
    expect(isRetriableError({ code: '53300' })).toBe(true); // too_many_connections
    expect(isRetriableError({ code: '08006' })).toBe(true); // connection_failure
    expect(isRetriableError({ code: '57014' })).toBe(true); // statement timeout
  });

  it('prefers the SQLSTATE over the HTTP status for a 409', () => {
    // PostgREST answers 409 for BOTH a real unique violation and a serialization
    // conflict. Reading only the status could not tell them apart.
    expect(isRetriableError({ status: 409, code: '40001' })).toBe(true);
    expect(isRetriableError({ status: 409, code: '23505' })).toBe(false);
  });

  it('still treats genuine data errors as permanent', () => {
    expect(isRetriableError({ code: '23505' })).toBe(false); // unique_violation
    expect(isRetriableError({ code: '23502' })).toBe(false); // not_null_violation
    expect(isRetriableError({ code: '22P02' })).toBe(false); // invalid text repr
    expect(isRetriableError({ code: 'PGRST301' })).toBe(false); // RLS
  });

  it('stops burning retries on payloads that can never be accepted', () => {
    // These used to fall through to "retriable" and consume all five attempts
    // plus ~45 minutes of backoff.
    expect(isRetriableError({ status: 413 })).toBe(false);
    expect(isRetriableError({ status: 415 })).toBe(false);
  });

  it('keeps retrying rate limits and server errors', () => {
    expect(isRetriableError({ status: 429 })).toBe(true);
    expect(isRetriableError({ status: 500 })).toBe(true);
    expect(isRetriableError({ status: 503 })).toBe(true);
  });

  it('retries network failures and defaults unknown errors to retriable', () => {
    expect(isRetriableError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isRetriableError({})).toBe(true);
    expect(isRetriableError(null)).toBe(true);
  });
});

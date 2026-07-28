/**
 * Server clock offset — keeps last-write-wins honest on a device whose clock is wrong.
 *
 * ---------------------------------------------------------------------------
 * The failure this exists to prevent
 * ---------------------------------------------------------------------------
 * Every synced row carries a client-generated `updated_at`, and the server guard
 * `sync_lww_guard` (20260726120000_sync_integrity.sql) DROPS an update whose
 * `updated_at` is older than the stored row:
 *
 *     IF v_incoming < v_stored THEN RETURN NULL;
 *
 * `RETURN NULL` in a BEFORE UPDATE trigger discards that row silently. PostgREST
 * reports no error, and the client counts the row as synced. So on a device whose
 * clock is, say, five minutes slow:
 *
 *   1. the user edits a record; the app stamps `updated_at` five minutes in the past
 *   2. the server compares it against the stored timestamp, decides it is stale,
 *      and drops the write
 *   3. the push reports success
 *   4. the next pull overwrites the local row with the older cloud version
 *
 * The edit is gone, nothing failed, and nothing is logged. A wrong device clock is
 * not exotic — a flat battery, a manual timezone fix, or a phone that has not
 * synced NTP is enough, and the 5-minute forge clamp in the DB only caps
 * timestamps from the FUTURE. It does nothing for a slow clock.
 *
 * ---------------------------------------------------------------------------
 * The fix
 * ---------------------------------------------------------------------------
 * Learn the offset between this device and the database once per session and add
 * it to outgoing timestamps. Every server response carries a `Date` header, so
 * the measurement costs nothing extra: it is read off a request the app was going
 * to make anyway.
 *
 * Deliberately conservative:
 *   • Offsets under a tolerance are ignored, so a healthy device keeps using its
 *     own clock and behaviour is unchanged.
 *   • The correction is capped, so a nonsense measurement (a proxy with a broken
 *     clock, a cached response) cannot push timestamps wildly into the future and
 *     make this device win every future merge — the exact abuse the DB clamp
 *     already guards against.
 *   • Round-trip latency is halved out of the estimate, the standard NTP-style
 *     approximation. It does not need to be precise; it needs to stop a
 *     multi-minute skew from silently discarding data.
 */

import { logger } from '../utils/logger';

/**
 * Ignore anything smaller than this. Sub-30s skew is normal and harmless: the
 * guard only drops a write that is older than the STORED row, which for ordinary
 * single-device editing is minutes or hours old.
 */
const TOLERANCE_MS = 30_000;

/**
 * Never shift a timestamp by more than this. Keeps a bogus measurement from
 * turning into a forged-future timestamp that wins every subsequent LWW compare.
 */
const MAX_CORRECTION_MS = 24 * 60 * 60 * 1000;

let offsetMs = 0;
let measured = false;

/**
 * Record a measurement from a server response.
 *
 * @param serverDateHeader the response's `Date` header
 * @param requestStartedAt `Date.now()` from just before the request was sent
 */
export const observeServerDate = (
  serverDateHeader: string | null | undefined,
  requestStartedAt: number
): void => {
  if (!serverDateHeader) return;

  const serverTime = new Date(serverDateHeader).getTime();
  if (Number.isNaN(serverTime)) return;

  const now = Date.now();
  // Halve the round trip: the header was generated somewhere in the middle of it.
  const estimatedServerNow = serverTime + (now - requestStartedAt) / 2;
  const rawOffset = estimatedServerNow - now;

  if (Math.abs(rawOffset) < TOLERANCE_MS) {
    // Healthy clock. Explicitly reset, so a device that gets its time corrected
    // mid-session stops applying a stale correction.
    if (offsetMs !== 0) {
      logger.sync.info('Device clock is back in sync with the server; dropping offset');
    }
    offsetMs = 0;
    measured = true;
    return;
  }

  const clamped = Math.max(-MAX_CORRECTION_MS, Math.min(MAX_CORRECTION_MS, rawOffset));
  if (!measured || Math.abs(clamped - offsetMs) > TOLERANCE_MS) {
    logger.sync.warn('Device clock differs from the server; correcting sync timestamps', {
      offsetSeconds: Math.round(clamped / 1000),
    });
  }
  offsetMs = clamped;
  measured = true;
};

/** Current correction in ms. 0 when the clock is trusted. Diagnostics/tests. */
export const getClockOffsetMs = (): number => offsetMs;

/** Reset learned state. Tests only. */
export const resetClockOffset = (): void => {
  offsetMs = 0;
  measured = false;
};

/**
 * Server-corrected "now" as an ISO string. Use this for any timestamp that the
 * server will compare against another timestamp.
 */
export const serverNowIso = (): string => new Date(Date.now() + offsetMs).toISOString();

/**
 * Correct a timestamp that was generated with this device's clock.
 *
 * Applied to `updated_at` on the way out so an edit made on a slow device is not
 * mistaken for a stale write. Invalid input is passed through untouched rather
 * than replaced, so a malformed value stays visible instead of being silently
 * rewritten to now.
 */
export const correctTimestamp = (iso: string): string => {
  if (offsetMs === 0) return iso;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  return new Date(t + offsetMs).toISOString();
};

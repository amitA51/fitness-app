/**
 * datetime.ts — central, IANA-timezone-aware date/time utility.
 *
 * Single source of truth for "what day is it" and how dates/times are
 * formatted, built ENTIRELY on the native `Intl` API and the `Date` object.
 * No external date library (no date-fns / Luxon / Temporal) — keeps the PWA
 * bundle lean and lets us swap to native `Temporal` later behind these same
 * signatures.
 *
 * Design notes:
 * - Day boundaries are DST-safe because they are derived from
 *   `Intl.DateTimeFormat(..., { timeZone })`, NOT from `Date#setHours`, which
 *   only knows the *device* timezone and breaks across DST and when the user
 *   travels.
 * - Every function is PURE and FAIL-SAFE: on any bad input (invalid Date,
 *   unknown timezone) it falls back to the device timezone and sane defaults
 *   instead of throwing.
 * - No React here — this is plain TS used by services, contexts and UI alike.
 *
 * @see plans/FEATURE-EXPANSION-PLAN.md → "אזורי זמן ותאריכים מותאמים אישית"
 */

/** Locale used for all Hebrew-first display formatting. */
const DEFAULT_LOCALE = 'he-IL' as const;

/** Last-resort timezone when the device/Intl cannot resolve one. */
const FALLBACK_TIME_ZONE = 'UTC' as const;

/** Parsed components of a `YYYY-MM-DD` day key. */
export interface DayKeyParts {
  year: number;
  month: number;
  day: number;
}

/** Zero-pads a number to at least two digits (e.g. 3 → "03"). */
function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

/**
 * Returns `true` when `date` is a usable, non-NaN `Date` instance.
 * Used to guard every public function so callers never get a thrown error.
 */
function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime());
}

/**
 * Resolves the device's IANA timezone, e.g. `"Asia/Jerusalem"`.
 *
 * Falls back to `"UTC"` if `Intl` cannot resolve a zone (extremely rare on
 * modern browsers, but never throws).
 *
 * @returns An IANA timezone identifier.
 */
export function getDeviceTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz || FALLBACK_TIME_ZONE;
  } catch {
    return FALLBACK_TIME_ZONE;
  }
}

/**
 * Validates an IANA timezone string by attempting to construct a formatter
 * with it. Returns the timezone if valid, otherwise the device timezone.
 *
 * Centralising this keeps every other function fail-safe: an unknown or empty
 * `tz` argument degrades gracefully to the device zone rather than throwing.
 *
 * @param tz - Candidate IANA timezone identifier.
 * @returns A timezone guaranteed to be accepted by `Intl`.
 */
export function resolveTimeZone(tz?: string): string {
  if (!tz) return getDeviceTimeZone();
  try {
    // Throws a RangeError for an invalid timeZone — caught below.
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return getDeviceTimeZone();
  }
}

/**
 * Extracts the year/month/day numbers for `date` **as seen in `tz`**.
 *
 * This is the DST-safe primitive the rest of the module builds on: it asks
 * `Intl` for the wall-clock calendar date in the target zone instead of
 * reading the device's local components.
 *
 * @param date - The instant to inspect.
 * @param tz - IANA timezone the calendar date should be read in.
 * @returns `{ year, month (1-12), day (1-31) }` in `tz`.
 */
function getDatePartsInTz(date: Date, tz: string): DayKeyParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  // en-CA formatToParts yields stable numeric year/month/day tokens.
  const parts = fmt.formatToParts(date);
  const lookup = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  return {
    year: lookup('year'),
    month: lookup('month'),
    day: lookup('day'),
  };
}

/**
 * Returns the local-date key (`"YYYY-MM-DD"`) for `date` in the given timezone.
 *
 * DST-safe and travel-safe: unlike `new Date(...).getFullYear()/getMonth()`
 * (device zone) or `date.toISOString().slice(0, 10)` (UTC — mis-keys early
 * Israeli mornings to the previous day), this asks `Intl` for the wall-clock
 * date in `tz`. This is the key every daily log (water, nutrition, body
 * weight) should be stored under.
 *
 * @param date - The instant to key. Invalid dates fall back to "now".
 * @param tz - IANA timezone. Invalid zones fall back to the device zone.
 * @returns A `"YYYY-MM-DD"` string.
 *
 * @example
 * // In Asia/Jerusalem (UTC+3 in summer), 2026-06-08T00:30:00Z is still
 * // the local evening of the 8th, not pushed back to the 7th.
 * dayKeyInTz(new Date('2026-06-08T00:30:00Z'), 'Asia/Jerusalem'); // "2026-06-08"
 */
export function dayKeyInTz(date: Date, tz: string): string {
  const safeDate = isValidDate(date) ? date : new Date();
  const zone = resolveTimeZone(tz);
  const { year, month, day } = getDatePartsInTz(safeDate, zone);
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Convenience: today's day key in the given (or device) timezone. */
export function todayKeyInTz(tz?: string): string {
  return dayKeyInTz(new Date(), resolveTimeZone(tz));
}

/**
 * Computes the timezone's UTC offset, in minutes, at a specific instant.
 *
 * Derived by comparing the wall-clock time the zone reports for `date`
 * against the same instant read as UTC. Because the offset is sampled AT the
 * instant, it is automatically correct on either side of a DST transition.
 *
 * @param date - The instant to measure the offset at.
 * @param tz - IANA timezone (already resolved/validated by the caller).
 * @returns Offset in minutes where positive means ahead of UTC (e.g. +180).
 */
function tzOffsetMinutes(date: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0');
  // Reconstruct the zone's wall-clock as if it were a UTC timestamp, then
  // diff against the real UTC timestamp to recover the offset.
  let hour = get('hour');
  // Intl can emit "24" for midnight in some engines; normalise to 0.
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second')
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

/**
 * Returns the exact instant of **00:00:00.000 local time** for `date`'s day,
 * in the given timezone, as a UTC `Date`.
 *
 * DST-safe: the offset is sampled at the candidate midnight, so the boundary
 * lands on the true local start of day even on spring-forward / fall-back days.
 *
 * @param date - Any instant within the target local day.
 * @param tz - IANA timezone. Invalid zones fall back to the device zone.
 * @returns A `Date` at local midnight of that day.
 */
export function startOfDayInTz(date: Date, tz: string): Date {
  const safeDate = isValidDate(date) ? date : new Date();
  const zone = resolveTimeZone(tz);
  const { year, month, day } = getDatePartsInTz(safeDate, zone);
  // First approximation: treat the local midnight wall-clock as UTC…
  const naiveMidnightUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  // …then correct by the zone's offset at that instant.
  const offset = tzOffsetMinutes(new Date(naiveMidnightUtc), zone);
  return new Date(naiveMidnightUtc - offset * 60000);
}

/**
 * Returns the exact instant of **23:59:59.999 local time** for `date`'s day,
 * in the given timezone, as a UTC `Date`. Computed as the next day's start
 * minus one millisecond, so it is correct across DST boundaries.
 *
 * @param date - Any instant within the target local day.
 * @param tz - IANA timezone. Invalid zones fall back to the device zone.
 * @returns A `Date` at the last representable millisecond of that local day.
 */
export function endOfDayInTz(date: Date, tz: string): Date {
  const start = startOfDayInTz(date, tz);
  // Add ~26h (safely past any DST jump) then snap to that day's start.
  const nextDayProbe = new Date(start.getTime() + 26 * 60 * 60 * 1000);
  const nextStart = startOfDayInTz(nextDayProbe, resolveTimeZone(tz));
  return new Date(nextStart.getTime() - 1);
}

/**
 * Formats the DATE portion of `date` in the given timezone.
 *
 * Defaults to a Hebrew-first, medium-length date (`he-IL`). Pass `opts` to
 * override any `Intl.DateTimeFormat` date option (e.g. `weekday`, `month`).
 * Always pins `timeZone` to the resolved zone so the rendered day matches the
 * day key. Returns `''` for invalid input rather than throwing.
 *
 * @param date - The instant to format.
 * @param tz - IANA timezone. Invalid zones fall back to the device zone.
 * @param opts - Optional `Intl.DateTimeFormat` overrides (incl. `locale`).
 * @returns A localized date string, or `''` if `date` is invalid.
 */
export function formatDate(
  date: Date,
  tz: string,
  opts?: Intl.DateTimeFormatOptions & { locale?: string }
): string {
  if (!isValidDate(date)) return '';
  const zone = resolveTimeZone(tz);
  const { locale, ...rest } = opts ?? {};
  try {
    return new Intl.DateTimeFormat(locale ?? DEFAULT_LOCALE, {
      timeZone: zone,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      ...rest,
    }).format(date);
  } catch {
    return '';
  }
}

/**
 * Formats the TIME portion of `date` in the given timezone.
 *
 * Defaults to Hebrew-first 2-digit hour:minute in 24-hour clock. Pass
 * `opts.hour12` to switch to a 12-hour clock, or any other
 * `Intl.DateTimeFormat` option to refine the output. Returns `''` for invalid
 * input rather than throwing.
 *
 * @param date - The instant to format.
 * @param tz - IANA timezone. Invalid zones fall back to the device zone.
 * @param opts - Optional overrides; `hour12` toggles 12h/24h, `locale` the locale.
 * @returns A localized time string, or `''` if `date` is invalid.
 */
export function formatTime(
  date: Date,
  tz: string,
  opts?: Intl.DateTimeFormatOptions & { locale?: string; hour12?: boolean }
): string {
  if (!isValidDate(date)) return '';
  const zone = resolveTimeZone(tz);
  const { locale, ...rest } = opts ?? {};
  try {
    return new Intl.DateTimeFormat(locale ?? DEFAULT_LOCALE, {
      timeZone: zone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      ...rest,
    }).format(date);
  } catch {
    return '';
  }
}

/**
 * Parses a `"YYYY-MM-DD"` day key into its numeric parts WITHOUT going through
 * `new Date(key)` (which parses bare date strings as **UTC midnight** and then
 * shifts when read in local time — the classic off-by-one-day bug).
 *
 * Invalid or malformed keys fall back to today's parts in the device timezone
 * so callers always receive a usable result.
 *
 * @param key - A `"YYYY-MM-DD"` string.
 * @returns `{ year, month (1-12), day (1-31) }`.
 */
export function parseDayKey(key: string): DayKeyParts {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((key ?? '').trim());
  if (!match) {
    const now = new Date();
    return getDatePartsInTz(now, getDeviceTimeZone());
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/**
 * Builds a `Date` at local midnight for a `"YYYY-MM-DD"` day key in `tz`,
 * avoiding the `new Date("YYYY-MM-DD")` → UTC-midnight pitfall.
 *
 * @param key - A `"YYYY-MM-DD"` string.
 * @param tz - IANA timezone. Invalid zones fall back to the device zone.
 * @returns A `Date` at local midnight of that day in `tz`.
 */
export function dayKeyToStartOfDay(key: string, tz: string): Date {
  const { year, month, day } = parseDayKey(key);
  const zone = resolveTimeZone(tz);
  // Use a UTC-noon probe so the wall-clock date can't slip to an adjacent day
  // before startOfDayInTz re-reads it in the target zone.
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
  return startOfDayInTz(probe, zone);
}

/**
 * Returns `true` when the `"YYYY-MM-DD"` `dayKey` is today in `tz`.
 *
 * Travel/DST-safe replacement for component-wise `Date` comparison.
 *
 * @param dayKey - A `"YYYY-MM-DD"` string.
 * @param tz - IANA timezone. Invalid zones fall back to the device zone.
 * @returns Whether `dayKey` equals today's key in `tz`.
 */
export function isTodayInTz(dayKey: string, tz: string): boolean {
  return dayKey === todayKeyInTz(tz);
}

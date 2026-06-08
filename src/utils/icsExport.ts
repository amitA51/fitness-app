/**
 * icsExport.ts — Pure, dependency-free RFC-5545 (.ics) calendar generator.
 *
 * Produces a valid VCALENDAR string that any calendar app (Google Calendar,
 * Apple Calendar, Outlook, etc.) can import directly — no OAuth, no secrets.
 *
 * Design notes:
 * - Entirely side-effect-free: buildIcsCalendar() is a pure function.
 * - FAIL-SAFE: never throws; empty event list → valid empty VCALENDAR.
 * - downloadIcs() is browser-only and guarded with a typeof check.
 * - RFC-5545 §3.1: lines MUST use CRLF (\r\n).
 * - RFC-5545 §3.3.11 TEXT escaping: backslash, comma, semicolon, newline.
 * - RFC-5545 §3.3.5 DATE-TIME in UTC: yyyymmddThhmmssZ.
 * - RFC-5545 §4.7.2 / 4.6.1: long lines SHOULD be folded at 75 octets;
 *   we fold at 75 to maximise compatibility.
 */

// ============================================================================
// Public types
// ============================================================================

/** A single calendar event to include in the exported .ics file. */
export interface IcsEvent {
  /** Globally unique identifier — use crypto.randomUUID() or a stable id. */
  uid: string;
  /** Event title / summary. */
  title: string;
  /** Event start — Date object or ISO-8601 string. */
  start: Date | string;
  /** Event end — Date object or ISO-8601 string. Defaults to start + 1 hour. */
  end?: Date | string;
  /** Optional free-text description. */
  description?: string;
  /** Optional location string. */
  location?: string;
}

// ============================================================================
// Internal helpers
// ============================================================================

/** Zero-pad a number to two digits. */
function pad2(n: number): string {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

/**
 * Coerce a Date | string to a Date, falling back to `now` on parse failure.
 * Never throws.
 */
function toSafeDate(input: Date | string, fallback: Date): Date {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? fallback : input;
  }
  try {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? fallback : d;
  } catch {
    return fallback;
  }
}

/**
 * Format a Date as a UTC DATE-TIME string per RFC-5545 §3.3.5:
 * `yyyymmddThhmmssZ`
 */
function formatUtcDateTime(d: Date): string {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

/**
 * Escape TEXT property values per RFC-5545 §3.3.11.
 * Order matters: backslash must be escaped before the others.
 */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\r?\n/g, '\\n');
}

/**
 * Fold a long content line at 75 octets per RFC-5545 §3.1.
 * Each continuation line begins with a single SPACE.
 */
function foldLine(line: string): string {
  const LIMIT = 75;
  if (line.length <= LIMIT) return line;
  const chunks: string[] = [];
  let remaining = line;
  // First chunk: up to 75 chars
  chunks.push(remaining.slice(0, LIMIT));
  remaining = remaining.slice(LIMIT);
  // Continuation chunks: indent with space, up to 74 chars each
  while (remaining.length > 0) {
    chunks.push(` ${remaining.slice(0, 74)}`);
    remaining = remaining.slice(74);
  }
  return chunks.join('\r\n');
}

/** Build a single VEVENT block as a CRLF-terminated string. */
function buildVEvent(event: IcsEvent, dtstamp: Date): string {
  const now = dtstamp;
  const startDate = toSafeDate(event.start, now);
  const endDate = event.end
    ? toSafeDate(event.end, new Date(startDate.getTime() + 3_600_000))
    : new Date(startDate.getTime() + 3_600_000);

  const lines: string[] = [
    'BEGIN:VEVENT',
    `UID:${escapeText(event.uid)}`,
    `DTSTAMP:${formatUtcDateTime(now)}`,
    `DTSTART:${formatUtcDateTime(startDate)}`,
    `DTEND:${formatUtcDateTime(endDate)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeText(event.location)}`);
  }

  lines.push('END:VEVENT');

  return lines.map(foldLine).join('\r\n');
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Build a complete RFC-5545 VCALENDAR string from an array of IcsEvent objects.
 *
 * - CRLF line endings throughout (RFC-5545 §3.1).
 * - Long lines folded at 75 octets.
 * - UTC timestamps — no timezone ambiguity.
 * - Empty array → valid VCALENDAR with no VEVENTs.
 * - Never throws.
 */
export function buildIcsCalendar(events: IcsEvent[]): string {
  const dtstamp = new Date();
  const safeEvents = Array.isArray(events) ? events : [];

  const header = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FitnessApp//CoachSchedule//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ].join('\r\n');

  const footer = 'END:VCALENDAR';

  if (safeEvents.length === 0) {
    return `${header}\r\n${footer}\r\n`;
  }

  const vevents = safeEvents.map((e) => buildVEvent(e, dtstamp)).join('\r\n');
  return `${header}\r\n${vevents}\r\nEND:VCALENDAR\r\n`;
}

/**
 * Trigger a browser download of an .ics file.
 *
 * Safe to call unconditionally — no-ops silently when `window` / `Blob` /
 * `URL.createObjectURL` are unavailable (SSR, Node test environment).
 *
 * @param filename - Suggested filename (e.g. `"schedule.ics"`).
 * @param content  - The full VCALENDAR string produced by buildIcsCalendar().
 */
export function downloadIcs(filename: string, content: string): void {
  if (
    typeof window === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined' ||
    typeof URL.createObjectURL !== 'function'
  ) {
    return;
  }

  try {
    const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Revoke after a short delay so the browser can initiate the download.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    // Non-fatal: download silently fails; the user can try again.
  }
}

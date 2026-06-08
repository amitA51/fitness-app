/**
 * datePreferences.ts — user date/time display preferences.
 *
 * Persists how the user wants dates and times shown: their IANA timezone,
 * 12h/24h clock, which day the week starts on, and the date-component order.
 * Storage is `localStorage` under a single JSON key; the server-side mirror
 * (`profiles.timezone` + sibling columns) is a follow-up — see the module's
 * "INTEGRATION NEEDED" notes in the work-stream report.
 *
 * FAIL-SAFE: every read/write is wrapped so a missing/blocked `localStorage`
 * (private mode, SSR, quota) degrades to in-memory defaults instead of
 * throwing. Defaults are Israel-first: device timezone, 24-hour clock, week
 * starting Sunday, day-month-year order.
 *
 * Pairs with `src/utils/datetime.ts`, which does the actual TZ-aware
 * computation; this module only stores the user's chosen knobs and notifies
 * subscribers when they change (a tiny pub/sub, no React dependency).
 */

import { getDeviceTimeZone, resolveTimeZone } from '../utils/datetime';

/** How the three date components are ordered for display. */
export type DateFormat = 'dmy' | 'mdy' | 'ymd';

/** Sunday (Israel default) or Monday as the first day of the week. */
export type FirstDayOfWeek = 0 | 1;

/** User-tunable date/time display preferences. */
export interface DatePreferences {
  /** IANA timezone id, e.g. `"Asia/Jerusalem"`. */
  timeZone: string;
  /** `true` → 12-hour clock with AM/PM; `false` → 24-hour clock. */
  hour12: boolean;
  /** `0` = Sunday (IL default), `1` = Monday. */
  firstDayOfWeek: FirstDayOfWeek;
  /** Order of date components for display formatting. */
  dateFormat: DateFormat;
}

/** Listener invoked with the new preferences after any change. */
export type DatePreferencesListener = (prefs: DatePreferences) => void;

/** localStorage key holding the serialized {@link DatePreferences}. */
const STORAGE_KEY = 'date_prefs';

const VALID_DATE_FORMATS: readonly DateFormat[] = ['dmy', 'mdy', 'ymd'];

/**
 * Builds the default preferences: device timezone, 24h clock, week starts
 * Sunday, day-month-year order. Computed lazily so the device timezone is
 * resolved at call time, not at module load.
 */
function buildDefaults(): DatePreferences {
  return {
    timeZone: getDeviceTimeZone(),
    hour12: false,
    firstDayOfWeek: 0,
    dateFormat: 'dmy',
  };
}

/** Subscribers notified whenever preferences change. */
const listeners = new Set<DatePreferencesListener>();

/**
 * In-memory cache of the current preferences. Acts as the source of truth once
 * loaded so reads are cheap and work even if `localStorage` later fails.
 */
let cached: DatePreferences | null = null;

/**
 * Coerces an arbitrary parsed value into a valid {@link DatePreferences},
 * filling any missing/invalid field from the defaults. Never throws.
 *
 * @param raw - Untrusted value (e.g. JSON parsed from storage).
 * @returns A fully-populated, validated preferences object.
 */
function normalize(raw: unknown): DatePreferences {
  const defaults = buildDefaults();
  if (typeof raw !== 'object' || raw === null) return defaults;

  const obj = raw as Record<string, unknown>;

  const timeZone =
    typeof obj.timeZone === 'string' && obj.timeZone.length > 0
      ? resolveTimeZone(obj.timeZone)
      : defaults.timeZone;

  const hour12 = typeof obj.hour12 === 'boolean' ? obj.hour12 : defaults.hour12;

  const firstDayOfWeek: FirstDayOfWeek =
    obj.firstDayOfWeek === 0 || obj.firstDayOfWeek === 1
      ? obj.firstDayOfWeek
      : defaults.firstDayOfWeek;

  const dateFormat: DateFormat = VALID_DATE_FORMATS.includes(obj.dateFormat as DateFormat)
    ? (obj.dateFormat as DateFormat)
    : defaults.dateFormat;

  return { timeZone, hour12, firstDayOfWeek, dateFormat };
}

/**
 * Safely reads and parses the persisted preferences from `localStorage`.
 * Returns defaults on any failure (unavailable storage, malformed JSON).
 */
function readFromStorage(): DatePreferences {
  try {
    if (typeof localStorage === 'undefined') return buildDefaults();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildDefaults();
    return normalize(JSON.parse(raw) as unknown);
  } catch {
    return buildDefaults();
  }
}

/**
 * Safely writes preferences to `localStorage`. Swallows quota/availability
 * errors — the in-memory cache still reflects the change so the UI stays
 * consistent even when persistence fails.
 */
function writeToStorage(prefs: DatePreferences): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Persistence is best-effort; ignore (private mode, quota, SSR).
  }
}

/**
 * Returns the current date/time preferences.
 *
 * Loads from `localStorage` on first call (then caches in memory). Always
 * returns a complete, validated object — never `null`, never throws.
 *
 * @returns The active {@link DatePreferences}.
 */
export function getDatePreferences(): DatePreferences {
  if (cached === null) {
    cached = readFromStorage();
  }
  return cached;
}

/**
 * Applies a partial update to the preferences, persists it, and notifies all
 * subscribers with the new full object.
 *
 * Immutable: produces a new object rather than mutating the cached one, and
 * re-validates so a bad patch value falls back to the previous/default value.
 *
 * @param patch - The subset of fields to change.
 * @returns The updated, validated {@link DatePreferences}.
 */
export function setDatePreferences(patch: Partial<DatePreferences>): DatePreferences {
  const current = getDatePreferences();
  const next = normalize({ ...current, ...patch });
  cached = next;
  writeToStorage(next);
  notify(next);
  return next;
}

/**
 * Subscribes to preference changes.
 *
 * @param listener - Called with the new preferences after each change.
 * @returns An unsubscribe function; call it to stop receiving updates.
 *
 * @example
 * const off = onDatePreferencesChange((prefs) => refreshUi(prefs));
 * // later…
 * off();
 */
export function onDatePreferencesChange(listener: DatePreferencesListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Notifies every subscriber, isolating individual listener failures. */
function notify(prefs: DatePreferences): void {
  for (const listener of listeners) {
    try {
      listener(prefs);
    } catch {
      // A throwing subscriber must not break others or the setter.
    }
  }
}

/**
 * Resets preferences back to defaults (device tz, 24h, Sunday, dmy), persists,
 * and notifies. Primarily for tests and a "restore defaults" affordance.
 *
 * @returns The freshly reset {@link DatePreferences}.
 */
export function resetDatePreferences(): DatePreferences {
  const defaults = buildDefaults();
  cached = defaults;
  writeToStorage(defaults);
  notify(defaults);
  return defaults;
}

// restDays — Apple-style planned rest days that do NOT break the streak.
//
// Research basis (You.com, Aug 2026): Apple Watch added "designate rest days
// and keep your streak alive". Punishing streaks collapse motivation the moment
// real life intervenes (Yu-kai Chou: fear-of-loss mechanics alone burn out).
// A declared rest day bridges the calendar gap instead of killing the run.
//
// Storage: one localStorage key holding a JSON array of local YYYY-MM-DD keys.
// Marking a day that later gets a workout is harmless — a rest day only ever
// BRIDGES a gap; it never adds to the count.

import { useSyncExternalStore } from 'react';
import { logger } from './logger';

const REST_DAYS_KEY = 'workout_rest_days';
const REST_DAYS_EVENT = 'restdays-changed';

/** Bumped on every ledger mutation so useSyncExternalStore snapshots change. */
let ledgerVersion = 0;

function emitChange(): void {
  ledgerVersion++;
  try {
    window.dispatchEvent(new Event(REST_DAYS_EVENT));
  } catch {
    // Non-browser environment — version bump alone still triggers re-render.
  }
}

/**
 * Re-renders the caller whenever the rest-day ledger changes anywhere
 * (WeeklyGrid toggle, future settings surface, another tab via storage event).
 */
export function useRestDaysVersion(): number {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(REST_DAYS_EVENT, onStoreChange);
      const onStorage = (e: StorageEvent): void => {
        if (e.key === REST_DAYS_KEY) onStoreChange();
      };
      window.addEventListener('storage', onStorage);
      return () => {
        window.removeEventListener(REST_DAYS_EVENT, onStoreChange);
        window.removeEventListener('storage', onStorage);
      };
    },
    () => ledgerVersion
  );
}

/** Local-time `YYYY-MM-DD` key — matches the streak math's day format. */
export function toRestDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function readArray(): string[] {
  try {
    const raw = localStorage.getItem(REST_DAYS_KEY);
    const parsed = raw === null ? [] : (JSON.parse(raw) as unknown);
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === 'string') : [];
  } catch {
    return [];
  }
}

export function getRestDays(): ReadonlySet<string> {
  return new Set(readArray());
}

export function isRestDay(dayKey: string): boolean {
  return readArray().includes(dayKey);
}

/** Declare `dayKey` a planned rest day. Idempotent. */
export function addRestDay(dayKey: string): void {
  const days = readArray();
  if (!days.includes(dayKey)) {
    try {
      // Bounded ledger: distant-past entries are dead weight.
      localStorage.setItem(REST_DAYS_KEY, JSON.stringify([...days, dayKey].slice(-400)));
      emitChange();
    } catch (err) {
      logger.app.warn('Failed to persist rest day', err);
    }
  }
}

export function removeRestDay(dayKey: string): void {
  try {
    localStorage.setItem(REST_DAYS_KEY, JSON.stringify(readArray().filter((d) => d !== dayKey)));
    emitChange();
  } catch (err) {
    logger.app.warn('Failed to remove rest day', err);
  }
}

/**
 * Streak math over workout days + rest-day bridges.
 *
 * Walks backward from the anchor (latest workout day, or yesterday when the
 * latest workout was yesterday — preserving the existing "today unlogged is
 * still alive" grace). A day sustains the streak when it has a WORKOUT (and
 * counts +1); a REST day bridges silently (no count). Any other day ends the
 * walk. When the anchor is yesterday, today itself is an implicit grace day —
 * matching computeStreak's behavior exactly.
 */
export function computeStreakWithRests(
  workoutDays: ReadonlySet<string>,
  restDays: ReadonlySet<string>,
  now: Date
): { currentStreak: number; longestStreak: number } {
  if (workoutDays.size === 0) return { currentStreak: 0, longestStreak: 0 };

  const parse = (key: string): Date => {
    const [y, m, d] = key.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, d);
  };
  const dayDiff = (a: Date, b: Date): number => Math.round((a.getTime() - b.getTime()) / 86400000);

  const sortedAsc = Array.from(workoutDays).sort();
  const latest = parse(sortedAsc[sortedAsc.length - 1] as string);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  // Anchor mirrors computeStreak: today when trained today, else yesterday.
  const anchor = latest.getTime() === yesterday.getTime() ? yesterday : today;

  // ── Current streak: walk backward from anchor ────────────────────────────
  // A day sustains the walk when it has a WORKOUT (counts +1), is a declared
  // REST day (silent bridge), or is today itself (grace — "not trained yet
  // today" never kills the run, matching the pre-rest-days semantics).
  let currentStreak = 0;
  const cursor = new Date(anchor);
  for (let guard = 0; guard < 36500; guard++) {
    const key = toRestDayKey(cursor);
    if (workoutDays.has(key)) {
      currentStreak++;
    } else if (!(restDays.has(key) || cursor.getTime() === today.getTime())) {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  // ── Longest streak: runs where gaps contain ONLY rest days ───────────────
  let longestStreak = 0;
  let run = 0;
  let prev: Date | null = null;
  for (const key of sortedAsc) {
    const curr = parse(key);
    if (prev === null) {
      run = 1;
    } else {
      const diff = dayDiff(curr, prev);
      if (diff === 1) {
        run++;
      } else {
        // Every intermediate day must be a declared rest day to bridge.
        let bridged = true;
        for (let i = 1; i < diff; i++) {
          const mid = new Date(prev);
          mid.setDate(prev.getDate() + i);
          if (!restDays.has(toRestDayKey(mid))) {
            bridged = false;
            break;
          }
        }
        run = bridged ? run + 1 : 1;
      }
    }
    prev = curr;
    longestStreak = Math.max(longestStreak, run);
  }

  return { currentStreak, longestStreak };
}

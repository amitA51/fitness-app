// Small text helpers shared by the running-coach screens. Pure strings; the
// callers render numbers inside `.kinetic-number` / dir="ltr" spans.

import type { FinishVerdict } from '../../../services/running';
import { formatPace } from '../../../utils/cardio';
import { HEBREW_MONTHS } from '../../../utils/dateUtils';

/** "6:15–7:21" — fast edge first, the way a pace range is read. */
export function paceRangeText(fastSec: number, slowSec: number): string {
  const fast = formatPace(fastSec);
  const slow = formatPace(slowSec);
  if (!fast || !slow) return fast ?? slow ?? '';
  return fast === slow ? fast : `${fast}–${slow}`;
}

/** Time to the goal date in plain words; far dates in weeks. */
export function daysLeftText(days: number): string {
  if (days <= 0) return 'היום';
  if (days === 1) return 'מחר';
  if (days === 2) return 'עוד יומיים';
  if (days > 28) return `עוד ${Math.round(days / 7)} שבועות`;
  return `עוד ${days} ימים`;
}

/** How long ago, for "the last long run was …". */
export function daysAgoText(days: number): string {
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days === 2) return 'שלשום';
  return `לפני ${days} ימים`;
}

/** "12 בדצמבר", with the year when it is not this year. */
export function hebrewDayMonth(isoDate: string, now: Date = new Date()): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  const month = HEBREW_MONTHS[m - 1];
  if (!month || !d) return isoDate;
  return y === now.getFullYear() ? `${d} ב${month}` : `${d} ב${month} ${y}`;
}

/** Today as YYYY-MM-DD in local time (for `<input type="date" min>`). */
export function todayIso(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const VERDICT_LABELS: Readonly<Record<FinishVerdict, string>> = {
  on_track: 'בהישג יד',
  close: 'קרוב',
  stretch: 'עוד עבודה',
};

export const VERDICT_TONE: Readonly<Record<FinishVerdict, 'good' | 'neutral' | 'warn'>> = {
  on_track: 'good',
  close: 'neutral',
  stretch: 'warn',
};

/** Easy-running guideline: 75–80% of running time (Seiler; see knowledge.ts). */
export const EASY_SHARE_GUIDE = { low: 0.75, high: 0.8 } as const;

/** Top of the easy heart-rate range, as a share of HRmax (as in nextRun / the AI brief). */
export const EASY_HR_TOP = 0.78;

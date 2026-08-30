import { pluralizeHe } from './pluralizeHe';

/**
 * Returns the start of the calendar week containing `d`, at local midnight.
 * Weeks start on SUNDAY (יום ראשון) — the Israeli week — so a Sunday workout
 * counts toward the new week, not the previous one.
 */
export const getWeekStart = (d: Date) => {
  const t = new Date(d);
  t.setDate(t.getDate() - t.getDay());
  t.setHours(0, 0, 0, 0);
  return t;
};

export const getWeekEnd = (weekStart: Date) => {
  const t = new Date(weekStart);
  t.setDate(t.getDate() + 6);
  return t;
};

export const getWeekNumber = (d: Date) => {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
};

export const fmtDate = (d: string) => {
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return '';
  if (isToday(d)) return 'היום';
  // Compare on calendar days normalized to local midnight, not raw 24h windows,
  // so a late-evening "yesterday" entry isn't mislabelled and future dates
  // (negative diffs) fall through to an absolute date instead of "לפני -N ימים".
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diff = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(parsed).getTime()) / 86400000
  );
  if (diff === 1) return 'אתמול';
  if (diff > 1 && diff < 7) return `לפני ${diff} ימים`;
  return parsed.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
};

export const isToday = (d: string) => {
  const date = new Date(d);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'לילה טוב';
  if (h < 12) return 'בוקר טוב';
  if (h < 17) return 'צהריים טובים';
  if (h < 21) return 'ערב טוב';
  return 'לילה טוב';
};

export const todayHe = () =>
  new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

export const pad2 = (n: number) => String(Math.max(0, Math.floor(n))).padStart(2, '0');

/**
 * Returns today's date as a `YYYY-MM-DD` string in the user's LOCAL timezone.
 *
 * NOTE: This deliberately uses local date components instead of
 * `new Date().toISOString().split('T')[0]` (UTC). For users ahead of UTC
 * (e.g. Israel, UTC+2/+3), the UTC approach mis-keys early-morning entries
 * (local 00:00–03:00) to the previous calendar day. Local date matches what
 * the user actually means by "today" and keeps date-keyed logs (water,
 * nutrition, body weight) on the correct day.
 */
export const todayStr = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/**
 * Returns a `YYYY-MM-DD` string for the given Date in the user's LOCAL timezone.
 * Use this instead of `date.toISOString().split('T')[0]` or `.slice(0,10)` which
 * produce UTC dates and mis-key entries for users ahead of UTC (e.g. Israel 00:00–03:00).
 */
export const toLocalDateStr = (date: Date): string =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const DAYS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'] as const;

export const MONO_STYLE: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.22em',
};

export const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'] as const;
export const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
] as const;

export function formatHebrewDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const day = HEBREW_DAYS[date.getDay()];
  const month = HEBREW_MONTHS[date.getMonth()];
  return `יום ${day}, ${date.getDate()} ${month}`;
}

export function formatHebrewTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Minute forms for `pluralizeHe`. Feminine — "דקה אחת", not "דקה אחד".
 * Declared here rather than in HE_NOUNS because duration is the only surface
 * that counts minutes; the agreement MECHANISM is still the shared one.
 */
const HE_MINUTE = { one: 'דקה', many: 'דקות', oneWord: 'אחת' } as const;

/**
 * Human Hebrew duration label from a duration in SECONDS.
 *
 * GRAMMAR ONLY — the arithmetic is unchanged: sub-hour rounds to whole minutes,
 * an hour-plus floors to hours and rounds the remainder. Hebrew keeps the noun
 * SINGULAR at a cardinal of one, which the previous hardcoded plural got wrong
 * in both directions: 69s rendered "1 דקות" ("1 minutes") and 1h30m rendered
 * "1 שעה" where Hebrew wants a bare "שעה".
 *
 * - 69s      → "דקה אחת"      (singular, no numeral)
 * - 1800s    → "30 דקות"
 * - 3600s    → "שעה"          (bare — Hebrew does not say "one hour")
 * - 7200s    → "שעתיים"       (the Hebrew DUAL, not "2 שעות")
 * - 10800s   → "3 שעות"
 * - 3660s    → "שעה ודקה"     (vav attaches directly to a word)
 * - 5400s    → "שעה ו-30 דקות" (vav takes a HYPHEN before a numeral)
 */
export function formatDuration(seconds: number): string {
  if (seconds < 3600) return pluralizeHe(Math.round(seconds / 60), HE_MINUTE);
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  const hoursLabel = h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${h} שעות`;
  if (m === 0) return hoursLabel;
  // The vav conjunction attaches to a word ("ודקה") but hyphenates before a
  // numeral ("ו-30"), so the two branches genuinely differ.
  return m === 1 ? `${hoursLabel} ודקה` : `${hoursLabel} ו-${m} דקות`;
}

export function formatDurationCompact(seconds: number): string {
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

export function formatVolume(volume: number): string {
  if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`;
  return volume.toLocaleString();
}

export function formatDateISO(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const y = String(date.getFullYear()).slice(2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${d}.${m}.${y}`;
}

// ============================================================================
// Cardio context — the running / cardio part of the AI coach's context
// ============================================================================
// The AI context was built from lifting volume and 1RM alone, so a trainee who
// ran 30 km a week read as "inactive" (weekly volume 0 kg). This module sums the
// last four weeks of cardio per discipline — distance, time, number of efforts —
// plus the run pace and its direction, the longest run, and the long-run spike
// warning (a run more than 10% longer than the longest of the 30 days before it;
// see utils/cardio/math.ts for the source). Every number is computed here; the
// model only phrases them. Pure: `now` is a parameter.

import type { WorkoutSession } from '../../types';
import {
  type CardioDiscipline,
  type DatedEffort,
  UNIT_KM,
  UNIT_M,
  UNIT_PACE_KM,
  datedEfforts,
  formatKm,
  formatMeters,
  formatPace,
  longRunSpike,
  longestInPrior30Days,
} from '../../utils/cardio';
import { toLocalDateStr } from '../../utils/dateUtils';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The summary window — the same 28 days the training-load baseline reads. */
export const CARDIO_WINDOW_DAYS = 28;
/** The acute week, matching the weekly-volume figures beside it. */
const ACUTE_DAYS = 7;
/** Runs needed before a pace direction is claimed (two in each half). */
const MIN_RUNS_FOR_PACE_DIRECTION = 4;
/** A pace change smaller than this fraction of the older pace reads as steady. */
const PACE_STEADY_FRACTION = 0.02;
/** Shorter runs have no meaningful pace (the same floor as runPaceTrend). */
const MIN_PACE_RUN_KM = 1;

/** Display order — the common disciplines first. */
const DISCIPLINE_ORDER: readonly CardioDiscipline[] = [
  'running',
  'walking',
  'cycling',
  'swimming',
  'rowing',
  'other',
];

const DISCIPLINE_LABEL: Readonly<Record<CardioDiscipline, string>> = {
  running: 'ריצה',
  walking: 'הליכה',
  cycling: 'רכיבה',
  swimming: 'שחייה',
  rowing: 'חתירה',
  other: 'אירובי אחר',
};

/** The pool and the rower are written in metres, like the log sheet does. */
const METRE_DISCIPLINES: ReadonlySet<CardioDiscipline> = new Set(['swimming', 'rowing']);

export interface CardioTotals {
  efforts: number;
  distanceKm: number;
  durationSec: number;
}

export interface CardioDisciplineTotals extends CardioTotals {
  discipline: CardioDiscipline;
}

export type PaceDirection = 'faster' | 'slower' | 'steady';

export interface RunPace {
  /** Distance-weighted average of the window's runs, seconds per km. */
  avgSecPerKm: number;
  runs: number;
  /** Newer half of the runs against the older half; null below 4 runs. */
  direction: PaceDirection | null;
  /** Newer minus older pace, s/km, rounded (negative = faster). */
  changeSecPerKm: number | null;
}

export interface RunMark {
  distanceKm: number;
  durationSec: number;
  daysAgo: number;
}

export interface LongRunSpikeWarning extends RunMark {
  /** Longest run of the 30 days before this one, km. */
  priorLongestKm: number;
  /** How much longer, percent (23 = 23% longer). */
  overPercent: number;
}

export interface CardioSummary {
  /** All cardio of the last 7 days — the week the weekly-volume figure covers. */
  last7Days: CardioTotals;
  /** Totals of the 28-day window, one row per discipline that has any effort. */
  disciplines: CardioDisciplineTotals[];
  runPace: RunPace | null;
  longestRun: RunMark | null;
  longRunSpike: LongRunSpikeWarning | null;
}

/** YYYY-MM-DD of `days` days before `now`, local — the way trainingLoad cuts weeks. */
function dayKeyBefore(now: Date, days: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return toLocalDateStr(d);
}

function localMidnight(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m || 1) - 1, d || 1).getTime();
}

function daysAgoOf(effort: DatedEffort, now: Date): number {
  const diff = localMidnight(toLocalDateStr(now)) - localMidnight(effort.date);
  return Math.max(0, Math.round(diff / DAY_MS));
}

function totalsOf(efforts: readonly DatedEffort[]): CardioTotals {
  return efforts.reduce<CardioTotals>(
    (acc, e) => ({
      efforts: acc.efforts + 1,
      distanceKm: acc.distanceKm + e.distanceKm,
      durationSec: acc.durationSec + e.durationSec,
    }),
    { efforts: 0, distanceKm: 0, durationSec: 0 }
  );
}

/** Total time over total distance — a long run weighs more than a short one. */
function paceOf(runs: readonly DatedEffort[]): number {
  const t = totalsOf(runs);
  return t.durationSec / t.distanceKm;
}

function runPaceOf(runs: readonly DatedEffort[]): RunPace | null {
  const paced = runs.filter((e) => e.distanceKm >= MIN_PACE_RUN_KM && e.durationSec > 0);
  if (paced.length === 0) return null;
  const avgSecPerKm = paceOf(paced);
  if (paced.length < MIN_RUNS_FOR_PACE_DIRECTION) {
    return { avgSecPerKm, runs: paced.length, direction: null, changeSecPerKm: null };
  }
  const half = Math.floor(paced.length / 2);
  const older = paceOf(paced.slice(0, half));
  const change = paceOf(paced.slice(half)) - older;
  let direction: PaceDirection = 'steady';
  if (Math.abs(change) >= older * PACE_STEADY_FRACTION)
    direction = change < 0 ? 'faster' : 'slower';
  return { avgSecPerKm, runs: paced.length, direction, changeSecPerKm: Math.round(change) };
}

function markOf(run: DatedEffort, now: Date): RunMark {
  return { distanceKm: run.distanceKm, durationSec: run.durationSec, daysAgo: daysAgoOf(run, now) };
}

function longestRunOf(runs: readonly DatedEffort[], now: Date): RunMark | null {
  let longest: DatedEffort | null = null;
  for (const run of runs) {
    // `>=` so a tie goes to the more recent run (runs are oldest first).
    if (run.distanceKm > 0 && (longest === null || run.distanceKm >= longest.distanceKm)) {
      longest = run;
    }
  }
  return longest ? markOf(longest, now) : null;
}

/** A long-run spike is worth mentioning for this many days after the run. */
const SPIKE_RELEVANT_DAYS = 7;

function spikeOf(
  sessions: readonly WorkoutSession[],
  runs: readonly DatedEffort[],
  now: Date
): LongRunSpikeWarning | null {
  // Runs are oldest first; the latest one with a distance is the last match.
  let latest: DatedEffort | null = null;
  for (const run of runs) if (run.distanceKm > 0) latest = run;
  if (!latest) return null;
  // A spike is a warning about THIS week's legs; three weeks later it is history
  // and repeating it in every prompt would make the coach nag.
  if (now.getTime() - latest.at > SPIKE_RELEVANT_DAYS * 24 * 60 * 60 * 1000) return null;
  const priorLongestKm = longestInPrior30Days(sessions, latest.at, 'running');
  const over = longRunSpike(latest.distanceKm, priorLongestKm);
  if (over === null || priorLongestKm === null) return null;
  return { ...markOf(latest, now), priorLongestKm, overPercent: Math.round(over * 100) };
}

/**
 * The cardio of the last 28 days, or null when there was none — so a trainee
 * who only lifts gets no cardio heading at all.
 */
export function buildCardioSummary(
  sessions: readonly WorkoutSession[],
  now: Date = new Date()
): CardioSummary | null {
  const todayKey = toLocalDateStr(now);
  const windowStart = dayKeyBefore(now, CARDIO_WINDOW_DAYS);
  const acuteStart = dayKeyBefore(now, ACUTE_DAYS);
  const efforts = datedEfforts(sessions).filter((e) => e.date >= windowStart && e.date <= todayKey);
  if (efforts.length === 0) return null;

  const runs = efforts.filter((e) => e.discipline === 'running');
  return {
    last7Days: totalsOf(efforts.filter((e) => e.date >= acuteStart)),
    disciplines: DISCIPLINE_ORDER.map((discipline) => ({
      discipline,
      ...totalsOf(efforts.filter((e) => e.discipline === discipline)),
    })).filter((d) => d.efforts > 0),
    runPace: runPaceOf(runs),
    longestRun: longestRunOf(runs, now),
    longRunSpike: spikeOf(sessions, runs, now),
  };
}

// ---------------------------------------------------------------------------
// Hebrew lines for the prompt
// ---------------------------------------------------------------------------

const effortsText = (n: number): string => (n === 1 ? 'אימון אחד' : `${n} אימונים`);
const runsText = (n: number): string => (n === 1 ? 'ריצה אחת' : `${n} ריצות`);
const minutesText = (sec: number): string => `${Math.round(sec / 60)} דק׳`;
const kmText = (km: number): string => `${formatKm(km)} ${UNIT_KM}`;

/** "3 אימונים, 145 דק׳" — a week of cardio in one phrase, for short prose. */
export const cardioTotalsText = (t: CardioTotals): string =>
  `${effortsText(t.efforts)}, ${minutesText(t.durationSec)}`;

function distanceText(discipline: CardioDiscipline, km: number): string {
  return METRE_DISCIPLINES.has(discipline) ? `${formatMeters(km * 1000)} ${UNIT_M}` : kmText(km);
}

function daysAgoText(days: number): string {
  if (days <= 0) return 'היום';
  if (days === 1) return 'אתמול';
  if (days === 2) return 'לפני יומיים';
  return `לפני ${days} ימים`;
}

function paceLine(pace: RunPace): string {
  const avg = formatPace(pace.avgSecPerKm);
  if (!avg) return '';
  let line = `• קצב ריצה ממוצע: ${avg} ${UNIT_PACE_KM} על פני ${runsText(pace.runs)}`;
  const seconds = Math.abs(pace.changeSecPerKm ?? 0);
  if (pace.direction === 'steady') line += ' | מגמה: יציב';
  if (pace.direction === 'faster' || pace.direction === 'slower') {
    const word = pace.direction === 'faster' ? 'מהיר' : 'איטי';
    line += ` | מגמה: ${word} יותר ב-${seconds} שניות לק״מ (הריצות האחרונות מול הקודמות)`;
  }
  return line;
}

/**
 * The cardio block of the prompt: totals per discipline, run pace, longest run,
 * the spike warning, and a note that tells the model cardio is training even
 * though it adds 0 kg. Empty string when there is no summary.
 */
export function describeCardioForPrompt(summary: CardioSummary | null): string {
  if (!summary) return '';
  const lines = ['--- אירובי ב-4 השבועות האחרונים (חישוב מתמטי) ---'];
  const week = summary.last7Days;
  lines.push(
    week.efforts > 0
      ? `• 7 הימים האחרונים: ${effortsText(week.efforts)} | ${minutesText(week.durationSec)}`
      : '• 7 הימים האחרונים: אין אימוני אירובי'
  );
  for (const d of summary.disciplines) {
    const parts = [effortsText(d.efforts)];
    if (d.distanceKm > 0) parts.push(distanceText(d.discipline, d.distanceKm));
    parts.push(minutesText(d.durationSec));
    lines.push(`• ${DISCIPLINE_LABEL[d.discipline]}: ${parts.join(' | ')}`);
  }
  if (summary.runPace) {
    const line = paceLine(summary.runPace);
    if (line) lines.push(line);
  }
  if (summary.longestRun) {
    const r = summary.longestRun;
    lines.push(
      `• הריצה הארוכה ביותר: ${kmText(r.distanceKm)} ב-${minutesText(r.durationSec)}, ${daysAgoText(r.daysAgo)}`
    );
  }
  if (summary.longRunSpike) {
    const s = summary.longRunSpike;
    lines.push(
      `• אזהרה — קפיצה בריצה ארוכה: הריצה האחרונה (${kmText(s.distanceKm)}, ${daysAgoText(s.daysAgo)}) ארוכה ב-${s.overPercent}% מהריצה הארוכה ביותר ב-30 הימים שלפניה (${kmText(s.priorLongestKm)}). קפיצה כזו קשורה לסיכון גבוה יותר לפציעה.`
    );
  }
  lines.push(
    'הערה: אימוני אירובי נמדדים במרחק, בזמן ובקצב ולא בק״ג, ולכן אינם נכללים בנפח השבועי, בציוני העייפות והמוכנות ובנתוני השרירים שלמעלה. נפח 0 ק״ג בשבוע עם אירובי אינו שבוע מנוחה ואינו חוסר באימונים.'
  );
  return lines.join('\n');
}

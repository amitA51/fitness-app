// ============================================================================
// CLIENT PROGRESS REPORT — pure metric helpers (Fresh Steel / Obsidian)
// ============================================================================
// Date-window aggregates for the printable 30-day progress report
// (ClientReport.tsx). Pure functions only — no fetching, no clock side
// effects beyond the injectable `now` — so they stay unit-testable.

import { type CardioPeriodTotal, summarizeCardio } from '../../../services/coach/coachAnalytics';
import type { NutritionLog, PersonalRecordRow } from '../../../services/supabaseSyncMappers';
import type { BodyWeightEntry, CardioActivity, WorkoutSession } from '../../../types';
import type { Assignment } from '../../../types/coach';
import {
  CARDIO_DISCIPLINE_LABELS,
  type CardioDiscipline,
  type ValueWithUnit,
  cardioDistance,
  formatClock,
} from '../../../utils/cardio';
import { HE_NOUNS, pluralizeHe } from '../../../utils/pluralizeHe';

/** Inclusive local-date window; both ends are YYYY-MM-DD strings. */
export interface ReportRange {
  from: string;
  to: string;
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Local YYYY-MM-DD (no UTC conversion — keeps the day boundary local). */
export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Trailing window of `days` days ending today (inclusive on both ends). */
export function buildReportRange(days = 30, now: Date = new Date()): ReportRange {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  return { from: toLocalDateKey(from), to: toLocalDateKey(now) };
}

/** Is a row date (YYYY-MM-DD or full ISO — only the date part counts) in range? */
export function isInRange(date: string | null | undefined, range: ReportRange): boolean {
  if (!date) return false;
  const key = date.slice(0, 10);
  return key >= range.from && key <= range.to;
}

// ---- Training ---------------------------------------------------------------

export interface TrainingSummary {
  sessionCount: number;
  /** Sum of session totalVolume (kg) inside the range. */
  totalVolume: number;
}

export function computeTrainingSummary(
  sessions: readonly WorkoutSession[],
  range: ReportRange
): TrainingSummary {
  let sessionCount = 0;
  let totalVolume = 0;
  for (const s of sessions) {
    if (!isInRange(s.date || s.startTime, range)) continue;
    sessionCount += 1;
    totalVolume += Number.isFinite(s.totalVolume) ? s.totalVolume : 0;
  }
  return { sessionCount, totalVolume };
}

// ---- Cardio -------------------------------------------------------------------

/** Cardio per discipline inside the range — runs, walks, rides, treadmill blocks. */
export function computeCardioSummary(
  sessions: readonly WorkoutSession[],
  range: ReportRange
): CardioPeriodTotal[] {
  return summarizeCardio(sessions, (e) => isInRange(e.date, range));
}

interface DisciplineCopy {
  /** Activity whose distance unit the discipline reports in (km, or m in the pool). */
  unitOf: CardioActivity;
  /** What one effort is called when counted: "3 ריצות", "2 אימונים". */
  noun: { one: string; many: string; oneWord: string };
}

const DISCIPLINE_COPY: Record<CardioDiscipline, DisciplineCopy> = {
  running: { unitOf: 'run', noun: { one: 'ריצה', many: 'ריצות', oneWord: 'אחת' } },
  walking: { unitOf: 'walk', noun: { one: 'הליכה', many: 'הליכות', oneWord: 'אחת' } },
  cycling: { unitOf: 'cycle', noun: { one: 'רכיבה', many: 'רכיבות', oneWord: 'אחת' } },
  rowing: { unitOf: 'row', noun: HE_NOUNS.workout },
  swimming: { unitOf: 'swim', noun: HE_NOUNS.workout },
  other: { unitOf: 'other', noun: HE_NOUNS.workout },
};

/** One discipline's period total, split so the numbers can render LTR. */
export interface CardioTotalParts {
  label: string;
  distance: ValueWithUnit | null;
  /** "ב־3 ריצות" / "בריצה אחת". */
  countText: string;
  /** Total moving time "1:42:10", or null when only distance was logged. */
  clock: string | null;
}

export function cardioTotalParts(total: CardioPeriodTotal): CardioTotalParts {
  const copy = DISCIPLINE_COPY[total.discipline];
  const counted = pluralizeHe(total.count, copy.noun);
  return {
    label: CARDIO_DISCIPLINE_LABELS[total.discipline],
    distance: cardioDistance(copy.unitOf, total.distanceKm),
    // The prefix joins a word directly ("בריצה") and a numeral with a maqaf ("ב־3").
    countText: total.count === 1 ? `ב${counted}` : `ב־${counted}`,
    clock: total.durationSec > 0 ? formatClock(total.durationSec) : null,
  };
}

/** "ריצה: 18.4 ק״מ ב־3 ריצות · 1:42:10"; without distance "אירובי אחר: 45:00 ב־2 אימונים". */
export function cardioTotalText(total: CardioPeriodTotal): string {
  const p = cardioTotalParts(total);
  // A recorded effort always has a distance or a time (cardioSetHasData).
  const lead = p.distance ? `${p.distance.value} ${p.distance.unit}` : (p.clock ?? '');
  const time = p.distance && p.clock ? ` · ${p.clock}` : '';
  return `${p.label}: ${lead} ${p.countText}${time}`;
}

// ---- Body weight ------------------------------------------------------------

export interface WeightTrend {
  startWeight: number;
  endWeight: number;
  /** endWeight - startWeight (negative = lost weight). */
  delta: number;
  /** Chronological weights (oldest → newest) for the sparkline. */
  values: number[];
}

/** Null when no valid weigh-ins fall inside the range (caller renders empty state). */
export function computeWeightTrend(
  weights: readonly BodyWeightEntry[],
  range: ReportRange
): WeightTrend | null {
  const inRange = weights
    .filter((w) => isInRange(w.date, range) && Number.isFinite(w.weight))
    .sort((a, b) => a.date.slice(0, 10).localeCompare(b.date.slice(0, 10)));
  const first = inRange[0];
  const last = inRange[inRange.length - 1];
  if (first === undefined || last === undefined) return null;
  const values = inRange.map((w) => w.weight);
  const startWeight = first.weight;
  const endWeight = last.weight;
  return {
    startWeight,
    endWeight,
    delta: Math.round((endWeight - startWeight) * 10) / 10,
    values,
  };
}

// ---- PRs ---------------------------------------------------------------------

/** PRs achieved inside the range, preserving the API's newest-first order. */
export function filterPRsInRange(
  prs: readonly PersonalRecordRow[],
  range: ReportRange
): PersonalRecordRow[] {
  return prs.filter((p) => isInRange(p.date, range));
}

// ---- Nutrition ----------------------------------------------------------------

export interface NutritionSummary {
  /** Days with any nutrition log inside the range. */
  daysLogged: number;
  /** Average calories across logged days, or null when nothing logged. */
  avgCalories: number | null;
  /** Active coach calorie target, or null when none assigned. */
  targetCalories: number | null;
}

export function computeNutritionSummary(
  logs: readonly NutritionLog[],
  range: ReportRange,
  targetCalories: number | null
): NutritionSummary {
  const inRange = logs.filter((l) => isInRange(l.date, range));
  const withCalories = inRange.filter(
    (l) => typeof l.calories === 'number' && Number.isFinite(l.calories)
  );
  const avgCalories =
    withCalories.length > 0
      ? Math.round(
          withCalories.reduce((sum, l) => sum + (l.calories ?? 0), 0) / withCalories.length
        )
      : null;
  return { daysLogged: inRange.length, avgCalories, targetCalories };
}

/**
 * Newest active nutrition_target assignment with a numeric calories payload
 * (same selection rule as coachAnalytics.getClientWeekAdherence).
 */
export function findCalorieTarget(assignments: readonly Assignment[]): number | null {
  for (const a of assignments) {
    if (a.kind === 'nutrition_target' && a.status === 'active') {
      const cal = a.payload?.calories;
      if (typeof cal === 'number' && Number.isFinite(cal)) return cal;
    }
  }
  return null;
}

// ---- Share summary -----------------------------------------------------------

/** Inputs for the concise share/WhatsApp summary (all already computed). */
export interface ShareSummaryInput {
  clientName: string;
  days: number;
  training: TrainingSummary;
  weightTrend: WeightTrend | null;
  prCount: number;
  nutrition: NutritionSummary;
  /** Cardio per discipline in the window (omit or [] when none). */
  cardio?: readonly CardioPeriodTotal[];
}

/**
 * Build a concise Hebrew share text (WhatsApp-grade) from the already-computed
 * report aggregates. Numbers are plain digits (the receiving app renders them);
 * only meaningful lines are included so an empty section never adds noise. Pure.
 */
export function buildShareSummary(input: ShareSummaryInput): string {
  const { clientName, days, training, weightTrend, prCount, nutrition } = input;
  const lines: string[] = [`סיכום ${days} ימים — ${clientName}`];
  lines.push(`אימונים: ${training.sessionCount}`);
  if (training.totalVolume > 0) {
    lines.push(`נפח כולל: ${Math.round(training.totalVolume).toLocaleString('he-IL')} ק"ג`);
  }
  for (const total of input.cardio ?? []) lines.push(cardioTotalText(total));
  if (weightTrend) {
    const sign = weightTrend.delta > 0 ? '+' : '';
    lines.push(`שינוי משקל: ${sign}${weightTrend.delta} ק"ג`);
  }
  if (prCount > 0) lines.push(`שיאים אישיים: ${prCount}`);
  if (nutrition.daysLogged > 0) {
    const avg =
      nutrition.avgCalories === null ? '—' : nutrition.avgCalories.toLocaleString('he-IL');
    lines.push(`תיעוד תזונה: ${nutrition.daysLogged} ימים · ממוצע ${avg} קק"ל`);
  }
  return lines.join('\n');
}

// ---- Sparkline ----------------------------------------------------------------

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * SVG polyline `points` string for a value series, left = oldest. A single
 * value renders as a flat line; a zero-span series renders at mid-height.
 * Returns '' for an empty series.
 */
export function sparklinePoints(values: readonly number[], width: number, height: number): string {
  const only = values[0];
  if (only === undefined) return '';
  const pad = 4;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const series = values.length === 1 ? [only, only] : values;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const stepX = innerW / (series.length - 1);
  return series
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = span === 0 ? height / 2 : pad + innerH * (1 - (v - min) / span);
      return `${round1(x)},${round1(y)}`;
    })
    .join(' ');
}

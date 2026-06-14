// ============================================================================
// CLIENT PROGRESS REPORT — pure metric helpers (Fresh Steel / Obsidian)
// ============================================================================
// Date-window aggregates for the printable 30-day progress report
// (ClientReport.tsx). Pure functions only — no fetching, no clock side
// effects beyond the injectable `now` — so they stay unit-testable.

import type { NutritionLog, PersonalRecordRow } from '../../../services/supabaseSyncMappers';
import type { BodyWeightEntry, WorkoutSession } from '../../../types';
import type { Assignment } from '../../../types/coach';

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

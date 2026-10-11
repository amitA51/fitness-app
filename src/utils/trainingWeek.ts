// ============================================================================
// trainingWeek — ONE definition of "this week" for the whole app.
// ============================================================================
// Home and Progress used to print the same word, "השבוע", over two different
// weeks: the dashboard counted the SUNDAY-based calendar week (the same boundary
// WeeklyGrid draws) and summed volume from COMPLETED SETS, while the Progress
// overview counted a TRAILING 7-day window and summed the stored `totalVolume`
// field (which older rows do not carry). On a Monday one trainee read
// "1 / 3 השבוע" on Home and "השלמתם 3 אימונים השבוע" on Progress.
//
// The week math therefore lives HERE, in a neutral module that neither screen
// owns: `homeStats` re-exports it (its public names are unchanged) and the
// Progress overview reads the same functions, so the two surfaces cannot drift
// again. Every function is pure and takes `now` so the boundary is testable.
//
// The rules, stated once:
//   • a week starts SUNDAY 00:00 local (`getWeekStart`, shared with WeeklyGrid)
//   • only `status === 'completed'` sessions are training done
//   • volume is summed from COMPLETED SETS, never the stored `totalVolume`
//   • an uncertain number is `null`, so the UI can omit the line entirely

import type { WorkoutSession } from '../types';
import { getWeekStart } from './dateUtils';
import { completedSetsVolume } from './workoutMath';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Number of complete past weeks sampled when inferring a weekly target. */
const TARGET_LOOKBACK_WEEKS = 4;
/** A target inferred from fewer complete weeks than this is a guess, not data. */
const TARGET_MIN_WEEKS = 2;

/** Sunday 00:00 of the week containing `now`, shifted by `offsetWeeks`. */
export function weekStartAt(now: Date, offsetWeeks = 0): Date {
  const start = getWeekStart(now);
  if (offsetWeeks !== 0) start.setDate(start.getDate() + offsetWeeks * 7);
  return start;
}

/** Completed sessions only — an abandoned session is not training done. */
export const completedOnly = (sessions: readonly WorkoutSession[]): WorkoutSession[] =>
  sessions.filter((s) => s.status === 'completed');

/**
 * Working volume of one session, summed from its completed sets (the same rule
 * `insightsAggregator` uses for `lastWorkout.totalVolume`) rather than the
 * stored `totalVolume` field, which older rows may not carry.
 */
export function sessionVolume(session: WorkoutSession): number {
  return (session.exercises ?? []).reduce((sum, ex) => sum + completedSetsVolume(ex.sets), 0);
}

/** Completed sessions whose start falls inside the week beginning `start`. */
export function sessionsInWeek(sessions: readonly WorkoutSession[], start: Date): WorkoutSession[] {
  const from = start.getTime();
  const to = from + WEEK_MS;
  return completedOnly(sessions).filter((s) => {
    const t = new Date(s.startTime).getTime();
    return !Number.isNaN(t) && t >= from && t < to;
  });
}

/** Sessions completed in the week that contains `now` (offset 0 = this week). */
export function sessionsThisWeek(
  sessions: readonly WorkoutSession[],
  now: Date = new Date(),
  offsetWeeks = 0
): number {
  return sessionsInWeek(sessions, weekStartAt(now, offsetWeeks)).length;
}

/** Sunday 00:00 of the week holding the trainee's FIRST completed session. */
function firstTrainingWeekStart(sessions: readonly WorkoutSession[]): number | null {
  const completed = completedOnly(sessions);
  if (completed.length === 0) return null;
  const firstStart = Math.min(...completed.map((s) => new Date(s.startTime).getTime()));
  if (!Number.isFinite(firstStart)) return null;
  return getWeekStart(new Date(firstStart)).getTime();
}

/**
 * Complete (fully elapsed) weeks the trainee has been logging, counted from the
 * week of their first session up to — but excluding — the current week. This is
 * the gate every "last N weeks" surface uses before it draws anything: below two
 * complete weeks there is no rhythm to show, only zeros that were never weeks.
 */
export function completeTrainingWeeks(
  sessions: readonly WorkoutSession[],
  now: Date = new Date()
): number {
  const firstWeek = firstTrainingWeekStart(sessions);
  if (firstWeek === null) return 0;
  const thisWeek = weekStartAt(now).getTime();
  return Math.max(0, Math.round((thisWeek - firstWeek) / WEEK_MS));
}

/**
 * Median sessions/week over the last `TARGET_LOOKBACK_WEEKS` COMPLETE weeks —
 * the honest fallback target when no program declares one.
 *
 * Returns `null` rather than inventing a goal when the history is too short
 * (fewer than two complete weeks since the first session) or when the median
 * rounds to zero, which would print an unreachable "0 אימונים בשבוע".
 */
export function medianSessionsPerWeek(
  sessions: readonly WorkoutSession[],
  now: Date = new Date()
): number | null {
  const completed = completedOnly(sessions);
  const firstWeek = firstTrainingWeekStart(completed);
  if (firstWeek === null) return null;

  const counts: number[] = [];
  for (let offset = -1; offset >= -TARGET_LOOKBACK_WEEKS; offset--) {
    const start = weekStartAt(now, offset);
    // Only weeks the trainee was actually using the app count — padding the
    // sample with pre-history zeros would drag every target down to 0.
    if (start.getTime() < firstWeek) break;
    counts.push(sessionsInWeek(completed, start).length);
  }
  if (counts.length < TARGET_MIN_WEEKS) return null;

  counts.sort((a, b) => a - b);
  const mid = Math.floor(counts.length / 2);
  const median =
    counts.length % 2 === 1
      ? (counts[mid] as number)
      : ((counts[mid - 1] as number) + (counts[mid] as number)) / 2;
  const target = Math.round(median);
  return target >= 1 ? target : null;
}

/**
 * The sessions/week figure a week is measured against: a DECLARED program beats
 * an inferred habit, so `programSessionsPerWeek` wins over the median. `null`
 * means "unknown" and the surface then prints the bare count, no denominator.
 */
export function weeklyTarget(
  sessions: readonly WorkoutSession[],
  programSessionsPerWeek: number | null = null,
  now: Date = new Date()
): number | null {
  const declared =
    programSessionsPerWeek && programSessionsPerWeek > 0
      ? Math.round(programSessionsPerWeek)
      : null;
  return declared ?? medianSessionsPerWeek(sessions, now);
}

/**
 * Signed % change in volume so far THIS week against the SAME point of last
 * week (same elapsed time from Sunday 00:00), or `null` when the comparison
 * would be fiction: no volume logged yet this week, or nothing to compare
 * against at that point last week.
 */
export function weeklyVolumeDeltaPct(
  sessions: readonly WorkoutSession[],
  now: Date = new Date()
): number | null {
  const thisStart = weekStartAt(now);
  const elapsed = now.getTime() - thisStart.getTime();
  if (elapsed <= 0) return null;
  const lastStart = weekStartAt(now, -1).getTime();

  let current = 0;
  let previous = 0;
  for (const session of completedOnly(sessions)) {
    const t = new Date(session.startTime).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= thisStart.getTime() && t <= now.getTime()) current += sessionVolume(session);
    else if (t >= lastStart && t <= lastStart + elapsed) previous += sessionVolume(session);
  }

  if (current <= 0 || previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Count + volume + minutes of one Sunday-based week. */
export interface TrainingWeekTotals {
  /** Completed sessions in the week. */
  count: number;
  /** Completed-set volume, kg. */
  volume: number;
  /** Total training minutes. */
  timeMin: number;
}

/**
 * Totals of the week starting `start`, from completed sessions + sets. With
 * `untilMs`, only sessions that started at or before that instant count  the
 * "same point of last week" side of a mid-week comparison.
 */
export function trainingWeekTotals(
  sessions: readonly WorkoutSession[],
  start: Date,
  untilMs: number = Number.POSITIVE_INFINITY
): TrainingWeekTotals {
  const inWeek = sessionsInWeek(sessions, start).filter(
    (s) => new Date(s.startTime).getTime() <= untilMs
  );
  let volume = 0;
  let durationSec = 0;
  for (const s of inWeek) {
    volume += sessionVolume(s);
    durationSec += s.duration || 0;
  }
  return { count: inWeek.length, volume, timeMin: Math.round(durationSec / 60) };
}

/** This week vs last week, in the ONE definition both screens read. */
export interface TrainingWeekSummary extends TrainingWeekTotals {
  /** Completed-set volume of the previous week UP TO the same elapsed point. */
  prevVolume: number;
  /** Completed sessions of the previous week up to the same elapsed point. */
  prevCount: number;
  /** Training minutes of the previous week up to the same elapsed point. */
  prevTimeMin: number;
  /** Week-over-week volume change, whole percent, or null with no prior volume. */
  changePct: number | null;
}

/**
 * Summary of the CURRENT Sunday-based week with its week-over-week comparison.
 * The previous side is cut at the SAME elapsed point (Monday noon vs last
 * Monday noon), like `weeklyVolumeDeltaPct`: a week two days old measured
 * against a whole finished week reads as a collapse every Sunday-Tuesday.
 * `now` is injectable so the boundary is deterministic in tests.
 */
export function summarizeTrainingWeek(
  sessions: readonly WorkoutSession[],
  now: Date = new Date()
): TrainingWeekSummary {
  const thisStart = weekStartAt(now);
  const lastStart = weekStartAt(now, -1);
  const elapsed = Math.max(0, now.getTime() - thisStart.getTime());
  const current = trainingWeekTotals(sessions, thisStart, now.getTime());
  const previous = trainingWeekTotals(sessions, lastStart, lastStart.getTime() + elapsed);
  const changePct =
    previous.volume > 0
      ? Math.round(((current.volume - previous.volume) / previous.volume) * 100)
      : null;

  return {
    ...current,
    prevVolume: previous.volume,
    prevCount: previous.count,
    prevTimeMin: previous.timeMin,
    changePct,
  };
}

/** One bar of the weekly-rhythm chart. */
export interface TrainingWeekPoint {
  /** Sunday 00:00 of the week, ISO day key — stable React key + aria text. */
  weekStart: string;
  /** Completed sessions that week. */
  count: number;
  /** True for the week still in progress (its bar is not a finished result). */
  isCurrent: boolean;
}

/**
 * Sessions per week for the last `weeks` Sunday-based weeks, OLDEST → NEWEST
 * (the direction every chart in this app already draws time in — see
 * `Sparkline` and `GlowAreaChart`). Weeks before the trainee's first session are
 * omitted entirely rather than drawn as zeros: a week they had not started is
 * not a week they skipped.
 */
export function sessionsPerWeekSeries(
  sessions: readonly WorkoutSession[],
  weeks = 8,
  now: Date = new Date()
): TrainingWeekPoint[] {
  const completed = completedOnly(sessions);
  const firstWeek = firstTrainingWeekStart(completed);
  if (firstWeek === null) return [];

  const points: TrainingWeekPoint[] = [];
  for (let offset = -(weeks - 1); offset <= 0; offset++) {
    const start = weekStartAt(now, offset);
    if (start.getTime() < firstWeek) continue;
    points.push({
      weekStart: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`,
      count: sessionsInWeek(completed, start).length,
      isCurrent: offset === 0,
    });
  }
  return points;
}

// ============================================================================
// homeStats — pure math behind the home screen's training numbers.
// ============================================================================
// The Dashboard used to show a returning trainee ZERO numbers about their own
// training. Everything the "this week" hero and the "last workout" recap print
// is computed here so it can be unit-tested without a DOM, and so no surface
// ever prints a number the data does not support (every uncertain value is
// `null`, and the UI then omits that line entirely).
//
// Week boundaries are SUNDAY-based, taken from the same `getWeekStart` helper
// WeeklyGrid uses — the hero numeral and the day grid must never disagree.
// No data fetching: every function is a pure read over sessions the Dashboard
// has already loaded.

import type { WorkoutSession } from '../../types';
import { getWeekStart } from '../../utils/dateUtils';
import { completedSetsVolume } from '../../utils/workoutMath';

/** Number of complete past weeks sampled when inferring a weekly target. */
const TARGET_LOOKBACK_WEEKS = 4;
/** A target inferred from fewer complete weeks than this is a guess, not data. */
const TARGET_MIN_WEEKS = 2;

/**
 * Catalog exercise names are stored bilingual — `'לחיצת חזה | Bench Press'`.
 * Hebrew is the first side; show it alone. Same rule as InsightCard and
 * `progress/strengthFormat.exerciseLabel`, kept here as the dashboard's copy so
 * both dashboard surfaces import one implementation.
 */
export const displayExerciseName = (raw: string): string => raw.split('|')[0]?.trim() || raw;

/** Sunday 00:00 of the week containing `now`, shifted by `offsetWeeks`. */
export function weekStartAt(now: Date, offsetWeeks = 0): Date {
  const start = getWeekStart(now);
  if (offsetWeeks !== 0) start.setDate(start.getDate() + offsetWeeks * 7);
  return start;
}

/** Local midnight of `date` — day comparisons must not use raw 24h windows. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Parses a `'YYYY-MM-DD'` day key or an ISO timestamp into a local Date.
 * A bare day key goes through explicit components: `new Date('2026-09-28')`
 * parses as UTC midnight and slips a day for anyone ahead of UTC.
 */
function parseLocal(dateLike: string): Date | null {
  const key = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateLike.trim());
  if (key) return new Date(Number(key[1]), Number(key[2]) - 1, Number(key[3]));
  const parsed = new Date(dateLike);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Completed sessions only — an abandoned session is not training done. */
const completedOnly = (sessions: readonly WorkoutSession[]): WorkoutSession[] =>
  sessions.filter((s) => s.status === 'completed');

/**
 * Working volume of one session, summed from its completed sets (the same rule
 * `insightsAggregator` uses for `lastWorkout.totalVolume`) rather than the
 * stored `totalVolume` field, which older rows may not carry.
 */
export function sessionVolume(session: WorkoutSession): number {
  return (session.exercises ?? []).reduce((sum, ex) => sum + completedSetsVolume(ex.sets), 0);
}

/**
 * Hebrew relative day label: היום / אתמול / שלשום / לפני N ימים (under a week),
 * then an absolute short date. Future dates fall through to the absolute form
 * instead of printing "לפני -1 ימים".
 */
export function relativeDayLabel(dateLike: string, now: Date = new Date()): string {
  const date = parseLocal(dateLike);
  if (!date) return '';
  const diff = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / (24 * 60 * 60 * 1000)
  );
  if (diff === 0) return 'היום';
  if (diff === 1) return 'אתמול';
  if (diff === 2) return 'שלשום';
  if (diff > 2 && diff < 7) return `לפני ${diff} ימים`;
  return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
}

/** Completed sessions whose start falls inside the week beginning `start`. */
function sessionsInWeek(sessions: readonly WorkoutSession[], start: Date): WorkoutSession[] {
  const from = start.getTime();
  const to = from + 7 * 24 * 60 * 60 * 1000;
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
  if (completed.length === 0) return null;

  const firstStart = Math.min(...completed.map((s) => new Date(s.startTime).getTime()));
  if (!Number.isFinite(firstStart)) return null;
  const firstWeek = getWeekStart(new Date(firstStart)).getTime();

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

/** Minimal template shape needed to name a session — id plus display name. */
export interface NamedTemplate {
  id: string;
  name: string;
}

/** A personal record entry, narrowed to the fields the recap reads. */
export interface DatedRecord {
  exerciseId: string;
  date: string;
}

export interface LastWorkoutRecap {
  /** Session id — the recap links to `/detail/:id`. */
  id: string;
  /** Template name when the session came from one, else the first exercise. */
  name: string;
  /** היום / אתמול / שלשום / לפני N ימים / short date. */
  dateLabel: string;
  /** Seconds, as stored on the session. */
  durationSec: number;
  /** Working volume of the session's completed sets. */
  volume: number;
  /** Exercises whose all-time best was set in this session. */
  prCount: number;
}

export interface HomeStatsInput {
  sessions: readonly WorkoutSession[];
  /** Already-loaded templates, used only to name the last session. */
  templates?: readonly NamedTemplate[];
  /** Already-aggregated PRs; no lookup is performed for them. */
  records?: readonly DatedRecord[];
  /**
   * Sessions/week declared by an ACTIVE structured program. A stated plan beats
   * an inferred habit, so this wins over the median when present.
   */
  programSessionsPerWeek?: number | null;
  now?: Date;
}

export interface HomeStats {
  /** Completed sessions in the current (Sunday-based) week. */
  thisWeek: number;
  /** Sessions/week the week is measured against, or `null` when unknown. */
  target: number | null;
  /** Volume vs the same point last week, signed %, or `null`. */
  volumeDeltaPct: number | null;
  lastWorkout: LastWorkoutRecap | null;
}

/** Names a session: its template, else its first exercise, else a plain label. */
function sessionName(
  session: WorkoutSession,
  templates: readonly NamedTemplate[] | undefined
): string {
  const template = session.templateId
    ? templates?.find((t) => t.id === session.templateId)
    : undefined;
  const fromTemplate = template?.name?.trim();
  if (fromTemplate) return displayExerciseName(fromTemplate);

  const first = session.exercises?.[0];
  const rawName = (first?.exerciseName || first?.name || '').trim();
  if (rawName) return displayExerciseName(rawName);
  return 'אימון';
}

/**
 * Everything the home screen prints about the trainee's own training, in one
 * pure pass. `target`, `volumeDeltaPct` and `lastWorkout` are independently
 * nullable so a thin history silently drops those lines instead of guessing.
 */
export function computeHomeStats({
  sessions,
  templates,
  records,
  programSessionsPerWeek = null,
  now = new Date(),
}: HomeStatsInput): HomeStats {
  const completed = completedOnly(sessions);

  let latest: WorkoutSession | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const session of completed) {
    const t = new Date(session.startTime).getTime();
    if (!Number.isNaN(t) && t > latestMs) {
      latestMs = t;
      latest = session;
    }
  }

  let lastWorkout: LastWorkoutRecap | null = null;
  if (latest) {
    const dayKey = latest.date || latest.startTime;
    // A PR "in this session" = an exercise whose all-time best landed on that
    // day. Weight and volume PRs share an exercise, so count exercises once.
    const prExercises = new Set(
      (records ?? [])
        .filter((pr) => pr.date?.slice(0, 10) === dayKey.slice(0, 10))
        .map((pr) => pr.exerciseId)
    );
    lastWorkout = {
      id: latest.id,
      name: sessionName(latest, templates),
      dateLabel: relativeDayLabel(dayKey, now),
      durationSec: latest.duration ?? 0,
      volume: sessionVolume(latest),
      prCount: prExercises.size,
    };
  }

  const declared =
    programSessionsPerWeek && programSessionsPerWeek > 0
      ? Math.round(programSessionsPerWeek)
      : null;

  return {
    thisWeek: sessionsThisWeek(completed, now),
    target: declared ?? medianSessionsPerWeek(completed, now),
    volumeDeltaPct: weeklyVolumeDeltaPct(completed, now),
    lastWorkout,
  };
}

/**
 * Factual header subtitle for a trainee WITH history — last workout plus this
 * week's count. First-run users keep the onboarding line, so this is never
 * asked for an empty history.
 */
export function headerSubtitle(stats: HomeStats): string | null {
  const week =
    stats.thisWeek === 0
      ? 'עוד לא התאמנתם השבוע'
      : stats.thisWeek === 1
        ? 'אימון אחד השבוע'
        : `${stats.thisWeek} אימונים השבוע`;
  if (!stats.lastWorkout) return week;
  return `אימון אחרון ${stats.lastWorkout.dateLabel} · ${week}`;
}

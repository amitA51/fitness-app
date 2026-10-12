// ============================================================================
// homeStats — pure math behind the home screen's training numbers.
// ============================================================================
// The Dashboard used to show a returning trainee ZERO numbers about their own
// training. Everything the "this week" hero and the "last workout" recap print
// is computed here so it can be unit-tested without a DOM, and so no surface
// ever prints a number the data does not support (every uncertain value is
// `null`, and the UI then omits that line entirely).
//
// Week boundaries are SUNDAY-based and now live in `utils/trainingWeek` — the
// neutral module the Progress overview reads too, so "השבוע" means exactly one
// thing app-wide. The names this file used to define are re-exported below, so
// every existing import of `homeStats` keeps working unchanged.
// No data fetching: every function is a pure read over sessions the Dashboard
// has already loaded.

import type { WorkoutSession } from '../../types';
import {
  cardioActivityConfig,
  cardioEffortsOf,
  isCardioSession,
  sessionCardioTotals,
} from '../../utils/cardio';
import {
  completedOnly,
  sessionVolume,
  sessionsInWeek,
  sessionsThisWeek,
  weekStartAt,
  weeklyTarget,
  weeklyVolumeDeltaPct,
} from '../../utils/trainingWeek';

// The week math is defined ONCE in utils/trainingWeek and surfaced here under
// the names the dashboard already imports.
export {
  medianSessionsPerWeek,
  sessionVolume,
  sessionsThisWeek,
  weekStartAt,
  weeklyVolumeDeltaPct,
} from '../../utils/trainingWeek';

/**
 * Catalog exercise names are stored bilingual — `'לחיצת חזה | Bench Press'`.
 * Hebrew is the first side; show it alone. Same rule as InsightCard and
 * `progress/strengthFormat.exerciseLabel`, kept here as the dashboard's copy so
 * both dashboard surfaces import one implementation.
 */
export const displayExerciseName = (raw: string): string => raw.split('|')[0]?.trim() || raw;

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
  /** Cardio distance in the session (runs, rides, treadmill), km. */
  distanceKm: number;
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
  /** Cardio kilometres in the current week (0 for a lifter who never runs). */
  weekDistanceKm: number;
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

  // A run / treadmill / ride reads by its activity ("הליכון"), not the catalog
  // entry it was logged under ("ריצה על מסילה").
  const cardio = isCardioSession(session) ? cardioEffortsOf(session)[0] : undefined;
  if (cardio) return cardioActivityConfig(cardio.activity).label;

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
      distanceKm: sessionCardioTotals(latest).distanceKm,
    };
  }

  const weekDistanceKm = sessionsInWeek(completed, weekStartAt(now)).reduce(
    (sum, s) => sum + sessionCardioTotals(s).distanceKm,
    0
  );

  return {
    thisWeek: sessionsThisWeek(completed, now),
    target: weeklyTarget(completed, programSessionsPerWeek, now),
    volumeDeltaPct: weeklyVolumeDeltaPct(completed, now),
    lastWorkout,
    weekDistanceKm,
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

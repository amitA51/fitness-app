// ============================================================================
// SPARKOS FITNESS - Progress Metrics (pure, unit-testable)
// ============================================================================
// Single source of truth for the Progress screen's derived numbers. Keeping the
// math here (instead of inside tab components) lets every tab read from ONE
// definition and lets vitest cover the logic without rendering React.

import type { PersonalRecord, WorkoutSession } from '../../types';
import { completedSetsVolume, oneRepMax, setVolume } from '../../utils/workoutMath';
import type { Zone } from '../../utils/zoneColor';
import type {
  ExerciseProgress,
  ExerciseStrengthCurve,
  ExerciseTrendStatus,
  StrengthDataPoint,
  StrengthSessionPoint,
} from './types';

const DAY_MS = 86400000;

/** Selectable trend windows for the per-chart range control, in days. */
export const RANGE_DAYS = {
  W: 7,
  M: 30,
  '3M': 90,
  '6M': 180,
  Y: 365,
} as const;

export type RangeKey = keyof typeof RANGE_DAYS;

/** Default range for a freshly opened trend chart. */
export const DEFAULT_RANGE: RangeKey = 'M';

/**
 * Keep only the items whose date falls within the trailing `days` window.
 * `getDate` extracts a parseable date string from each item; malformed dates are
 * dropped. Pure + `now`-injectable so the date math is unit-testable.
 */
export function sliceByRangeDays<T>(
  items: T[],
  days: number,
  getDate: (item: T) => string,
  now: number = Date.now()
): T[] {
  const cutoff = now - days * DAY_MS;
  return items.filter((item) => {
    const t = new Date(getDate(item)).getTime();
    return !Number.isNaN(t) && t >= cutoff;
  });
}

export interface WeeklyVolumeSummary {
  /** Completed-session volume in the trailing 7 days. */
  volume: number;
  /** Completed-session count in the trailing 7 days. */
  count: number;
  /** Total training minutes in the trailing 7 days. */
  timeMin: number;
  /** Volume in the previous 7-day window (days 7..14 ago). */
  prevVolume: number;
  /** Completed-session count in the previous 7-day window (days 7..14 ago). */
  prevCount: number;
  /** Week-over-week volume change as a whole-number percent, or null when no prior data. */
  changePct: number | null;
}

export interface PRBoardEntry {
  exerciseName: string;
  /** Best estimated 1RM for this exercise across all of its PR records. */
  e1RM: number;
  weight: number;
  reps: number;
  date: string;
}

export interface VolumePoint {
  x: string;
  y: number;
}

/** e1RM for a PR record: prefer the stored value, else derive from weight x reps. */
const recordE1RM = (pr: PersonalRecord): number =>
  pr.oneRepMax && pr.oneRepMax > 0 ? pr.oneRepMax : oneRepMax(pr.weight, pr.reps);

/** Completed sessions only — the gate every derived metric shares. */
export const onlyCompleted = (sessions: WorkoutSession[]): WorkoutSession[] =>
  sessions.filter((s) => s.status === 'completed');

/**
 * Trailing-7-day volume summary with a week-over-week comparison.
 * `now` is injectable for deterministic tests.
 */
export function summarizeWeeklyVolume(
  completedSessions: WorkoutSession[],
  now: number = Date.now()
): WeeklyVolumeSummary {
  const weekAgo = now - 7 * DAY_MS;
  const twoWeeksAgo = now - 14 * DAY_MS;

  let volume = 0;
  let count = 0;
  let durationSec = 0;
  let prevVolume = 0;
  let prevCount = 0;

  for (const s of completedSessions) {
    const t = new Date(s.startTime).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= weekAgo) {
      volume += s.totalVolume || 0;
      durationSec += s.duration || 0;
      count += 1;
    } else if (t >= twoWeeksAgo) {
      prevVolume += s.totalVolume || 0;
      prevCount += 1;
    }
  }

  const changePct = prevVolume > 0 ? Math.round(((volume - prevVolume) / prevVolume) * 100) : null;

  return { volume, count, timeMin: Math.round(durationSec / 60), prevVolume, prevCount, changePct };
}

/**
 * e1RM-based PR board. Groups PR records by exercise and keeps the single best
 * estimated 1RM per exercise. This is the ONE PR definition the Strength tab and
 * the Overview "recent PRs" both consume — no duplicate sparkline logic.
 */
export function buildPRBoard(prs: PersonalRecord[]): PRBoardEntry[] {
  const best = new Map<string, PRBoardEntry>();

  for (const pr of prs) {
    const name = pr.exerciseName?.trim();
    if (!name || pr.weight <= 0) continue;
    const e1RM = Math.round(recordE1RM(pr));
    if (e1RM <= 0) continue;

    const existing = best.get(name);
    if (!existing || e1RM > existing.e1RM) {
      best.set(name, { exerciseName: name, e1RM, weight: pr.weight, reps: pr.reps, date: pr.date });
    }
  }

  return [...best.values()].sort((a, b) => b.e1RM - a.e1RM);
}

/** Most recent PR records (any type), newest first. */
export function recentPRs(prs: PersonalRecord[], limit = 3): PersonalRecord[] {
  return [...prs]
    .filter((p) => p.weight > 0)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, limit);
}

/** Last `limit` completed sessions as {label, volume} points for the area chart. */
export function buildVolumeTrend(completedSessions: WorkoutSession[], limit = 14): VolumePoint[] {
  return [...completedSessions]
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(-limit)
    .map((s) => {
      const d = new Date(s.startTime);
      const label = Number.isNaN(d.getTime())
        ? ''
        : d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
      return { x: label, y: s.totalVolume || 0 };
    });
}

/** Best top-set weight (by set volume) for one exercise within a session. */
function bestSetOfExercise(sets: WorkoutSession['exercises'][number]['sets']): {
  weight: number;
  volume: number;
} {
  let bestWeight = 0;
  let bestVolume = 0;
  for (const set of sets || []) {
    if (!set.isCompleted) continue;
    const vol = setVolume(set);
    if (vol > bestVolume) {
      bestVolume = vol;
      bestWeight = set.weight || 0;
    }
  }
  return { weight: bestWeight, volume: bestVolume };
}

/**
 * Per-exercise top-weight curves over time, most-tracked first. Extracted from the
 * old StrengthTab effect so it is pure and shared with the single data source.
 */
export function buildStrengthCurves(completedSessions: WorkoutSession[]): ExerciseStrengthCurve[] {
  const exerciseMap = new Map<string, StrengthDataPoint[]>();

  for (const session of completedSessions) {
    const date = session.date || session.startTime?.slice(0, 10);
    if (!date) continue;
    for (const exercise of session.exercises) {
      const name = exercise.exerciseName || exercise.name;
      if (!name) continue;
      const best = bestSetOfExercise(exercise.sets);
      if (best.volume === 0) continue;
      const existing = exerciseMap.get(name) || [];
      existing.push({ date, value: best.weight, volume: best.volume });
      exerciseMap.set(name, existing);
    }
  }

  const result: ExerciseStrengthCurve[] = [];
  for (const [name, points] of exerciseMap.entries()) {
    const deduped = new Map<string, StrengthDataPoint>();
    for (const p of [...points].sort((a, b) => a.date.localeCompare(b.date))) {
      const existing = deduped.get(p.date);
      if (!existing || p.value > existing.value) deduped.set(p.date, p);
    }
    const uniquePoints = [...deduped.values()];
    if (uniquePoints.length < 2) continue;

    const latest = uniquePoints[uniquePoints.length - 1]!;
    const earliest = uniquePoints[0]!;
    const change = latest.value - earliest.value;
    const changePct = earliest.value > 0 ? Math.round((change / earliest.value) * 100) : 0;

    result.push({
      exerciseName: name,
      data: uniquePoints.slice(-15),
      latestWeight: latest.value,
      change,
      changePct,
    });
  }

  return result.sort((a, b) => b.data.length - a.data.length);
}

// ============================================================================
// e1RM-based per-exercise progress — the honest "am I getting stronger?" model.
// ============================================================================
// A session collapses many sets into ONE number, so it must be the RIGHT number
// and it must be explainable. We take the best WORKING set (highest estimated
// 1RM, warmups excluded) per session: e1RM normalizes weight AND reps onto one
// comparable scale, so "heavier for fewer reps" vs "lighter for more" resolve
// honestly instead of by whichever set happened to have the most raw volume.

/** Recent sessions the trend/status is judged over (older points still charted). */
export const STRENGTH_TREND_WINDOW = 8;
/** Days without training after which an exercise is flagged dormant. */
export const STRENGTH_DORMANT_DAYS = 21;
/** Distinct training days required before a real trend (not "new") is claimed. */
const STRENGTH_MIN_POINTS = 3;
/** Percent move (either direction) that counts as improving/declining vs stable. */
const STRENGTH_TREND_EPSILON_PCT = 2;
/** Absolute floor: sub-1kg swings are noise, always stable. */
const STRENGTH_TREND_EPSILON_KG = 1;

/** A set as read for e1RM: only the fields we touch, incl. optional drop-set legs. */
interface E1RMSet {
  weight?: number;
  reps?: number;
  isWarmup?: boolean;
  isCompleted?: boolean;
  segments?: { weight?: number; reps?: number }[];
}

/** Best estimated 1RM producible from one set (handles drop-set legs). */
function setBestE1RM(set: E1RMSet): { weight: number; reps: number; e1RM: number } | null {
  const legs =
    Array.isArray(set.segments) && set.segments.length > 0
      ? set.segments
      : [{ weight: set.weight, reps: set.reps }];
  let best: { weight: number; reps: number; e1RM: number } | null = null;
  for (const leg of legs) {
    const w = typeof leg.weight === 'number' && leg.weight > 0 ? leg.weight : 0;
    const r = typeof leg.reps === 'number' && leg.reps > 0 ? leg.reps : 0;
    const e = oneRepMax(w, r);
    if (e <= 0) continue;
    if (!best || e > best.e1RM) best = { weight: w, reps: r, e1RM: e };
  }
  return best;
}

/**
 * The best working set of an exercise within a session — the completed,
 * non-warmup set with the highest estimated 1RM. Null when there is no such set.
 */
export function bestWorkingSet(
  sets: WorkoutSession['exercises'][number]['sets']
): { weight: number; reps: number; e1RM: number } | null {
  let best: { weight: number; reps: number; e1RM: number } | null = null;
  for (const set of sets || []) {
    if (!set.isCompleted || set.isWarmup) continue;
    const cand = setBestE1RM(set as E1RMSet);
    if (cand && (!best || cand.e1RM > best.e1RM)) best = cand;
  }
  return best;
}

/**
 * Classify an exercise's recent trend from its chronological e1RM points.
 * dormant (stale) wins over everything, then new (too few points), then the
 * windowed first→last e1RM move graded against the epsilon thresholds. Pure and
 * `now`-injectable for tests.
 */
export function classifyStrengthTrend(
  points: StrengthSessionPoint[],
  now: number = Date.now()
): { status: ExerciseTrendStatus; deltaE1RM: number; deltaPct: number } {
  const window = points.slice(-STRENGTH_TREND_WINDOW);
  const first = window[0];
  const last = window[window.length - 1];
  const deltaE1RM = first && last ? last.e1RM - first.e1RM : 0;
  const deltaPct = first && first.e1RM > 0 ? Math.round((deltaE1RM / first.e1RM) * 1000) / 10 : 0;

  const lastMs = last ? new Date(last.date).getTime() : Number.NaN;
  const daysSinceLast = Number.isNaN(lastMs)
    ? Number.POSITIVE_INFINITY
    : Math.floor((now - lastMs) / DAY_MS);

  if (daysSinceLast > STRENGTH_DORMANT_DAYS) return { status: 'dormant', deltaE1RM, deltaPct };
  if (points.length < STRENGTH_MIN_POINTS) return { status: 'new', deltaE1RM, deltaPct };
  if (Math.abs(deltaE1RM) < STRENGTH_TREND_EPSILON_KG)
    return { status: 'stable', deltaE1RM, deltaPct };
  if (deltaPct >= STRENGTH_TREND_EPSILON_PCT) return { status: 'improving', deltaE1RM, deltaPct };
  if (deltaPct <= -STRENGTH_TREND_EPSILON_PCT) return { status: 'declining', deltaE1RM, deltaPct };
  return { status: 'stable', deltaE1RM, deltaPct };
}

/**
 * Build the per-exercise e1RM progress model from completed sessions. One point
 * per training day (best working set; the higher e1RM wins when a day has
 * several sessions). Exercises with no working set are dropped. Sorted by most
 * recently trained so the default list leads with what the user is doing now.
 */
export function buildExerciseProgress(
  completedSessions: WorkoutSession[],
  now: number = Date.now()
): ExerciseProgress[] {
  const byExercise = new Map<string, Map<string, StrengthSessionPoint>>();

  for (const session of completedSessions) {
    const date = session.date || session.startTime?.slice(0, 10);
    if (!date) continue;
    for (const exercise of session.exercises) {
      const name = exercise.exerciseName || exercise.name;
      if (!name) continue;
      const best = bestWorkingSet(exercise.sets);
      if (!best) continue;
      const workingSets = (exercise.sets || []).filter((s) => s.isCompleted && !s.isWarmup).length;
      const point: StrengthSessionPoint = {
        date,
        e1RM: Math.round(best.e1RM),
        topWeight: best.weight,
        topReps: best.reps,
        workingSets,
        volume: completedSetsVolume(exercise.sets),
      };
      const byDate = byExercise.get(name) ?? new Map<string, StrengthSessionPoint>();
      const existing = byDate.get(date);
      if (!existing || point.e1RM > existing.e1RM) byDate.set(date, point);
      byExercise.set(name, byDate);
    }
  }

  const result: ExerciseProgress[] = [];
  for (const [name, byDate] of byExercise) {
    const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    const latest = points[points.length - 1];
    if (!latest) continue;
    const { status, deltaE1RM, deltaPct } = classifyStrengthTrend(points, now);
    const lastMs = new Date(latest.date).getTime();
    const daysSinceLast = Number.isNaN(lastMs)
      ? 0
      : Math.max(0, Math.floor((now - lastMs) / DAY_MS));
    result.push({
      exerciseName: name,
      points,
      currentE1RM: latest.e1RM,
      latestTopWeight: latest.topWeight,
      latestTopReps: latest.topReps,
      deltaE1RM,
      deltaPct,
      status,
      lastTrainedDate: latest.date,
      daysSinceLast,
      sessionCount: points.length,
    });
  }

  return result.sort((a, b) => b.lastTrainedDate.localeCompare(a.lastTrainedDate));
}

/** Sort keys for the strength master list. */
export type StrengthSort = 'improved' | 'recent' | 'alpha' | 'heaviest';
/** Status filter buckets for the strength master list. */
export type StrengthFilter = 'all' | 'improving' | 'stalled' | 'dormant';

export const STRENGTH_SORT_LABEL: Record<StrengthSort, string> = {
  improved: 'שיפור',
  recent: 'אחרון',
  alpha: 'א־ב',
  heaviest: 'הכי כבד',
};

export const STRENGTH_FILTER_LABEL: Record<StrengthFilter, string> = {
  all: 'הכל',
  improving: 'משתפרים',
  stalled: 'תקועים',
  dormant: 'זנוחים',
};

export const STRENGTH_STATUS_LABEL: Record<ExerciseTrendStatus, string> = {
  improving: 'משתפר',
  stable: 'יציב',
  declining: 'ירידה',
  new: 'חדש',
  dormant: 'זנוח',
};

/** Zone grading per status — mint=good, warn=attention, muted=neutral (never lime). */
export const STRENGTH_STATUS_ZONE: Record<ExerciseTrendStatus, Zone> = {
  improving: 'good',
  stable: 'neutral',
  declining: 'attention',
  new: 'neutral',
  dormant: 'attention',
};

/** Pure, stable sort of the progress list (does not mutate the input). */
export function sortExerciseProgress(
  list: ExerciseProgress[],
  sort: StrengthSort
): ExerciseProgress[] {
  const copy = [...list];
  switch (sort) {
    case 'improved':
      return copy.sort((a, b) => b.deltaE1RM - a.deltaE1RM || b.currentE1RM - a.currentE1RM);
    case 'recent':
      return copy.sort(
        (a, b) =>
          b.lastTrainedDate.localeCompare(a.lastTrainedDate) || b.currentE1RM - a.currentE1RM
      );
    case 'alpha':
      return copy.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, 'he'));
    case 'heaviest':
      return copy.sort((a, b) => b.currentE1RM - a.currentE1RM);
  }
}

/** Filter the progress list by status bucket ("stalled" = stable OR declining). */
export function filterExerciseProgress(
  list: ExerciseProgress[],
  filter: StrengthFilter
): ExerciseProgress[] {
  switch (filter) {
    case 'all':
      return list;
    case 'improving':
      return list.filter((e) => e.status === 'improving');
    case 'stalled':
      return list.filter((e) => e.status === 'stable' || e.status === 'declining');
    case 'dormant':
      return list.filter((e) => e.status === 'dormant');
  }
}

export interface StrengthSummary {
  /** Total exercises with at least one tracked point. */
  tracked: number;
  improving: number;
  /** stable + declining. */
  stalled: number;
  dormant: number;
  /** Too-new-to-judge. */
  fresh: number;
}

/** One-glance counts for the summary line + the filter-chip badges. */
export function summarizeStrength(list: ExerciseProgress[]): StrengthSummary {
  let improving = 0;
  let stalled = 0;
  let dormant = 0;
  let fresh = 0;
  for (const e of list) {
    if (e.status === 'improving') improving += 1;
    else if (e.status === 'stable' || e.status === 'declining') stalled += 1;
    else if (e.status === 'dormant') dormant += 1;
    else fresh += 1;
  }
  return { tracked: list.length, improving, stalled, dormant, fresh };
}

/** Count for a given filter chip (so chips can show live badges). */
export function strengthFilterCount(summary: StrengthSummary, filter: StrengthFilter): number {
  switch (filter) {
    case 'all':
      return summary.tracked;
    case 'improving':
      return summary.improving;
    case 'stalled':
      return summary.stalled;
    case 'dormant':
      return summary.dormant;
  }
}

// ============================================================================
// Verdict + delta helpers — turn the weekly numbers into a stated "so what".
// ============================================================================

/** A whole-number delta vs the previous window, with the zone that grades it. */
export interface StatDelta {
  /** Signed delta (this window minus previous). */
  diff: number;
  /** good when up, attention when down, neutral when flat or no prior data. */
  zone: Zone;
  /** True when there was a previous window to compare against. */
  hasPrev: boolean;
}

/** Grade a raw "more is better" delta into a zone (up=good, down=attention, flat=neutral). */
const gradeDelta = (diff: number, hasPrev: boolean): Zone => {
  if (!hasPrev || diff === 0) return 'neutral';
  return diff > 0 ? 'good' : 'attention';
};

/** Week-over-week workout-count delta. */
export function weeklyCountDelta(weekly: WeeklyVolumeSummary): StatDelta {
  const hasPrev = weekly.prevCount > 0;
  const diff = weekly.count - weekly.prevCount;
  return { diff, zone: gradeDelta(diff, hasPrev), hasPrev };
}

/** Week-over-week volume delta (absolute kg, not percent). */
export function weeklyVolumeDelta(weekly: WeeklyVolumeSummary): StatDelta {
  const hasPrev = weekly.prevVolume > 0;
  const diff = weekly.volume - weekly.prevVolume;
  return { diff, zone: gradeDelta(diff, hasPrev), hasPrev };
}

export interface WeekVerdict {
  /** The protagonist figure for the verdict line (workout count this week). */
  count: number;
  /** Zone that tints the protagonist number. */
  zone: Zone;
  /** Short Bricolage headline for the weekly-review card (e.g. "שבוע חזק"). */
  headline: string;
  /** Hebrew text BEFORE the inline count number (e.g. "השלמת "). */
  lead: string;
  /** Hebrew text AFTER the count number — carries the actual takeaway. */
  tail: string;
  /** Full plain-text sentence (lead + count + tail) — used by the verdict line. */
  sentence: string;
}

/**
 * Compose the week's one-line takeaway from the volume summary + current streak.
 * Pure + deterministic so the Overview verdict line never drifts from the stats.
 * `lead` / `tail` wrap the inline count so the VerdictLine can tint just the number;
 * `headline` is a short punchy label for the weekly-review card (distinct copy).
 */
export function weekVerdict(weekly: WeeklyVolumeSummary, streakDays: number): WeekVerdict {
  const { count } = weekly;

  if (count === 0) {
    const tail = ' אימונים השבוע — אימון אחד מחזיר אותך למסלול.';
    return {
      count,
      zone: 'attention',
      headline: 'בחזרה למסלול',
      lead: '',
      tail,
      sentence: `0${tail}`,
    };
  }

  const noun = count === 1 ? 'אימון' : 'אימונים';
  const volChange = weekly.changePct;
  let zone: Zone;
  let headline: string;
  let tail: string;

  if (volChange !== null && volChange >= 5) {
    zone = 'good';
    headline = 'שבוע חזק';
    tail = ` ${noun} השבוע, והנפח עלה מול השבוע הקודם — שבוע חזק.`;
  } else if (volChange !== null && volChange <= -10) {
    zone = 'attention';
    headline = 'כדאי להעלות הילוך';
    tail = ` ${noun} השבוע, אבל הנפח ירד — שווה להעלות עומס באימון הבא.`;
  } else if (count >= 3) {
    zone = 'good';
    headline = 'קצב יציב';
    tail = ` ${noun} השבוע — קצב יציב ששומר על ההתקדמות.`;
  } else {
    zone = 'neutral';
    headline = 'עוד אימון אחד';
    tail = ` ${noun} השבוע — עוד אימון אחד יקפיץ את הקצב.`;
  }

  if (streakDays >= 3) {
    tail += ` רצף של ${streakDays} ימים פעיל.`;
  }

  const lead = 'השלמת ';
  return { count, zone, headline, lead, tail, sentence: `${lead}${count}${tail}` };
}

/** True when the PR's date falls within the trailing `days` window (default 7). */
export function isRecentPR(pr: PersonalRecord, days = 7, now: number = Date.now()): boolean {
  const t = new Date(pr.date).getTime();
  if (Number.isNaN(t)) return false;
  return now - t <= days * DAY_MS;
}

// ============================================================================
// SPARKOS FITNESS - Progress Metrics (pure, unit-testable)
// ============================================================================
// Single source of truth for the Progress screen's derived numbers. Keeping the
// math here (instead of inside tab components) lets every tab read from ONE
// definition and lets vitest cover the logic without rendering React.

import type { PersonalRecord, WorkoutSession } from '../../types';
import { oneRepMax, setVolume } from '../../utils/workoutMath';
import type { Zone } from '../../utils/zoneColor';
import type { ExerciseStrengthCurve, StrengthDataPoint } from './types';

const DAY_MS = 86400000;

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

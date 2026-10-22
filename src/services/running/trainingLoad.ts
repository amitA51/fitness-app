// ============================================================================
// Running load — how much, how hard, how fast it is growing.
// ============================================================================
// Everything the coach needs to judge the week: kilometres per week, this
// week against the last four (the ramp), how much of the running was easy,
// the long-run share, and how recent the last run and the last hard run were.
// Pure; takes `now`.

import type { WorkoutSession } from '../../types';
import { type DatedEffort, datedEfforts, weeklyCardio } from '../../utils/cardio';
import { type PaceBand, type PaceEffort, paceEffort } from './paceBands';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Shares of HRmax for a run's average heart rate. Easy is ≤ ~75–80% (talk
 * test, Seiler zone 1–2 edge); Daniels' threshold is 88–92%.
 */
export const EASY_HR_CEILING = 0.8;
const STEADY_HR_CEILING = 0.87;
const THRESHOLD_HR_CEILING = 0.93;

/** One run with how hard it was. */
export interface ClassifiedRun extends DatedEffort {
  secPerKm: number | null;
  /** From heart rate when there is one, else from pace against the bands. */
  intensity: PaceEffort | null;
}

export interface RunningLoad {
  /** Runs (and treadmill runs) of the last 28 days, oldest first. */
  recentRuns: ClassifiedRun[];
  /** Kilometres per Sunday week, oldest → newest, the current week last. */
  weeklyKm: number[];
  thisWeekKm: number;
  /**
   * Mean weekly km over the four rolling weeks before the last 7 days (days
   * 8–35); null with no running in them.
   */
  priorFourWeekAvgKm: number | null;
  /** How many of those four rolling weeks had any running. */
  activePriorWeeks: number;
  /**
   * Last 7 days against that average, as a fraction (0.3 = 30% more). Null
   * without a baseline. Informational: week-to-week change is a weak injury
   * signal (Nielsen 2014, Frandsen 2025); single-run jumps matter more.
   */
  rampFraction: number | null;
  runsLast7Days: number;
  kmLast7Days: number;
  /** Share of last-28-day running time that was easy; null when nothing was classifiable. */
  easyShare: number | null;
  longestLast28Km: number | null;
  /** Medians of the last 28 days' runs; null without runs. */
  medianRunKm: number | null;
  medianRunMin: number | null;
  medianPaceSecPerKm: number | null;
  /** Calendar days (local) since the last run; 0 = today. */
  daysSinceLastRun: number | null;
  daysSinceHardRun: number | null;
  /**
   * Calendar days since the last long run: 75+ minutes, or clearly longer than
   * this runner's usual run (longRunThresholdKm: 1.2x the median, at least 5 km).
   */
  daysSinceLongRun: number | null;
}

function intensityOf(
  run: DatedEffort,
  bands: readonly PaceBand[] | null,
  hrMax: number | null
): PaceEffort | null {
  if (run.avgHr && hrMax) {
    const share = run.avgHr / hrMax;
    if (share < EASY_HR_CEILING) return 'easy';
    if (share < STEADY_HR_CEILING) return 'steady';
    if (share < THRESHOLD_HR_CEILING) return 'threshold';
    return 'hard';
  }
  if (run.runType === 'easy' || run.runType === 'recovery' || run.runType === 'long') return 'easy';
  if (run.runType === 'tempo') return 'threshold';
  if (run.runType === 'intervals' || run.runType === 'race') return 'hard';
  if (bands && run.distanceKm > 0 && run.durationSec > 0) {
    return paceEffort(run.durationSec / run.distanceKm, bands);
  }
  return null;
}

/** A run this long (minutes) is a long run whatever its distance. */
const LONG_RUN_MIN_MIN = 75;

/**
 * The distance that makes a run "long" for this runner: 20% past the usual
 * run, and at least 5 km. One rule for both the coach that prescribes the long
 * run and the count that notices it was done — otherwise a prescribed long run
 * would not register, and the next one would be prescribed right away.
 */
export function longRunThresholdKm(medianRunKm: number | null): number {
  return Math.max(5, (medianRunKm ?? 0) * 1.2);
}

const median = (xs: readonly number[]): number | null => {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] as number;
};

/** Whole local calendar days between a run and now (yesterday 20:00 → 1 at 08:00). */
export function calendarDaysAgo(atMs: number, now: Date): number {
  const at = new Date(atMs);
  const startOfAt = new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((startOfNow - startOfAt) / DAY_MS);
}

export function runningLoad(
  sessions: readonly WorkoutSession[],
  options: { bands: readonly PaceBand[] | null; hrMax: number | null; now?: Date }
): RunningLoad {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const runs = datedEfforts(sessions).filter((e) => e.discipline === 'running' && e.at <= nowMs);

  const classify = (run: DatedEffort): ClassifiedRun => ({
    ...run,
    secPerKm: run.distanceKm > 0 && run.durationSec > 0 ? run.durationSec / run.distanceKm : null,
    intensity: intensityOf(run, options.bands, options.hrMax),
  });

  const recentRuns = runs.filter((r) => nowMs - r.at <= 28 * DAY_MS).map(classify);
  const last7 = recentRuns.filter((r) => nowMs - r.at <= 7 * DAY_MS);

  const weeks = weeklyCardio(sessions, 5, now, 'running');
  const weeklyKm = weeks.map((w) => w.distanceKm);
  const thisWeekKm = weeklyKm[weeklyKm.length - 1] ?? 0;
  const kmLast7Days = last7.reduce((a, r) => a + r.distanceKm, 0);

  // Rolling, not calendar weeks: the last 7 days are compared with the four
  // 7-day blocks right before them, so no run is counted on both sides.
  const priorBlocks = [0, 0, 0, 0];
  for (const r of runs) {
    const ageDays = (nowMs - r.at) / DAY_MS;
    if (ageDays <= 7 || ageDays > 35) continue;
    const block = Math.min(3, Math.floor((ageDays - 7) / 7));
    priorBlocks[block] = (priorBlocks[block] ?? 0) + r.distanceKm;
  }
  const priorTotal = priorBlocks.reduce((a, b) => a + b, 0);
  const priorFourWeekAvgKm = priorTotal > 0 ? priorTotal / 4 : null;
  const activePriorWeeks = priorBlocks.filter((km) => km > 0).length;
  const rampFraction = priorFourWeekAvgKm !== null ? kmLast7Days / priorFourWeekAvgKm - 1 : null;

  let easySec = 0;
  let classifiedSec = 0;
  for (const r of recentRuns) {
    if (!r.intensity) continue;
    classifiedSec += r.durationSec;
    if (r.intensity === 'easy') easySec += r.durationSec;
  }

  const medianRunKm = median(recentRuns.filter((r) => r.distanceKm > 0).map((r) => r.distanceKm));
  const medianRunMin = median(
    recentRuns.filter((r) => r.durationSec > 0).map((r) => r.durationSec / 60)
  );
  const medianPaceSecPerKm = median(
    recentRuns.map((r) => r.secPerKm).filter((p): p is number => p !== null)
  );
  const longKm = longRunThresholdKm(medianRunKm);
  const isLong = (run: DatedEffort) =>
    run.durationSec >= LONG_RUN_MIN_MIN * 60 || run.distanceKm >= longKm;

  const lastOf = (pred: (r: ClassifiedRun) => boolean): number | null => {
    const all = runs.map(classify).filter(pred);
    const last = all[all.length - 1];
    return last ? calendarDaysAgo(last.at, now) : null;
  };

  const longest = recentRuns.reduce<number | null>(
    (m, r) => (r.distanceKm > 0 && (m === null || r.distanceKm > m) ? r.distanceKm : m),
    null
  );

  return {
    recentRuns,
    weeklyKm,
    thisWeekKm,
    priorFourWeekAvgKm,
    activePriorWeeks,
    rampFraction,
    runsLast7Days: last7.length,
    kmLast7Days,
    easyShare: classifiedSec > 0 ? easySec / classifiedSec : null,
    longestLast28Km: longest,
    medianRunKm,
    medianRunMin,
    medianPaceSecPerKm,
    daysSinceLastRun: lastOf(() => true),
    daysSinceHardRun: lastOf((r) => r.intensity === 'threshold' || r.intensity === 'hard'),
    daysSinceLongRun: lastOf(isLong),
  };
}

// ============================================================================
// Cardio stats across sessions — records, weekly totals, pace trend, the
// long-run spike baseline. Pure; every function takes `now` where time matters.
// ============================================================================
// Personal bests from manual entries follow one honest rule: an effort counts
// toward a distance only if it covered at least that distance and at most 10%
// more, and its time is scaled to the exact distance at the effort's average
// pace (a 5.2 km run in 26:00 counts as a 25:00 5K). GPS splits give the real
// best window — the fastest 5 consecutive kilometres inside a 12 km run.

import type { WorkoutSession } from '../../types';
import { getWeekStart, toLocalDateStr } from '../dateUtils';
import type { CardioDiscipline } from './activities';
import { type CardioEffort, cardioEffortsOf } from './session';

export interface RecordDistance {
  km: number;
  label: string;
}

export const RECORD_DISTANCES: readonly RecordDistance[] = [
  { km: 1, label: '1 ק״מ' },
  { km: 5, label: '5 ק״מ' },
  { km: 10, label: '10 ק״מ' },
  { km: 21.0975, label: 'חצי מרתון' },
  { km: 42.195, label: 'מרתון' },
];

/** An effort may run this much past a record distance and still count for it. */
const RECORD_OVERSHOOT = 1.1;

/** A dated effort, flattened out of its session. */
export interface DatedEffort extends CardioEffort {
  sessionId: string;
  /** Epoch ms of the session start. */
  at: number;
  date: string;
}

/** Every recorded cardio effort of completed sessions, oldest first. */
export function datedEfforts(sessions: readonly WorkoutSession[]): DatedEffort[] {
  const out: DatedEffort[] = [];
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    const at = new Date(s.startTime).getTime();
    if (Number.isNaN(at)) continue;
    for (const e of cardioEffortsOf(s)) {
      out.push({ ...e, sessionId: s.id, at, date: s.date || toLocalDateStr(new Date(at)) });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Fastest seconds over `km` inside one effort, or null if it cannot say. */
export function bestTimeFor(
  effort: CardioEffort,
  km: number
): { seconds: number; fromSplits: boolean } | null {
  let best: { seconds: number; fromSplits: boolean } | null = null;

  // Whole-km windows of GPS splits (1/5/10 km… exact multiples only).
  const whole = effort.splits.filter((s) => Math.abs(s.distanceKm - 1) < 0.001);
  if (Number.isInteger(km) && whole.length >= km) {
    let window = 0;
    for (let i = 0; i < whole.length; i++) {
      window += (whole[i] as { seconds: number }).seconds;
      if (i >= km) window -= (whole[i - km] as { seconds: number }).seconds;
      if (i >= km - 1 && (best === null || window < best.seconds))
        best = { seconds: window, fromSplits: true };
    }
  }

  // The whole effort, scaled to the exact distance at its average pace.
  if (
    effort.distanceKm >= km &&
    effort.distanceKm <= km * RECORD_OVERSHOOT &&
    effort.durationSec > 0
  ) {
    const scaled = Math.round((effort.durationSec * km) / effort.distanceKm);
    if (best === null || scaled < best.seconds) best = { seconds: scaled, fromSplits: false };
  }
  return best;
}

export interface RecordEntry {
  seconds: number;
  distanceKm: number;
  sessionId: string;
  date: string;
  at: number;
}

export interface CardioRecords {
  /** Fastest time per record distance (km → entry). */
  fastest: Map<number, RecordEntry>;
  /** Longest single effort. */
  longest: RecordEntry | null;
}

/** Running records (runs and treadmill runs) or another discipline's longest. */
export function cardioRecords(
  sessions: readonly WorkoutSession[],
  discipline: CardioDiscipline = 'running'
): CardioRecords {
  const fastest = new Map<number, RecordEntry>();
  let longest: RecordEntry | null = null;
  for (const e of datedEfforts(sessions)) {
    if (e.discipline !== discipline) continue;
    const entryBase = { sessionId: e.sessionId, date: e.date, at: e.at };
    if (e.distanceKm > 0 && (longest === null || e.distanceKm > longest.distanceKm)) {
      longest = { ...entryBase, seconds: e.durationSec, distanceKm: e.distanceKm };
    }
    if (discipline !== 'running') continue;
    for (const d of RECORD_DISTANCES) {
      const best = bestTimeFor(e, d.km);
      if (!best) continue;
      const current = fastest.get(d.km);
      if (!current || best.seconds < current.seconds) {
        fastest.set(d.km, { ...entryBase, seconds: best.seconds, distanceKm: d.km });
      }
    }
  }
  return { fastest, longest };
}

export interface RecordHit {
  kind: 'fastest' | 'longest';
  label: string;
  seconds: number;
  distanceKm: number;
}

/**
 * The records a given session holds right now (it set them and nothing beat
 * them since). The first effort ever is not a "record" — there was nothing to
 * beat — so a discipline needs an earlier effort before anything is claimed.
 */
export function recordsHeldBy(sessionId: string, sessions: readonly WorkoutSession[]): RecordHit[] {
  const efforts = datedEfforts(sessions);
  const mine = efforts.find((e) => e.sessionId === sessionId);
  if (!mine) return [];
  const hadEarlier = efforts.some((e) => e.discipline === mine.discipline && e.at < mine.at);
  if (!hadEarlier) return [];
  const records = cardioRecords(sessions, mine.discipline);
  const hits: RecordHit[] = [];
  for (const d of RECORD_DISTANCES) {
    const r = records.fastest.get(d.km);
    if (r?.sessionId === sessionId)
      hits.push({ kind: 'fastest', label: d.label, seconds: r.seconds, distanceKm: d.km });
  }
  if (records.longest?.sessionId === sessionId) {
    hits.push({
      kind: 'longest',
      label: 'הכי ארוך',
      seconds: records.longest.seconds,
      distanceKm: records.longest.distanceKm,
    });
  }
  return hits;
}

/** Longest effort of a discipline in the 30 days before `beforeMs` (exclusive). */
export function longestInPrior30Days(
  sessions: readonly WorkoutSession[],
  beforeMs: number,
  discipline: CardioDiscipline = 'running'
): number | null {
  const from = beforeMs - 30 * 24 * 60 * 60 * 1000;
  let longest: number | null = null;
  for (const e of datedEfforts(sessions)) {
    if (e.discipline !== discipline || e.at < from || e.at >= beforeMs) continue;
    if (e.distanceKm > 0 && (longest === null || e.distanceKm > longest)) longest = e.distanceKm;
  }
  return longest;
}

export interface CardioWeekPoint {
  /** Sunday of the week, YYYY-MM-DD. */
  weekStart: string;
  distanceKm: number;
  durationSec: number;
  count: number;
  isCurrent: boolean;
}

/**
 * Distance, time and count per Sunday-based week for the last `weeks` weeks,
 * oldest → newest. `discipline` narrows to running/cycling…; omit for all cardio.
 */
export function weeklyCardio(
  sessions: readonly WorkoutSession[],
  weeks = 12,
  now: Date = new Date(),
  discipline?: CardioDiscipline
): CardioWeekPoint[] {
  const thisWeek = getWeekStart(now);
  const points: CardioWeekPoint[] = [];
  const index = new Map<string, CardioWeekPoint>();
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(thisWeek);
    start.setDate(start.getDate() - i * 7);
    const key = toLocalDateStr(start);
    const point = { weekStart: key, distanceKm: 0, durationSec: 0, count: 0, isCurrent: i === 0 };
    points.push(point);
    index.set(key, point);
  }
  for (const e of datedEfforts(sessions)) {
    if (discipline && e.discipline !== discipline) continue;
    const point = index.get(toLocalDateStr(getWeekStart(new Date(e.at))));
    if (!point) continue;
    point.distanceKm += e.distanceKm;
    point.durationSec += e.durationSec;
    point.count += 1;
  }
  return points;
}

export interface PacePoint {
  at: number;
  date: string;
  secPerKm: number;
  distanceKm: number;
}

/** Average pace of each run of at least 1 km, oldest → newest. */
export function runPaceTrend(sessions: readonly WorkoutSession[], limit = 20): PacePoint[] {
  return datedEfforts(sessions)
    .filter((e) => e.discipline === 'running' && e.distanceKm >= 1 && e.durationSec > 0)
    .map((e) => ({
      at: e.at,
      date: e.date,
      secPerKm: e.durationSec / e.distanceKm,
      distanceKm: e.distanceKm,
    }))
    .slice(-limit);
}

/**
 * The strongest recent run for a race estimate: within `days`, at least 3 km,
 * the one whose Riegel-equivalent 10K is fastest.
 */
export function bestRecentRun(
  sessions: readonly WorkoutSession[],
  now: Date = new Date(),
  days = 90
): DatedEffort | null {
  const from = now.getTime() - days * 24 * 60 * 60 * 1000;
  let best: DatedEffort | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const e of datedEfforts(sessions)) {
    if (
      e.discipline !== 'running' ||
      e.at < from ||
      e.distanceKm < 3 ||
      e.distanceKm > 21.1 ||
      e.durationSec <= 0
    )
      continue;
    const tenK = e.durationSec * (10 / e.distanceKm) ** 1.06;
    if (tenK < bestScore) {
      bestScore = tenK;
      best = e;
    }
  }
  return best;
}

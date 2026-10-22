// ============================================================================
// Personal training paces — from the runner's own recent best effort.
// ============================================================================
// The reference is the best recent run (bestRecentRun: 3–21 km, last 90 days)
// turned into an equivalent 5K with Riegel — trusted from 5K to the half
// (Vickers & Vertosick 2016), so a training run gives a low-confidence but
// useful anchor. Each band is a fraction of that 5K SPEED, checked against the
// Daniels–Gilbert VDOT equations for 5K times of ~19–36 min:
//
//   easy / long   68–80%   5K pace +55…+160 s/km; conversational
//   marathon      86–91%   5K pace +30…+45 s/km
//   threshold     93–95%   5K pace ≈ +16 s/km at every level; ~1-hour race pace
//   interval     101–105%  5K pace −5…−17 s/km; 3–5 min reps
//   repetition   106–110%  about interval pace −15 s/km; short reps
//
// Paces are seconds per km; a bigger number is slower.

import type { WorkoutSession } from '../../types';
import { type DatedEffort, bestRecentRun, datedEfforts, predictRaceSec } from '../../utils/cardio';

export type PaceBandId = 'easy' | 'marathon' | 'threshold' | 'interval' | 'repetition';

export interface PaceBand {
  id: PaceBandId;
  label: string;
  /** Faster edge, sec/km. */
  fastSec: number;
  /** Slower edge, sec/km. */
  slowSec: number;
}

/** [slower, faster] fractions of 5K speed. */
const BAND_FRACTIONS: Readonly<Record<PaceBandId, readonly [number, number]>> = {
  easy: [0.68, 0.8],
  marathon: [0.86, 0.91],
  threshold: [0.93, 0.95],
  interval: [1.01, 1.05],
  repetition: [1.06, 1.1],
};

export const PACE_BAND_LABELS: Readonly<Record<PaceBandId, string>> = {
  easy: 'קל וארוך',
  marathon: 'קצב מרתון',
  threshold: 'טמפו (סף)',
  interval: 'אינטרוולים',
  repetition: 'חזרות קצרות',
};

/**
 * How far the bands can be trusted. Riegel assumes a maximal effort; from an
 * ordinary training run it makes every band too slow and every run look hard.
 *   high — the reference was a race / tempo / intervals, its heart rate was
 *          ≥85% of max, or it was clearly faster (6% to 35%) than the usual run;
 *   low  — it was a run like the others: a first estimate only. Paces are then
 *          shown as a starting point, and runs are not graded by pace.
 */
export type ReferenceConfidence = 'high' | 'low';

const HARD_EFFORT_HR_SHARE = 0.85;
const HARD_EFFORT_GAP = 0.06;
/**
 * Faster than this share of the usual pace, with nothing else saying it was a
 * hard effort, is more likely a GPS jump or a mistyped distance than a run.
 * (A real 5K is about 20–32% faster than easy pace; this leaves room for it.)
 */
const IMPLAUSIBLE_GAP = 0.35;
const PEER_RUNS_NEEDED = 3;

export interface PaceReference {
  /** Equivalent 5K time, seconds. */
  fiveKSec: number;
  /** The run it came from. */
  sessionId: string;
  distanceKm: number;
  durationSec: number;
  date: string;
  confidence: ReferenceConfidence;
}

/** Median pace (sec/km) of the other 3 km+ runs in 90 days; null with too few. */
function peerMedianPace(
  best: DatedEffort,
  sessions: readonly WorkoutSession[],
  now: Date
): number | null {
  const from = now.getTime() - 90 * 24 * 60 * 60 * 1000;
  const peerPaces = datedEfforts(sessions)
    .filter(
      (e) =>
        e.discipline === 'running' &&
        e.at >= from &&
        e.at <= now.getTime() &&
        e.sessionId !== best.sessionId &&
        e.distanceKm >= 3 &&
        e.durationSec > 0
    )
    .map((e) => e.durationSec / e.distanceKm)
    .sort((a, b) => a - b);
  if (peerPaces.length < PEER_RUNS_NEEDED) return null;
  return peerPaces[Math.floor(peerPaces.length / 2)] as number;
}

/** A race / tempo / intervals, or a high heart rate: a real effort, not a glitch. */
function markedHard(best: DatedEffort, hrMax: number | null): boolean {
  if (best.runType === 'race' || best.runType === 'tempo' || best.runType === 'intervals') {
    return true;
  }
  return Boolean(best.avgHr && hrMax && best.avgHr / hrMax >= HARD_EFFORT_HR_SHARE);
}

/** How many suspect "best" runs to skip before giving up on a reference. */
const MAX_SKIPPED = 3;

/** The runner's current 5K-equivalent, or null without a usable recent run. */
export function paceReference(
  sessions: readonly WorkoutSession[],
  now: Date = new Date(),
  hrMax: number | null = null
): PaceReference | null {
  let pool = sessions;
  for (let skipped = 0; skipped <= MAX_SKIPPED; skipped++) {
    const best = bestRecentRun(pool, now);
    if (!best) return null;
    const hard = markedHard(best, hrMax);
    const median = hard ? null : peerMedianPace(best, sessions, now);
    const pace = best.durationSec / best.distanceKm;
    // Far faster than usual with nothing saying it was hard: a GPS jump or a
    // mistyped distance. Skip it, or every pace would be built on it.
    if (median !== null && pace < median * (1 - IMPLAUSIBLE_GAP)) {
      pool = pool.filter((s) => s.id !== best.sessionId);
      continue;
    }
    const fiveKSec = predictRaceSec(best.durationSec, best.distanceKm, 5);
    if (!fiveKSec) return null;
    const confidence: ReferenceConfidence =
      hard || (median !== null && pace <= median * (1 - HARD_EFFORT_GAP)) ? 'high' : 'low';
    return {
      fiveKSec,
      sessionId: best.sessionId,
      distanceKm: best.distanceKm,
      durationSec: best.durationSec,
      date: best.date,
      confidence,
    };
  }
  return null;
}

/** The five bands from an equivalent 5K time. */
export function paceBandsFrom(fiveKSec: number): PaceBand[] {
  const fiveKPace = fiveKSec / 5;
  return (Object.keys(BAND_FRACTIONS) as PaceBandId[]).map((id) => {
    const [slowFrac, fastFrac] = BAND_FRACTIONS[id];
    return {
      id,
      label: PACE_BAND_LABELS[id],
      fastSec: Math.round(fiveKPace / fastFrac),
      slowSec: Math.round(fiveKPace / slowFrac),
    };
  });
}

export function paceBand(bands: readonly PaceBand[], id: PaceBandId): PaceBand | null {
  return bands.find((b) => b.id === id) ?? null;
}

/** How hard an average pace was, against the runner's own bands. */
export type PaceEffort = 'easy' | 'steady' | 'threshold' | 'hard';

export const PACE_EFFORT_LABELS: Readonly<Record<PaceEffort, string>> = {
  easy: 'קל',
  steady: 'בינוני',
  threshold: 'טמפו',
  hard: 'קשה',
};

/**
 * Easy up to the easy band's fast edge (plus a few seconds of GPS noise),
 * steady up to threshold, threshold through its band, hard beyond it.
 */
export function paceEffort(secPerKm: number, bands: readonly PaceBand[]): PaceEffort | null {
  const easy = paceBand(bands, 'easy');
  const threshold = paceBand(bands, 'threshold');
  if (!easy || !threshold || !(secPerKm > 0)) return null;
  const NOISE_SEC = 5;
  if (secPerKm >= easy.fastSec - NOISE_SEC) return 'easy';
  if (secPerKm > threshold.slowSec) return 'steady';
  if (secPerKm >= threshold.fastSec - NOISE_SEC) return 'threshold';
  return 'hard';
}

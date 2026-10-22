// ============================================================================
// The cardio detail screen's numbers — which part it is about, the session
// totals, and the coach notes for the running part. Pure, so it is tested
// without rendering.
// ============================================================================
// A session can hold several cardio parts (a walk to warm up, the run, a walk
// home; or a gym circuit of treadmill, bike and rower). Totals add every part;
// anything that describes ONE effort — splits, the route, the coach notes, the
// long-run jump — reads one part, never the first part by accident.

import {
  type RunInsight,
  paceBandsFrom,
  paceReference,
  runInsights,
} from '../../../services/running';
import type { WorkoutSession } from '../../../types';
import {
  type CardioEffort,
  cardioActivityConfig,
  cardioEffortsOf,
  effortCalories,
  longestInPrior30Days,
} from '../../../utils/cardio';

/** The part the screen is about: the longest running part, else the longest part. */
export function primaryEffort(efforts: readonly CardioEffort[]): CardioEffort | null {
  const runs = efforts.filter((e) => e.discipline === 'running');
  const pool = runs.length > 0 ? runs : efforts;
  let best: CardioEffort | null = null;
  for (const e of pool) {
    if (best === null || e.durationSec > best.durationSec) best = e;
  }
  return best;
}

export interface CardioSummary {
  distanceKm: number;
  durationSec: number;
  /**
   * Every part is the same kind of effort (discipline, distance unit and pace
   * style) AND recorded a distance, so the distances add up and one average
   * pace means something. A part without a distance (a bike machine next to a
   * ride) would otherwise slow the average down.
   */
  uniform: boolean;
  /** Duration-weighted over the parts that recorded it. */
  avgHr: number | null;
  maxHr: number | null;
  elevationGainM: number;
  /** Highest perceived effort of any part. */
  effort: number | null;
  calories: number | null;
  /** Every part's calories came from the watch, none from the estimate. */
  caloriesFromWatch: boolean;
}

function sameKind(a: CardioEffort, b: CardioEffort): boolean {
  const ca = cardioActivityConfig(a.activity);
  const cb = cardioActivityConfig(b.activity);
  return (
    a.discipline === b.discipline &&
    ca.paceStyle === cb.paceStyle &&
    ca.distanceUnit === cb.distanceUnit
  );
}

/** Whole-session numbers over every part. */
export function summarizeEfforts(
  efforts: readonly CardioEffort[],
  weightKg: number | null | undefined,
  sessionCalories: number | null = null
): CardioSummary {
  let distanceKm = 0;
  let durationSec = 0;
  let hrWeighted = 0;
  let hrWeight = 0;
  let maxHr: number | null = null;
  let elevationGainM = 0;
  let effort: number | null = null;
  let estimated: number | null = 0;

  for (const e of efforts) {
    distanceKm += e.distanceKm;
    durationSec += e.durationSec;
    if (e.avgHr !== null) {
      const w = e.durationSec > 0 ? e.durationSec : 1;
      hrWeighted += e.avgHr * w;
      hrWeight += w;
    }
    if (e.maxHr !== null) maxHr = Math.max(maxHr ?? 0, e.maxHr);
    elevationGainM += e.elevationGainM;
    if (e.effort !== null) effort = Math.max(effort ?? 0, e.effort);
    // One part without a number makes the sum a part-total: show none.
    const kcal = effortCalories(e, weightKg);
    estimated = kcal === null || estimated === null ? null : estimated + kcal;
  }

  const first = efforts[0];
  return {
    distanceKm,
    durationSec,
    uniform: first !== undefined && efforts.every((e) => e.distanceKm > 0 && sameKind(e, first)),
    avgHr: hrWeight > 0 ? Math.round(hrWeighted / hrWeight) : null,
    maxHr,
    elevationGainM,
    effort,
    calories: sessionCalories ?? (efforts.length > 0 ? estimated : null),
    caloriesFromWatch: efforts.length > 0 && efforts.every((e) => e.typedCalories !== null),
  };
}

const startMs = (s: Pick<WorkoutSession, 'startTime'>) => new Date(s.startTime).getTime();

/**
 * The coach notes for one running part. Personal paces come from the runs
 * BEFORE this one — a run judged against paces derived from itself would
 * always look "too fast for an easy run".
 */
export function insightsForRun(
  effort: CardioEffort,
  session: Pick<WorkoutSession, 'id' | 'startTime'>,
  sessions: readonly WorkoutSession[],
  hrMax: number | null
): RunInsight[] {
  if (effort.discipline !== 'running') return [];
  const atMs = startMs(session);
  const at = Number.isNaN(atMs) ? new Date() : new Date(atMs);
  const before = sessions.filter((s) => s.id !== session.id && startMs(s) < at.getTime());
  const reference = paceReference(before, at, hrMax);
  return runInsights({
    effort,
    // Only paces from a real effort grade a run; a first estimate from an
    // ordinary run would call every run "too fast".
    bands: reference?.confidence === 'high' ? paceBandsFrom(reference.fiveKSec) : null,
    hrMax,
    longestPrior30Km: longestInPrior30Days(sessions, at.getTime(), 'running'),
    at,
  });
}

/** True when no completed run started after this session. */
export function isLatestRun(
  session: Pick<WorkoutSession, 'id' | 'startTime'>,
  sessions: readonly WorkoutSession[]
): boolean {
  const at = startMs(session);
  if (Number.isNaN(at)) return false;
  return !sessions.some(
    (s) =>
      s.id !== session.id &&
      s.status === 'completed' &&
      startMs(s) > at &&
      cardioEffortsOf(s).some((e) => e.discipline === 'running')
  );
}

/** "הליכה וריצה" — the parts of a session by name, each once, in order. */
export function partsLabel(efforts: readonly CardioEffort[]): string {
  const labels = [...new Set(efforts.map((e) => cardioActivityConfig(e.activity).label))];
  if (labels.length <= 1) return labels[0] ?? '';
  const last = labels[labels.length - 1] as string;
  // "ו" joins a Hebrew word directly; before Latin letters (HIIT) it takes a hyphen.
  const and = /^[A-Za-z]/.test(last) ? 'ו-' : 'ו';
  return `${labels.slice(0, -1).join(', ')} ${and}${last}`;
}

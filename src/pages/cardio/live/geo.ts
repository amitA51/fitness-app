// ============================================================================
// Live-tracking geometry — pure. Distance from GPS fixes, km splits, climb,
// rolling pace and route simplification.
// ============================================================================
// Phone GPS wanders by several metres even when standing still, so a naive sum
// of point-to-point distances grows on a park bench. Three filters keep the
// total honest: drop fixes with poor accuracy, ignore steps shorter than a few
// metres (the anchor stays put so slow walking still accumulates), and drop
// steps that imply an impossible speed for the activity (a GPS jump).

import type { CardioActivity, CardioSplit } from '../../../types';

export interface GeoFix {
  lat: number;
  lng: number;
  /** Horizontal accuracy, metres (68% radius). */
  accuracy: number;
  altitude: number | null;
  /** Epoch ms. */
  t: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Fixes less accurate than this are shown as "weak signal" and not counted. */
export const MAX_ACCURACY_M = 30;
/** Steps shorter than this are GPS wander — the anchor is kept. */
export const MIN_STEP_M = 3;
/** Altitude must move this much before it counts as climb (barometric noise). */
const CLIMB_HYSTERESIS_M = 3;

/** Fastest believable speed per activity, m/s — anything faster is a jump. */
export function maxSpeedMs(activity: CardioActivity): number {
  switch (activity) {
    case 'cycle':
      return 25;
    case 'walk':
    case 'hike':
      return 7;
    default:
      return 12;
  }
}

export interface TrackState {
  /** Last accepted fix — the anchor the next step is measured from. */
  anchor: GeoFix | null;
  distanceM: number;
  elevationGainM: number;
  /** Altitude at which climb was last counted. */
  climbBase: number | null;
  /** Route as [lat, lng] — every accepted fix. */
  points: [number, number][];
  /** Completed km splits. */
  splits: CardioSplit[];
  /** Moving seconds at the start of the current (unfinished) split. */
  splitStartSec: number;
}

export const EMPTY_TRACK: TrackState = {
  anchor: null,
  distanceM: 0,
  elevationGainM: 0,
  climbBase: null,
  points: [],
  splits: [],
  splitStartSec: 0,
};

export type FixVerdict = 'start' | 'accepted' | 'inaccurate' | 'jitter' | 'jump';

/**
 * Fold one fix into the track. `movingSec` is the moving time at the fix,
 * used to time km splits (the crossing instant is interpolated inside the step).
 */
export function applyFix(
  state: TrackState,
  fix: GeoFix,
  activity: CardioActivity,
  movingSec: number
): { state: TrackState; verdict: FixVerdict; stepM: number } {
  // `!(accuracy <= MAX)` also rejects a missing / NaN accuracy.
  if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng) || !(fix.accuracy <= MAX_ACCURACY_M)) {
    return { state, verdict: 'inaccurate', stepM: 0 };
  }
  const anchor = state.anchor;
  if (!anchor) {
    return {
      state: {
        ...state,
        anchor: fix,
        climbBase: fix.altitude,
        points: [...state.points, [fix.lat, fix.lng]],
      },
      verdict: 'start',
      stepM: 0,
    };
  }

  const stepM = haversineM(anchor, fix);
  // A step inside the fix's own error circle is wander, not movement: at 20 m
  // accuracy a phone standing still "moves" 5-15 m per fix.
  if (stepM < Math.max(MIN_STEP_M, fix.accuracy * 0.5))
    return { state, verdict: 'jitter', stepM: 0 };
  const dt = (fix.t - anchor.t) / 1000;
  if (dt > 0 && stepM / dt > maxSpeedMs(activity)) return { state, verdict: 'jump', stepM: 0 };

  const before = state.distanceM;
  const after = before + stepM;

  // km splits crossed by this step (a long gap can cross more than one).
  const splits = [...state.splits];
  let splitStartSec = state.splitStartSec;
  const prevMovingSec = Math.max(splitStartSec, movingSec - Math.max(0, dt));
  for (let km = Math.floor(before / 1000) + 1; km * 1000 <= after; km++) {
    const frac = (km * 1000 - before) / stepM;
    const crossSec = prevMovingSec + frac * (movingSec - prevMovingSec);
    splits.push({
      index: km,
      distanceKm: 1,
      seconds: Math.max(1, Math.round(crossSec - splitStartSec)),
    });
    splitStartSec = crossSec;
  }

  // Climb with hysteresis: count a rise only once it clears the noise band;
  // a drop lowers the base so the next climb is measured from the valley.
  let elevationGainM = state.elevationGainM;
  let climbBase = state.climbBase;
  if (fix.altitude !== null && Number.isFinite(fix.altitude)) {
    if (climbBase === null) climbBase = fix.altitude;
    else if (fix.altitude - climbBase >= CLIMB_HYSTERESIS_M) {
      elevationGainM += fix.altitude - climbBase;
      climbBase = fix.altitude;
    } else if (climbBase - fix.altitude >= CLIMB_HYSTERESIS_M) {
      climbBase = fix.altitude;
    }
  }

  return {
    state: {
      anchor: fix,
      distanceM: after,
      elevationGainM,
      climbBase,
      points: [...state.points, [fix.lat, fix.lng]],
      splits,
      splitStartSec,
    },
    verdict: 'accepted',
    stepM,
  };
}

/** The partial last split at finish (only when at least 50 m of it exists). */
export function finalSplit(state: TrackState, movingSec: number): CardioSplit | null {
  const partialM = state.distanceM - state.splits.length * 1000;
  if (partialM < 50) return null;
  return {
    index: state.splits.length + 1,
    distanceKm: Math.round(partialM) / 1000,
    seconds: Math.max(1, Math.round(movingSec - state.splitStartSec)),
  };
}

/** Recent [movingSec, distanceM] samples → current pace, s/km. */
export interface PaceSample {
  sec: number;
  distanceM: number;
}

/** Window the "current pace" looks back over. */
export const PACE_WINDOW_SEC = 30;

export function rollingPaceSecPerKm(samples: readonly PaceSample[]): number | null {
  if (samples.length < 2) return null;
  const last = samples[samples.length - 1] as PaceSample;
  const first =
    samples.find((s) => last.sec - s.sec <= PACE_WINDOW_SEC) ?? (samples[0] as PaceSample);
  const dM = last.distanceM - first.distanceM;
  const dS = last.sec - first.sec;
  if (dM < 10 || dS <= 0) return null;
  return dS / (dM / 1000);
}

// ---------------------------------------------------------------------------
// Route simplification (Douglas–Peucker on a local flat projection)
// ---------------------------------------------------------------------------

function toXY(p: [number, number], lat0: number): [number, number] {
  const x = toRad(p[1]) * Math.cos(toRad(lat0)) * EARTH_RADIUS_M;
  const y = toRad(p[0]) * EARTH_RADIUS_M;
  return [x, y];
}

function perpendicularM(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function douglasPeucker(
  points: readonly [number, number][],
  toleranceM: number
): [number, number][] {
  if (points.length <= 2) return [...points];
  const lat0 = (points[0] as [number, number])[0];
  const xy = points.map((p) => toXY(p, lat0));
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop() as [number, number];
    let maxD = 0;
    let idx = -1;
    for (let i = start + 1; i < end; i++) {
      const d = perpendicularM(
        xy[i] as [number, number],
        xy[start] as [number, number],
        xy[end] as [number, number]
      );
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > toleranceM) {
      keep[idx] = 1;
      stack.push([start, idx], [idx, end]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/** Simplify a route to at most `maxPoints`, loosening the tolerance as needed. */
export function simplifyRoute(
  points: readonly [number, number][],
  maxPoints = 400
): [number, number][] {
  let tolerance = 3;
  let out = douglasPeucker(points, tolerance);
  while (out.length > maxPoints && tolerance < 200) {
    tolerance *= 1.6;
    out = douglasPeucker(points, tolerance);
  }
  // Five decimals ≈ 1 m — enough for a map, a third of the JSON.
  return out.map(([lat, lng]) => [Number(lat.toFixed(5)), Number(lng.toFixed(5))]);
}

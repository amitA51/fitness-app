// ============================================================================
// Strava activity → cardio WorkoutSession
// ============================================================================
// Pure. The `strava` edge function hands the app trimmed activities (shapes
// below mirror supabase/functions/strava/stravaApi.ts); this module decides
// which ones are cardio the app knows, and builds the session the same way the
// log sheet does — so an imported run reads like any other run everywhere.

import { simplifyRoute } from '../../pages/cardio/live/geo';
import type { CardioActivity, CardioSplit, RunType, WorkoutSession } from '../../types';
import { buildCardioSession, cardioActivityConfig } from '../../utils/cardio';

/** One activity from the list, as the edge function trims it. */
export interface StravaActivitySummary {
  id: number;
  /**
   * The app's session id for this activity, minted by the edge function from
   * the user and the activity — the same on every device and every import, so
   * an activity can never be saved twice.
   */
  sessionId: string;
  name: string;
  sportType: string;
  startDate: string;
  startEpoch: number;
  distanceM: number;
  movingSec: number;
  elapsedSec: number;
  elevationGainM: number;
  avgHr: number | null;
  maxHr: number | null;
  trainer: boolean;
  workoutType: number | null;
  kilojoules: number | null;
  polyline: string | null;
}

export interface StravaSplit {
  distanceM: number;
  movingSec: number;
  elapsedSec: number;
  avgHr: number | null;
}

/** What only the per-activity endpoint knows. */
export interface StravaActivityDetail {
  id: number;
  calories: number | null;
  splits: StravaSplit[];
  missing?: boolean;
}

// ---------------------------------------------------------------------------
// Which Strava sports are cardio here
// ---------------------------------------------------------------------------

/**
 * Strava `sport_type` → the app's activity. Strength, yoga and the generic
 * "Workout" are left out on purpose: lifting is logged in the app itself, and a
 * watch "workout" says nothing about distance or pace.
 */
const SPORT_TO_ACTIVITY: Readonly<Record<string, CardioActivity>> = {
  Run: 'run',
  TrailRun: 'run',
  VirtualRun: 'treadmill',
  Walk: 'walk',
  Hike: 'hike',
  Ride: 'cycle',
  MountainBikeRide: 'cycle',
  GravelRide: 'cycle',
  EBikeRide: 'cycle',
  EMountainBikeRide: 'cycle',
  VirtualRide: 'indoor_cycle',
  Swim: 'swim',
  Rowing: 'row',
  VirtualRow: 'row',
  Elliptical: 'elliptical',
  StairStepper: 'stairs',
  HighIntensityIntervalTraining: 'hiit',
};

/** The activity an imported effort is logged as, or null to skip it. */
export function activityForStrava(
  a: Pick<StravaActivitySummary, 'sportType' | 'trainer'>
): CardioActivity | null {
  const activity = SPORT_TO_ACTIVITY[a.sportType] ?? null;
  // "Trainer" is Strava's indoor flag: a run on the treadmill, a ride on rollers.
  if (a.trainer && activity === 'run') return 'treadmill';
  if (a.trainer && activity === 'cycle') return 'indoor_cycle';
  return activity;
}

/** Strava's `workout_type` for runs: 1 = race, 2 = long run. */
function runTypeOf(workoutType: number | null): RunType | null {
  if (workoutType === 1) return 'race';
  if (workoutType === 2) return 'long';
  return null;
}

// ---------------------------------------------------------------------------
// Route and splits
// ---------------------------------------------------------------------------

/** Google's encoded polyline (precision 5) → [lat, lng] pairs. */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = (): number | null => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) return null;
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    const dLat = next();
    const dLng = next();
    if (dLat === null || dLng === null) break;
    lat += dLat;
    lng += dLng;
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/** A Strava km split this close to 1,000 m is a whole kilometre (records match exact km). */
const WHOLE_KM_TOLERANCE_M = 20;

/** Km splits of a pace-per-km activity; empty for anything else. */
export function splitsFromStrava(
  activity: CardioActivity,
  splits: readonly StravaSplit[]
): CardioSplit[] {
  if (cardioActivityConfig(activity).paceStyle !== 'per_km') return [];
  const out: CardioSplit[] = [];
  splits.forEach((s, i) => {
    const seconds = s.movingSec > 0 ? s.movingSec : s.elapsedSec;
    if (s.distanceM <= 0 || seconds <= 0) return;
    const isLast = i === splits.length - 1;
    const whole = !isLast && Math.abs(s.distanceM - 1000) <= WHOLE_KM_TOLERANCE_M;
    const split: CardioSplit = {
      index: out.length + 1,
      distanceKm: whole ? 1 : Math.round(s.distanceM) / 1000,
      seconds: Math.round(seconds),
    };
    if (s.avgHr && s.avgHr > 0) split.avgHr = Math.round(s.avgHr);
    out.push(split);
  });
  return out;
}

// ---------------------------------------------------------------------------
// The session
// ---------------------------------------------------------------------------

const positiveOrNull = (n: number | null | undefined): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : null;

/**
 * Calories: Strava's own figure from the detail, else the work of a ride
 * (kJ ≈ kcal burned at the body's ~24% efficiency), else null so the app's MET
 * estimate fills in.
 */
function caloriesOf(
  summary: StravaActivitySummary,
  detail: StravaActivityDetail | null
): number | null {
  return positiveOrNull(detail?.calories) ?? positiveOrNull(summary.kilojoules);
}

/**
 * The cardio session of one Strava activity, or null when its sport is not
 * cardio the app tracks. `detail` may be null — the list alone is enough, and
 * the splits are filled in later by `withStravaDetail`.
 */
export function stravaSessionFrom(
  summary: StravaActivitySummary,
  detail: StravaActivityDetail | null,
  weightKg: number | null,
  now: number = Date.now()
): WorkoutSession | null {
  const activity = activityForStrava(summary);
  if (!activity) return null;
  if (summary.movingSec <= 0 && summary.elapsedSec <= 0) return null;

  const start = new Date(summary.startDate);
  const durationSec = summary.movingSec > 0 ? summary.movingSec : summary.elapsedSec;
  const wallSec = Math.max(durationSec, summary.elapsedSec);
  const points = summary.polyline ? decodePolyline(summary.polyline) : [];

  const session = buildCardioSession(
    {
      activity,
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + wallSec * 1000).toISOString(),
      durationSec,
      distanceKm: summary.distanceM > 0 ? summary.distanceM / 1000 : null,
      avgHr: positiveOrNull(summary.avgHr),
      maxHr: positiveOrNull(summary.maxHr),
      elevationGainM: positiveOrNull(summary.elevationGainM),
      calories: caloriesOf(summary, detail),
      runType: runTypeOf(summary.workoutType),
      notes: summary.name.trim(),
      splits: detail ? splitsFromStrava(activity, detail.splits) : undefined,
      route: points.length >= 2 ? { points: simplifyRoute(points), source: 'strava' } : undefined,
      weightKg,
    },
    now
  );

  return {
    ...session,
    id: summary.sessionId,
    exercises: session.exercises.map((ex) => ({
      ...ex,
      external: { provider: 'strava', activityId: summary.id, detailed: detail !== null },
    })),
  };
}

/** The Strava activity id of an imported session that still lacks its detail, else null. */
export function pendingStravaDetailId(session: WorkoutSession): number | null {
  for (const ex of session.exercises ?? []) {
    if (ex.external?.provider === 'strava' && !ex.external.detailed) return ex.external.activityId;
  }
  return null;
}

/**
 * The session with the activity's detail folded in: Strava's calories and the
 * km splits. Always marks it detailed — a missing activity is not retried.
 */
export function withStravaDetail(
  session: WorkoutSession,
  detail: StravaActivityDetail,
  now: number = Date.now()
): WorkoutSession {
  const nowISO = new Date(now).toISOString();
  const calories = detail.missing ? null : positiveOrNull(detail.calories);
  let caloriesBurned = session.caloriesBurned;

  const exercises = session.exercises.map((ex) => {
    if (ex.external?.provider !== 'strava' || ex.external.activityId !== detail.id) return ex;
    const splits =
      detail.missing || !ex.cardioActivity
        ? []
        : splitsFromStrava(ex.cardioActivity, detail.splits);
    if (calories !== null) caloriesBurned = Math.round(calories);
    return {
      ...ex,
      external: { ...ex.external, detailed: true },
      sets: ex.sets.map((set, i) =>
        i === 0
          ? {
              ...set,
              ...(calories !== null ? { calories } : {}),
              ...(splits.length > 0 ? { splits } : {}),
            }
          : set
      ),
    };
  });

  return { ...session, exercises, caloriesBurned, updatedAt: nowISO };
}

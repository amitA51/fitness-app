// ============================================================================
// Cardio ⟷ WorkoutSession — reading cardio out of a session, and building one.
// ============================================================================
// A cardio effort is stored as an ordinary WorkoutSession whose exercise is
// tracked as 'cardio' and whose sets carry `duration` (s) + `distanceKm`. That
// keeps the calendar, streak, week count, sync and coach plumbing working for
// free; this module is where the cardio meaning is read back out.

import type {
  CardioActivity,
  CardioRoute,
  CardioSplit,
  RunType,
  TrackingType,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '../../types';
import { toLocalDateStr } from '../dateUtils';
import { generateId } from '../id';
import {
  CATALOG_NAME_TO_ACTIVITY,
  type CardioDiscipline,
  cardioActivityConfig,
  cardioDiscipline,
} from './activities';
import { estimateCardioCalories, speedKmh } from './math';

/** Anything that names an exercise and may carry tracking metadata. */
export interface CardioLike {
  trackingType?: TrackingType;
  cardioActivity?: CardioActivity;
  name?: string;
  exerciseName?: string;
}

/**
 * The cardio activity of an exercise, or null for a weight × reps exercise.
 * Order: an explicit 'weight_reps' wins; then the stored snapshot; then the
 * built-in catalog name (older sessions and already-seeded libraries carry no
 * field); then an explicit 'cardio' with no activity is "other". A name alone
 * never makes an exercise cardio — "Barbell Row" must stay a lift.
 */
export function resolveCardioActivity(ex: CardioLike | null | undefined): CardioActivity | null {
  if (!ex || ex.trackingType === 'weight_reps') return null;
  if (ex.cardioActivity) return ex.cardioActivity;
  const byName =
    CATALOG_NAME_TO_ACTIVITY.get(ex.name ?? '') ??
    CATALOG_NAME_TO_ACTIVITY.get(ex.exerciseName ?? '');
  if (byName) return byName;
  return ex.trackingType === 'cardio' ? 'other' : null;
}

export const isCardioExercise = (ex: CardioLike | null | undefined): boolean =>
  resolveCardioActivity(ex) !== null;

/** A cardio set that actually recorded something. */
export const cardioSetHasData = (s: Pick<WorkoutSet, 'duration' | 'distanceKm'>): boolean =>
  (s.duration ?? 0) > 0 || (s.distanceKm ?? 0) > 0;

/** One cardio exercise of a session, summed over its completed sets. */
export interface CardioEffort {
  exerciseId: string;
  exerciseName: string;
  activity: CardioActivity;
  discipline: CardioDiscipline;
  distanceKm: number;
  durationSec: number;
  /** Duration-weighted average heart rate, or null. */
  avgHr: number | null;
  maxHr: number | null;
  elevationGainM: number;
  /** Calories the user typed, summed; null when none were typed. */
  typedCalories: number | null;
  /** Highest RPE logged, or null. */
  effort: number | null;
  runType: RunType | null;
  splits: CardioSplit[];
  route: CardioRoute | null;
  /** Number of completed sets (intervals). */
  sets: number;
}

// Either completion marker counts: live sets carry completedAt, while sets a
// coach typed in (older edits) may carry only isCompleted.
const done = (s: WorkoutSet) => (!!s.completedAt || s.isCompleted) && !s.skipped;

/** Sum the completed sets of one cardio exercise. Null when nothing was recorded. */
export function cardioEffortOf(ex: WorkoutExercise): CardioEffort | null {
  const activity = resolveCardioActivity(ex);
  if (!activity) return null;
  const sets = (ex.sets ?? []).filter((s) => done(s) && cardioSetHasData(s));
  if (sets.length === 0) return null;

  let distanceKm = 0;
  let durationSec = 0;
  let hrWeighted = 0;
  let hrWeight = 0;
  let maxHr: number | null = null;
  let elevationGainM = 0;
  let typedCalories: number | null = null;
  let effort: number | null = null;
  const splits: CardioSplit[] = [];

  for (const s of sets) {
    const dur = s.duration ?? 0;
    distanceKm += s.distanceKm ?? 0;
    durationSec += dur;
    if (s.avgHr && s.avgHr > 0) {
      const w = dur > 0 ? dur : 1;
      hrWeighted += s.avgHr * w;
      hrWeight += w;
    }
    if (s.maxHr && s.maxHr > 0) maxHr = Math.max(maxHr ?? 0, s.maxHr);
    elevationGainM += s.elevationGainM ?? 0;
    if (s.calories && s.calories > 0) typedCalories = (typedCalories ?? 0) + s.calories;
    if (s.rpe && s.rpe > 0) effort = Math.max(effort ?? 0, s.rpe);
    if (s.splits?.length) splits.push(...s.splits);
  }

  return {
    exerciseId: ex.exerciseId,
    exerciseName: ex.exerciseName || ex.name || '',
    activity,
    discipline: cardioDiscipline(activity, speedKmh(distanceKm, durationSec)),
    distanceKm,
    durationSec,
    avgHr: hrWeight > 0 ? Math.round(hrWeighted / hrWeight) : null,
    maxHr,
    elevationGainM,
    typedCalories,
    effort,
    runType: ex.runType ?? null,
    splits,
    route: ex.route ?? null,
    sets: sets.length,
  };
}

/** Every recorded cardio effort of a session, in exercise order. */
export function cardioEffortsOf(session: Pick<WorkoutSession, 'exercises'>): CardioEffort[] {
  const efforts: CardioEffort[] = [];
  for (const ex of session.exercises ?? []) {
    const effort = cardioEffortOf(ex);
    if (effort) efforts.push(effort);
  }
  return efforts;
}

/** A strength exercise that actually logged work. */
function hasStrengthWork(ex: WorkoutExercise): boolean {
  if (isCardioExercise(ex)) return false;
  return (ex.sets ?? []).some((s) => done(s) && ((s.weight ?? 0) > 0 || (s.reps ?? 0) > 0));
}

/**
 * True when the session is a cardio session: at least one recorded cardio
 * effort and no strength work. A gym session with a treadmill warm-up is a
 * strength session that happens to contain cardio.
 */
export function isCardioSession(session: Pick<WorkoutSession, 'exercises'>): boolean {
  const exercises = session.exercises ?? [];
  return cardioEffortsOf(session).length > 0 && !exercises.some(hasStrengthWork);
}

/** Total distance (km) and time (s) of every cardio effort in a session. */
export function sessionCardioTotals(session: Pick<WorkoutSession, 'exercises'>): {
  distanceKm: number;
  durationSec: number;
} {
  return cardioEffortsOf(session).reduce(
    (acc, e) => ({
      distanceKm: acc.distanceKm + e.distanceKm,
      durationSec: acc.durationSec + e.durationSec,
    }),
    { distanceKm: 0, durationSec: 0 }
  );
}

/** Calories of one effort: what the user typed, else the MET estimate. */
export function effortCalories(
  effort: CardioEffort,
  weightKg: number | null | undefined
): number | null {
  if (effort.typedCalories !== null) return Math.round(effort.typedCalories);
  return estimateCardioCalories({
    activity: effort.activity,
    durationSec: effort.durationSec,
    distanceKm: effort.distanceKm,
    elevationGainM: effort.elevationGainM,
    effort: effort.effort,
    weightKg,
  });
}

/** Calories of all cardio exercises in a set of exercises (null if none known). */
export function cardioCaloriesOf(
  exercises: readonly WorkoutExercise[],
  weightKg: number | null | undefined
): number | null {
  let total: number | null = null;
  for (const ex of exercises) {
    const effort = cardioEffortOf(ex);
    if (!effort) continue;
    const kcal = effortCalories(effort, weightKg);
    if (kcal !== null) total = (total ?? 0) + kcal;
  }
  return total;
}

// ---------------------------------------------------------------------------
// Building a cardio session from the log sheet or the live tracker
// ---------------------------------------------------------------------------

export interface CardioEntryInput {
  activity: CardioActivity;
  /** When the effort started (ISO). */
  startTime: string;
  /** Moving time, seconds. */
  durationSec: number;
  /** Wall-clock end (ISO) — defaults to start + duration (pauses make it later). */
  endTime?: string;
  distanceKm?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  inclinePct?: number | null;
  elevationGainM?: number | null;
  /** Calories from the user's watch — beats the estimate. */
  calories?: number | null;
  /** Perceived effort 1–10. */
  effort?: number | null;
  runType?: RunType | null;
  notes?: string;
  splits?: CardioSplit[];
  route?: CardioRoute;
  /** Body weight for the calorie estimate. */
  weightKg?: number | null;
}

const positive = (n: number | null | undefined): number | undefined =>
  typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : undefined;

/** Assemble a completed WorkoutSession for one cardio effort. */
export function buildCardioSession(
  input: CardioEntryInput,
  now: number = Date.now()
): WorkoutSession {
  const config = cardioActivityConfig(input.activity);
  const start = new Date(input.startTime);
  const durationSec = Math.max(0, Math.round(input.durationSec));
  const end = input.endTime
    ? new Date(input.endTime)
    : new Date(start.getTime() + durationSec * 1000);
  const endISO = end.toISOString();
  const nowISO = new Date(now).toISOString();

  const set: WorkoutSet = {
    id: crypto.randomUUID?.() || generateId('set'),
    setNumber: 1,
    reps: 0,
    weight: 0,
    rpe: positive(input.effort) ?? null,
    isWarmup: false,
    isCompleted: true,
    notes: '',
    completedAt: endISO,
    duration: durationSec,
    distanceKm: positive(input.distanceKm),
    avgHr: positive(input.avgHr),
    maxHr: positive(input.maxHr),
    inclinePct: positive(input.inclinePct),
    elevationGainM: positive(input.elevationGainM),
    calories: positive(input.calories),
    splits: input.splits?.length ? input.splits : undefined,
  };

  const exercise: WorkoutExercise = {
    id: crypto.randomUUID?.() || generateId('ex'),
    exerciseId: `cardio-${input.activity}`,
    exerciseName: config.catalogName,
    name: config.catalogName,
    targetMuscle: 'Cardio',
    muscleGroup: 'Cardio',
    sets: [set],
    notes: '',
    restSeconds: 0,
    isCompleted: true,
    order: 0,
    trackingType: 'cardio',
    cardioActivity: input.activity,
    runType: config.runTypes && input.runType ? input.runType : undefined,
    route: input.route,
  };

  return {
    // UUID: cloud workout_sessions.id is uuid (a prefixed id fails with 22P02).
    id: crypto.randomUUID?.() || generateId('session'),
    userId: 'local_user',
    workoutItemId: `cardio-${input.activity}`,
    startTime: start.toISOString(),
    endTime: endISO,
    date: toLocalDateStr(start),
    duration: durationSec,
    status: 'completed',
    templateId: null,
    notes: input.notes?.trim() ?? '',
    rating: null,
    totalVolume: 0,
    caloriesBurned: cardioCaloriesOf([exercise], input.weightKg),
    exercises: [exercise],
    createdAt: nowISO,
    updatedAt: nowISO,
  };
}

// ---------------------------------------------------------------------------
// Strength-session builders: snapshot + calories for cardio inside a workout
// ---------------------------------------------------------------------------

/**
 * The tracking fields to stamp onto a saved exercise. Built-ins seeded before
 * cardio existed carry no field, so the snapshot keeps history readable even if
 * the catalog changes later.
 */
export function cardioSnapshot(
  source: CardioLike
): Pick<WorkoutExercise, 'trackingType' | 'cardioActivity'> {
  const activity = resolveCardioActivity(source);
  return activity ? { trackingType: 'cardio', cardioActivity: activity } : {};
}

export interface WorkoutCaloriesInput {
  exercises: readonly WorkoutExercise[];
  /** Whole session, seconds. */
  durationSec: number;
  /** Completed-set volume, kg. */
  volumeKg: number;
  weightKg: number | null | undefined;
  /** The builder's own strength estimate for (volume, minutes of lifting). */
  strength: (volumeKg: number, minutes: number) => number | null;
}

/**
 * Calories of a workout that may mix lifting and cardio: the strength estimate
 * over the minutes NOT spent on cardio, plus each cardio effort's MET estimate
 * (or the user's typed value). A cardio-only workout is just its cardio.
 */
export function workoutCalories(input: WorkoutCaloriesInput): number | null {
  const efforts = input.exercises.map(cardioEffortOf).filter((e): e is CardioEffort => e !== null);
  const cardioSec = efforts.reduce((sum, e) => sum + e.durationSec, 0);
  const cardioKcal = cardioCaloriesOf(input.exercises, input.weightKg);
  const hasStrength = input.exercises.some((ex) => !isCardioExercise(ex));
  if (!hasStrength) return cardioKcal;
  const liftMinutes = Math.max(0, (input.durationSec - cardioSec) / 60);
  const strengthKcal = input.strength(input.volumeKg, liftMinutes);
  if (strengthKcal === null && cardioKcal === null) return null;
  return (strengthKcal ?? 0) + (cardioKcal ?? 0);
}

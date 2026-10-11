// ============================================================================
// SPARKOS FITNESS - Progression Service
// Algorithm for determining when to increase weight
// ============================================================================

import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { completedSetsVolume } from '../utils/workoutMath';
import { FATIGUE_BANDS, RECOVERY_BANDS } from './intelligence/scoringThresholds';

// ============================================================================
// TYPES
// ============================================================================

export type ProgressionRecommendation =
  | 'INCREASE_WEIGHT'
  | 'MAINTAIN'
  | 'DECREASE_WEIGHT'
  | 'INCREASE_REPS'
  | 'DELOAD';

export interface ProgressionReason {
  code: string;
  message: string;
  /** One short line for compact surfaces (the set screen's suggestion chip). */
  short?: string;
  priority: number;
}

export interface ExerciseProgressionData {
  exerciseId: string;
  exerciseName: string;
  recommendation: ProgressionRecommendation;
  currentWeight: number;
  suggestedWeight: number;
  /**
   * The rep target that goes with the recommendation, or null when only the load
   * changes: +1 over the bar for INCREASE_REPS, the bar itself while a MAINTAIN is
   * waiting for every set to reach it, and fewer reps when a reps-only movement
   * backs off.
   */
  suggestedReps: number | null;
  weightChange: number;
  confidence: number; // 0-100
  reasons: ProgressionReason[];
  lastSession: SessionSnapshot | null;
  history: SessionSnapshot[];
}

export interface SessionSnapshot {
  date: string;
  weight: number;
  reps: number;
  volume: number;
  rpe: number | null;
  setsCompleted: number;
  setsTarget: number;
  wasCompleted: boolean;
  /** Completed working sets that carried an RPE (the average above rests on them). */
  ratedSets?: number;
  /** Reps of each completed working set lifted at the session's top weight. */
  topWeightReps?: number[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RPE_THRESHOLD_TO_INCREASE = 6.5;
const RPE_THRESHOLD_TO_MAINTAIN = 8;
const RPE_THRESHOLD_TO_DECREASE = 9.5;

const MIN_SESSIONS_FOR_CONFIDENT_RECOMMENDATION = 2;
const CONSISTENCY_THRESHOLD = 0.85; // 85% of sets completed

// One hard session is a correction, not a deload week: back off 10% (the usual
// reset size). This used to cut to 60%, so a single RPE-10 day turned a 100 kg
// lift into a 60 kg suggestion.
const HIGH_RPE_BACKOFF = 0.9;
// A lifter who rates only the last set (often taken to failure on purpose) has
// not had a hard session. Back off only when at least this many sets say so.
const MIN_RATED_SETS_TO_BACK_OFF = 2;
// Fatigue/recovery cut-points are shared with trainingLoadService via
// scoringThresholds so the per-exercise card and the global readiness chip can
// never disagree about what counts as "deload"/"poor recovery" (PR-1/PR-2).
// Previously these were 65/40 (fatigue) and 40/65 (recovery), diverging from the
// global engine's 55 deload / 45 recovery cut-points.
const RECOVERY_SCORE_DELOAD_THRESHOLD = RECOVERY_BANDS.LOW; // 45
const RECOVERY_SCORE_MAINTAIN_THRESHOLD = RECOVERY_BANDS.MODERATE; // 65
const RECOVERY_DELOAD_PERCENT = 0.8;
const FATIGUE_SCORE_DELOAD_THRESHOLD = FATIGUE_BANDS.DELOAD; // 55
const FATIGUE_SCORE_MAINTAIN_THRESHOLD = FATIGUE_BANDS.MAINTAIN; // 35
const FATIGUE_DELOAD_PERCENT = 0.85;

// ============================================================================
// LOADING PROFILES
// How big one progression step is on each implement, and which weights can
// actually be loaded. Keys are the catalogue's equipment keys
// (constants/equipmentNames).
// ============================================================================

export interface LoadingProfile {
  /** Catalogue equipment key the profile applies to; '' for the unknown-equipment default. */
  equipment: string;
  /** One normal progression step in kg (per hand for dumbbells). 0 when reps-only. */
  step: number;
  /** The bigger step, taken only on the strongest evidence. Equals `step` where none applies. */
  bigStep: number;
  /** Suggestions snap to multiples of this (kg) so the number can be loaded. 0 when reps-only. */
  grid: number;
  /** Progress by reps, never by added load. */
  repsOnly: boolean;
}

type ProfileShape = Omit<LoadingProfile, 'equipment'>;

const LOADING_PROFILES: Record<string, ProfileShape> = {
  // 1.25 kg change plates make every 2.5 kg total loadable on a bar. Lower-body
  // barbell lifts may take 5 kg when effort was clearly low.
  barbell: { step: 2.5, bigStep: 5, grid: 2.5, repsOnly: false },
  // Per hand. Racks run in 2 kg steps, or 2.5 kg ones (see getLoadingProfile).
  dumbbell: { step: 2, bigStep: 2, grid: 2, repsOnly: false },
  // 8, 12, 16, 20, 24 ...
  kettlebell: { step: 4, bigStep: 4, grid: 4, repsOnly: false },
  // Pin stacks: a 5 kg plate, with the usual 2.5 kg add-on for in-between loads.
  machine: { step: 5, bigStep: 5, grid: 2.5, repsOnly: false },
  // Cable work is mostly isolation, where 5 kg is a 20-30% jump; the add-on is 2.5.
  cable: { step: 2.5, bigStep: 2.5, grid: 2.5, repsOnly: false },
  plate: { step: 5, bigStep: 5, grid: 2.5, repsOnly: false },
  bodyweight: { step: 0, bigStep: 0, grid: 0, repsOnly: true },
  band: { step: 0, bigStep: 0, grid: 0, repsOnly: true },
  ball: { step: 0, bigStep: 0, grid: 0, repsOnly: true },
};

// Unknown or user-authored equipment keeps the one step this engine always used.
const DEFAULT_PROFILE: ProfileShape = { step: 2.5, bigStep: 2.5, grid: 2.5, repsOnly: false };

const isOnGrid = (weight: number, grid: number): boolean =>
  Math.abs(weight / grid - Math.round(weight / grid)) < 1e-6;

/**
 * The loading profile for an implement. `currentWeight` refines dumbbells: a
 * lifter already on a 2.5 kg rack (12.5, 17.5 ...) keeps stepping in 2.5.
 */
export function getLoadingProfile(
  equipment: string | null | undefined,
  currentWeight = 0
): LoadingProfile {
  const key = (equipment ?? '').trim().toLowerCase();
  const known = LOADING_PROFILES[key];
  if (!known) return { equipment: '', ...DEFAULT_PROFILE };
  if (
    key === 'dumbbell' &&
    currentWeight > 0 &&
    isOnGrid(currentWeight, 2.5) &&
    !isOnGrid(currentWeight, 2)
  ) {
    return { equipment: key, ...known, step: 2.5, bigStep: 2.5, grid: 2.5 };
  }
  return { equipment: key, ...known };
}

const roundKg = (value: number): number => Math.round(value * 100) / 100;

/** Snap a weight to multiples of `grid`. A non-positive grid only tidies the float. */
export function snapToGrid(weight: number, grid: number, mode: 'nearest' | 'up' | 'down'): number {
  if (!(grid > 0)) return roundKg(weight);
  const units = weight / grid;
  const snapped =
    mode === 'up'
      ? Math.ceil(units - 1e-9)
      : mode === 'down'
        ? Math.floor(units + 1e-9)
        : Math.round(units);
  return roundKg(snapped * grid);
}

/** current + step, loadable, and always strictly heavier than current. */
function heavierLoad(current: number, step: number, profile: LoadingProfile): number {
  if (profile.repsOnly || step <= 0 || current <= 0) return current;
  const nearest = snapToGrid(current + step, profile.grid, 'nearest');
  return nearest > current ? nearest : snapToGrid(current + step, profile.grid, 'up');
}

/** current × factor, loadable, strictly lighter; stays at current if that would reach 0. */
function lighterLoad(current: number, factor: number, profile: LoadingProfile): number {
  if (profile.repsOnly || current <= 0) return current;
  const nearest = snapToGrid(current * factor, profile.grid, 'nearest');
  const lighter = nearest < current ? nearest : snapToGrid(current * factor, profile.grid, 'down');
  return lighter > 0 ? lighter : current;
}

// Squat and deadlift patterns take the bigger barbell step; single-leg and
// goblet variants do not, whatever their name contains.
const LOWER_BODY_BARBELL_PATTERNS = ['squat', 'deadlift', 'סקוואט', 'סקווט', 'דדליפט', 'דד ליפט'];
const NOT_A_BIG_STEP_PATTERNS = [
  'split',
  'lunge',
  'bulgarian',
  'goblet',
  'single',
  'בולגרי',
  'מכרע',
  'גובלט',
  'רגל אחת',
];

function isLowerBodyBarbellLift(name: string): boolean {
  const key = exerciseNameKey(name);
  return (
    LOWER_BODY_BARBELL_PATTERNS.some((p) => key.includes(p)) &&
    !NOT_A_BIG_STEP_PATTERNS.some((p) => key.includes(p))
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Comparison-safe exercise name. Live-workout exercise ids are minted fresh
 * every workout, so history can only be found by NAME — the identity the PR
 * service and the "last time" strip already use. Mirrors
 * prService.normalizeExerciseName; kept local so this pure engine does not pull
 * the PR service's sync graph along with it.
 */
const exerciseNameKey = (name: string | null | undefined): string =>
  (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Calculate average RPE from sets
 */
function calculateAverageRPE(sets: WorkoutSet[]): number | null {
  const completedSets = sets.filter((s) => s.isCompleted && !s.isWarmup && s.rpe != null);
  if (completedSets.length === 0) return null;
  const sum = completedSets.reduce((acc, s) => acc + (s.rpe || 0), 0);
  return sum / completedSets.length;
}

/**
 * Get the best (heaviest) weight performed in a session for this exercise
 */
function getBestWeight(exercise: WorkoutExercise): number {
  let best = 0;
  for (const set of exercise.sets) {
    if (set.isCompleted && !set.isWarmup && set.weight > best) {
      best = set.weight;
    }
  }
  return best;
}

/**
 * Get total reps performed for the exercise
 */
function getTotalReps(exercise: WorkoutExercise): number {
  return exercise.sets
    .filter((s) => s.isCompleted && !s.isWarmup)
    .reduce((acc, s) => acc + s.reps, 0);
}

/**
 * Calculate volume for an exercise
 */
function calculateExerciseVolume(exercise: WorkoutExercise): number {
  return completedSetsVolume(exercise.sets);
}

/**
 * Get snapshot from a session for a specific exercise. Matches on the exercise
 * NAME when one is given (the stable identity) and on the id otherwise.
 */
export function getExerciseSnapshot(
  session: WorkoutSession,
  exerciseId: string,
  exerciseName?: string
): SessionSnapshot | null {
  const nameKey = exerciseNameKey(exerciseName);
  const exercise = session.exercises.find(
    (e) =>
      (nameKey !== '' && exerciseNameKey(e.exerciseName ?? e.name) === nameKey) ||
      (exerciseId !== '' && e.exerciseId === exerciseId)
  );
  if (!exercise) return null;

  const completedSets = exercise.sets.filter((s) => s.isCompleted && !s.isWarmup);
  const targetSets = exercise.sets.filter((s) => !s.isWarmup).length;
  const topWeight = getBestWeight(exercise);
  const workingSets = completedSets.filter((s) => !s.skipped);

  return {
    date: session.date,
    weight: topWeight,
    reps: getTotalReps(exercise),
    volume: calculateExerciseVolume(exercise),
    rpe: calculateAverageRPE(exercise.sets),
    setsCompleted: completedSets.length,
    setsTarget: targetSets,
    wasCompleted:
      targetSets > 0
        ? (exercise.isCompleted && completedSets.length > 0) ||
          completedSets.length >= targetSets * 0.7
        : false,
    ratedSets: workingSets.filter((s) => s.rpe != null).length,
    topWeightReps: workingSets
      .filter((s) => s.reps > 0 && Math.abs(s.weight - topWeight) < 0.01)
      .map((s) => s.reps),
  };
}

/**
 * Get session history for an exercise (last N sessions). Reps-only movements
 * keep unloaded sessions; loaded ones need a weight to progress from.
 */
function getExerciseHistory(
  sessions: WorkoutSession[],
  exerciseId: string,
  exerciseName: string,
  includeUnloaded: boolean,
  limit = 10
): SessionSnapshot[] {
  // Sort descending (newest first) so the limit takes the most recent sessions
  const sorted = [...sessions]
    .filter((s) => s.status === 'completed')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const history: SessionSnapshot[] = [];

  for (const session of sorted) {
    const snapshot = getExerciseSnapshot(session, exerciseId, exerciseName);
    if (snapshot && (snapshot.weight > 0 || (includeUnloaded && snapshot.reps > 0))) {
      history.push(snapshot);
      if (history.length >= limit) break;
    }
  }

  return history.reverse(); // oldest first, newest last
}

/**
 * Calculate consistency score (how often user completed all target sets)
 */
function calculateConsistency(history: SessionSnapshot[]): number {
  if (history.length === 0) return 0;
  const completedCount = history.filter((s) => s.wasCompleted).length;
  return completedCount / history.length;
}

/**
 * Calculate RPE trend (is the workout getting harder or easier)
 */
export function calculateRPEDelta(history: SessionSnapshot[]): number | null {
  const rpes = history.map((s) => s.rpe).filter((r): r is number => r !== null);
  if (rpes.length < 2) return null;

  // Split into two non-overlapping halves (older vs recent). Using slice(-3)
  // for "recent" plus slice(0, len-3) overlapped index 0 into both halves for
  // 2-3 data points, understating the trend.
  const midpoint = Math.floor(rpes.length / 2);
  const older = rpes.slice(0, midpoint);
  const recent = rpes.slice(midpoint);

  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

  return recentAvg - olderAvg;
}

// ============================================================================
// MAIN PROGRESSION ALGORITHM
// ============================================================================

export interface ProgressionInput {
  exerciseId: string;
  exerciseName: string;
  targetReps: number;
  targetSets: number;
  sessions: WorkoutSession[];
  fatigueScore?: number | null;
  recoveryScore?: number | null;
  /** Catalogue equipment key ('barbell', 'dumbbell' ...): picks the step and the loadable grid. */
  equipment?: string | null;
  /**
   * Top of a PRESCRIBED rep range (a program's "8-10" gives 10). Every working
   * set at the top weight must reach it before the load goes up. Without one,
   * the lifter is held to their own best set at that weight instead.
   */
  prescribedReps?: number | null;
}

// Reps-only movements that must back off drop to 80% of their best set.
const REPS_ONLY_BACKOFF = 0.8;

export function calculateProgression(input: ProgressionInput): ExerciseProgressionData {
  const {
    exerciseId,
    exerciseName,
    targetReps,
    targetSets,
    sessions,
    fatigueScore,
    recoveryScore,
    equipment,
    prescribedReps,
  } = input;

  const repsOnly = getLoadingProfile(equipment).repsOnly;
  const history = getExerciseHistory(sessions, exerciseId, exerciseName, repsOnly);
  const lastSession = history[history.length - 1] ?? null;

  const reasons: ProgressionReason[] = [];
  let recommendation: ProgressionRecommendation = 'MAINTAIN';
  let confidence = 30; // Base confidence
  const currentWeight = lastSession?.weight || 0;
  const profile = getLoadingProfile(equipment, currentWeight);
  let suggestedWeight = currentWeight;
  let suggestedReps: number | null = null;

  // Not enough history - give conservative recommendation
  if (history.length < MIN_SESSIONS_FOR_CONFIDENT_RECOMMENDATION) {
    reasons.push({
      code: 'NEW_EXERCISE',
      message: 'תרגיל חדש - ממליצים להתחזק לפני שמעלים משקל',
      short: 'תרגיל חדש: קודם מתרגלים את המשקל',
      priority: 1,
    });
    return {
      exerciseId,
      exerciseName,
      recommendation: 'MAINTAIN',
      currentWeight,
      suggestedWeight,
      suggestedReps: null,
      weightChange: 0,
      confidence: 20,
      reasons,
      lastSession,
      history,
    };
  }

  // Calculate key metrics
  const consistency = calculateConsistency(history);
  const rpeDelta = calculateRPEDelta(history);
  const avgRPE = lastSession?.rpe;
  const recentRPEs = history
    .slice(-3)
    .map((s) => s.rpe)
    .filter((r): r is number => r !== null);
  const recentAvgRPE =
    recentRPEs.length > 0 ? recentRPEs.reduce((a, b) => a + b, 0) / recentRPEs.length : null;

  // Check consistency (completing sets)
  const allSetsCompletedRecently = history.slice(-3).every((s) => s.wasCompleted);

  // The rep bar: the prescription's top when there is one; otherwise the
  // lifter's own best set at the top weight, which needs at least two sets at
  // that weight to say anything.
  const repsAtTop = lastSession?.topWeightReps ?? [];
  const bestRepsAtTop = repsAtTop.length > 0 ? Math.max(...repsAtTop) : 0;
  const repBar =
    prescribedReps != null && prescribedReps > 0
      ? prescribedReps
      : repsAtTop.length >= 2
        ? bestRepsAtTop
        : null;

  // =========================================================================
  // RULE 1: Too hard - RPE high across the session, back off
  // =========================================================================
  if (
    avgRPE != null &&
    avgRPE >= RPE_THRESHOLD_TO_DECREASE &&
    (lastSession?.ratedSets ?? 0) >= MIN_RATED_SETS_TO_BACK_OFF
  ) {
    recommendation = 'DECREASE_WEIGHT';
    suggestedWeight = lighterLoad(currentWeight, HIGH_RPE_BACKOFF, profile);
    confidence = 85;
    reasons.push({
      code: 'HIGH_RPE',
      message: `RPE גבוה (${avgRPE.toFixed(1)}) - מומלץ להוריד משקל ולהתחזק`,
      short: `RPE ${avgRPE.toFixed(1)} בפעם הקודמת: מורידים קצת`,
      priority: 1,
    });
  }

  // =========================================================================
  // RULE 2: Getting harder - RPE increasing, consider maintaining
  // =========================================================================
  else if (
    rpeDelta !== null &&
    rpeDelta > 1 &&
    avgRPE != null &&
    avgRPE >= RPE_THRESHOLD_TO_MAINTAIN
  ) {
    recommendation = 'MAINTAIN';
    suggestedWeight = currentWeight;
    confidence = 75;
    reasons.push({
      code: 'RPE_INCREASING',
      message: 'RPE עולה - לשמור על המשקל ולהתמקד בטכניקה',
      short: 'המאמץ עולה מאימון לאימון: נשארים במשקל',
      priority: 1,
    });
  }

  // =========================================================================
  // RULE 3: Easy - RPE low, CONSISTENT, increase weight
  // =========================================================================
  else if (
    recentAvgRPE !== null &&
    recentAvgRPE <= RPE_THRESHOLD_TO_INCREASE &&
    consistency >= CONSISTENCY_THRESHOLD &&
    allSetsCompletedRecently
  ) {
    recommendation = 'INCREASE_WEIGHT';

    // The bigger step needs the strongest evidence: clearly low effort on a
    // squat or deadlift pattern. Everything else takes the implement's step.
    const increment =
      profile.bigStep > profile.step && consistency >= 0.9 && isLowerBodyBarbellLift(exerciseName)
        ? profile.bigStep
        : profile.step;
    suggestedWeight = heavierLoad(currentWeight, increment, profile);
    confidence = 80;

    const added = roundKg(suggestedWeight - currentWeight);
    reasons.push({
      code: 'CONSISTENT_EASY',
      message: profile.repsOnly
        ? `השלמת ${Math.round(consistency * 100)}% מהסטים בקלות - מומלץ להוסיף חזרה`
        : `השלמת ${Math.round(consistency * 100)}% מהסטים בקלות - מומלץ להעלות ${added} ק"ג`,
      short: 'הסטים האחרונים היו קלים: אפשר לעלות',
      priority: 1,
    });
  }

  // =========================================================================
  // RULE 4: Volume increase - more reps, suggest increase
  // =========================================================================
  else if (lastSession && history.length >= 2 && avgRPE != null) {
    const previousSession = history[history.length - 2];
    if (previousSession) {
      const repsIncrease = lastSession.reps - previousSession.reps;
      const sameWeight = Math.abs(lastSession.weight - previousSession.weight) < 1;

      if (sameWeight && repsIncrease >= targetReps && avgRPE <= RPE_THRESHOLD_TO_MAINTAIN) {
        if (recommendation === 'MAINTAIN') {
          recommendation = 'INCREASE_WEIGHT';
          suggestedWeight = heavierLoad(currentWeight, profile.step, profile);
          confidence = 70;
          reasons.push({
            code: 'REPS_INCREASED',
            message: `הגדלת חזרות ל-${lastSession.reps} - מוכן להעלות משקל`,
            short: 'הוספת חזרות באותו משקל: אפשר לעלות',
            priority: 2,
          });
        }
      }
    }
  }

  // =========================================================================
  // RULE 5: Rep target (double progression) - decides whenever effort did not.
  // Most lifters never rate a set, and a saved session keeps only the sets that
  // were done, so "sets completed" reads 100% in real data. What is left to
  // judge by is whether every set at the top weight reached the rep bar.
  // =========================================================================
  if (reasons.length === 0 && repBar !== null && repsAtTop.length > 0) {
    if (Math.min(...repsAtTop) >= repBar && avgRPE != null && avgRPE >= RPE_THRESHOLD_TO_DECREASE) {
      // The reps were there, but the set(s) the lifter rated were at the limit
      // (typically a last set taken to failure). Adding load now fails that set.
      recommendation = 'MAINTAIN';
      suggestedWeight = currentWeight;
      confidence = 70;
      reasons.push({
        code: 'REP_TARGET_AT_LIMIT',
        message: 'החזרות הושלמו, אבל במאמץ מרבי - לשמור על המשקל',
        short: 'החזרות היו שם, אבל במאמץ מרבי: נשארים במשקל',
        priority: 1,
      });
    } else if (Math.min(...repsAtTop) >= repBar) {
      recommendation = 'INCREASE_WEIGHT';
      suggestedWeight = heavierLoad(currentWeight, profile.step, profile);
      confidence = 75;
      reasons.push({
        code: 'REP_TARGET_MET',
        message: profile.repsOnly
          ? `${repBar} חזרות בכל הסטים - הזמן להוסיף חזרה`
          : `${repBar} חזרות בכל הסטים - הזמן להעלות משקל`,
        short: profile.repsOnly
          ? `${repBar} חזרות בכל הסטים: עכשיו אחת יותר`
          : `${repBar} חזרות בכל הסטים: הזמן לעלות במשקל`,
        priority: 1,
      });
    } else {
      recommendation = 'MAINTAIN';
      suggestedWeight = currentWeight;
      suggestedReps = repBar;
      confidence = 70;
      reasons.push({
        code: 'REP_TARGET_SHORT',
        message: `להשלים ${repBar} חזרות בכל הסטים לפני העלאה`,
        short: profile.repsOnly
          ? `קודם ${repBar} חזרות בכל הסטים, אחר כך מוסיפים`
          : `קודם ${repBar} חזרות בכל הסטים, אחר כך עולים`,
        priority: 1,
      });
    }
  }

  // =========================================================================
  // RULE 6: Steady rated effort over time. Only when nothing above decided -
  // it used to override RULE 2's "hold, effort is rising" - and only with RPE:
  // without it the consistency figure is always 100% and proves nothing.
  // =========================================================================
  if (
    reasons.length === 0 &&
    consistency >= 0.9 &&
    history.length >= 4 &&
    lastSession?.rpe != null
  ) {
    recommendation = 'INCREASE_WEIGHT';
    suggestedWeight = heavierLoad(currentWeight, profile.step, profile);
    confidence = Math.min(85, confidence + 15);
    reasons.push({
      code: 'CONSISTENT_LONG_TERM',
      message: `עקביות גבוהה (${Math.round(consistency * 100)}%) ב-${history.length} אימונים - הגיע הזמן להעלות`,
      short: `ביצוע יציב ב-${history.length} אימונים: אפשר לעלות`,
      priority: 3,
    });
  }

  // =========================================================================
  // RULE 7: Very fresh (low RPE, low volume) - might need more volume first
  // =========================================================================
  const rpeForRule6 = avgRPE;
  // Compare TOTAL session volume against EXPECTED total volume (sets*reps*weight).
  // Previously the threshold was a single set's volume (targetReps*weight*0.5),
  // so for any multi-set session the branch was unreachable (PR-3).
  const expectedSessionVolume = targetSets * targetReps * currentWeight;
  if (
    lastSession &&
    lastSession.volume < expectedSessionVolume * 0.5 &&
    rpeForRule6 != null &&
    rpeForRule6 < 5
  ) {
    reasons.push({
      code: 'LOW_VOLUME',
      message: 'נפח נמוך - מומלץ להוסיף סטים לפני שמעלים משקל',
      short: 'המאמץ היה קל: קודם עוד חזרות',
      priority: 2,
    });
    if (recommendation === 'INCREASE_WEIGHT') {
      recommendation = 'INCREASE_REPS';
      // More reps at the same load: the increase computed above no longer applies.
      suggestedWeight = currentWeight;
    }
  }

  // =========================================================================
  // Default: maintain
  // =========================================================================
  if (reasons.length === 0) {
    reasons.push({
      code: 'GENERAL_MAINTAIN',
      message: 'המשך להתאמן במשקל הנוכחי ובנה ביטחון',
      short: 'ממשיכים במשקל של הפעם הקודמת',
      priority: 1,
    });
  }

  if (recoveryScore != null && Number.isFinite(recoveryScore)) {
    if (recoveryScore < RECOVERY_SCORE_DELOAD_THRESHOLD) {
      recommendation = 'DELOAD';
      suggestedWeight = lighterLoad(currentWeight, RECOVERY_DELOAD_PERCENT, profile);
      suggestedReps = null;
      confidence = Math.max(confidence, 90);
      reasons.push({
        code: 'LOW_RECOVERY',
        message: `התאוששות נמוכה (${Math.round(recoveryScore)}/100) - עדיף אימון קל או דלואד היום`,
        short: 'התאוששות נמוכה היום: אימון קל',
        priority: 100,
      });
    } else if (
      recoveryScore < RECOVERY_SCORE_MAINTAIN_THRESHOLD &&
      recommendation === 'INCREASE_WEIGHT'
    ) {
      recommendation = 'MAINTAIN';
      suggestedWeight = currentWeight;
      confidence = Math.min(confidence, 65);
      reasons.push({
        code: 'FAIR_RECOVERY',
        message: `התאוששות חלקית (${Math.round(recoveryScore)}/100) - שמור משקל לפני העלאת עומס`,
        short: 'התאוששות חלקית היום: נשארים במשקל',
        priority: 90,
      });
    }
  }

  if (fatigueScore != null && Number.isFinite(fatigueScore)) {
    if (fatigueScore >= FATIGUE_SCORE_DELOAD_THRESHOLD) {
      recommendation = 'DELOAD';
      suggestedWeight = lighterLoad(currentWeight, FATIGUE_DELOAD_PERCENT, profile);
      suggestedReps = null;
      confidence = Math.max(confidence, 88);
      reasons.push({
        code: 'HIGH_TRAINING_LOAD',
        message: `עומס אימון גבוה (${Math.round(fatigueScore)}/100) - מומלץ דלואד כדי להתאושש`,
        short: 'עומס שבועי גבוה: מורידים קצת',
        priority: 110,
      });
    } else if (
      fatigueScore >= FATIGUE_SCORE_MAINTAIN_THRESHOLD &&
      recommendation === 'INCREASE_WEIGHT'
    ) {
      recommendation = 'MAINTAIN';
      suggestedWeight = currentWeight;
      confidence = Math.min(confidence, 68);
      reasons.push({
        code: 'ELEVATED_TRAINING_LOAD',
        message: `עומס אימון בינוני (${Math.round(fatigueScore)}/100) - שמור משקל לפני העלאה`,
        short: 'עומס שבועי מוגבר: נשארים במשקל',
        priority: 95,
      });
    }
  }

  // Reps are the other half of the target. Reps-only movements progress by
  // reps alone, so their verdict is translated; loaded ones carry reps only for
  // INCREASE_REPS and for a hold that is waiting on the rep bar.
  const repReference = repBar ?? bestRepsAtTop;
  if (profile.repsOnly) {
    suggestedWeight = currentWeight;
    if (recommendation === 'INCREASE_WEIGHT' || recommendation === 'INCREASE_REPS') {
      recommendation = 'INCREASE_REPS';
      suggestedReps = repReference > 0 ? repReference + 1 : null;
    } else if (recommendation === 'DECREASE_WEIGHT' || recommendation === 'DELOAD') {
      suggestedReps =
        bestRepsAtTop > 0 ? Math.max(1, Math.round(bestRepsAtTop * REPS_ONLY_BACKOFF)) : null;
    } else {
      suggestedReps = repReference > 0 ? repReference : null;
    }
  } else if (recommendation === 'INCREASE_REPS') {
    suggestedReps = repReference > 0 ? repReference + 1 : null;
  } else if (recommendation !== 'MAINTAIN') {
    suggestedReps = null;
  }

  return {
    exerciseId,
    exerciseName,
    recommendation,
    currentWeight,
    suggestedWeight,
    suggestedReps,
    weightChange: roundKg(suggestedWeight - currentWeight),
    confidence,
    reasons: reasons.sort((a, b) => b.priority - a.priority),
    lastSession,
    history,
  };
}

// ============================================================================
// AI INTEGRATION HELPERS
// ============================================================================

export interface AIProgressionContext {
  exerciseName: string;
  currentWeight: number;
  targetReps: number;
  targetSets: number;
  history: SessionSnapshot[];
  recommendation: ProgressionRecommendation;
  reasons: ProgressionReason[];
  averageRPE: number | null;
  recentRPEs: number[];
  consistency: number;
  volumeTrend: 'up' | 'down' | 'stable';
}

export function buildAIProgressionContext(data: ExerciseProgressionData): AIProgressionContext {
  const volumes = data.history.map((s) => s.volume);
  const firstVol = volumes[0] ?? 0;
  const lastVol = volumes[volumes.length - 1] ?? 0;
  const volumeTrend =
    volumes.length >= 3
      ? lastVol > firstVol
        ? 'up'
        : lastVol < firstVol
          ? 'down'
          : 'stable'
      : 'stable';

  return {
    exerciseName: data.exerciseName,
    currentWeight: data.currentWeight,
    targetReps:
      data.lastSession && data.lastSession.setsCompleted > 0
        ? Math.round(data.lastSession.reps / data.lastSession.setsCompleted)
        : 8,
    targetSets: data.lastSession?.setsTarget ?? 4,
    history: data.history,
    recommendation: data.recommendation,
    reasons: data.reasons,
    averageRPE: data.lastSession?.rpe ?? null,
    recentRPEs: data.history
      .slice(-3)
      .map((s) => s.rpe)
      .filter((r): r is number => r !== null),
    consistency:
      data.history.length > 0
        ? data.history.filter((s) => s.wasCompleted).length / data.history.length
        : 0,
    volumeTrend,
  };
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

export function calculateAllExercisesProgression(
  sessions: WorkoutSession[],
  exercises: { id: string; name: string; targetReps?: number; targetSets?: number }[],
  fatigueScore?: number | null,
  recoveryScore?: number | null
): ExerciseProgressionData[] {
  return exercises.map((ex) =>
    calculateProgression({
      exerciseId: ex.id,
      exerciseName: ex.name,
      targetReps: ex.targetReps || 8,
      targetSets: ex.targetSets || 4,
      sessions,
      fatigueScore,
      recoveryScore,
    })
  );
}

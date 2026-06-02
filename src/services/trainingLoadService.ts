import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { completedSetsVolume } from '../utils/workoutMath';
import { type RecoveryLog, calculateRecoveryScore } from './bodyStatsService';
import {
  RECOVERY_BANDS,
  VOLUME_SPIKE_PERCENT,
  readinessBandFromFatigue,
  recommendationFromFatigue,
} from './intelligence/scoringThresholds';

/**
 * RPE factor used to convert raw volume into a fatigue-weighted "load". When a
 * session/week has no logged RPE we assume a moderate effort (RPE 7 -> 0.7).
 * The SAME default is applied to both the acute and the chronic window so the
 * acute:chronic ratio compares like-with-like (see TL-1 fix).
 */
const DEFAULT_RPE_FACTOR = 0.7;

export type TrainingLoadRecommendation = 'push' | 'maintain' | 'deload' | 'rest';
export type TrainingLoadConstraint =
  | 'recovery'
  | 'load_spike'
  | 'high_rpe'
  | 'low_volume'
  | 'balanced';
export type MuscleRecoveryStatus = 'fresh' | 'trained' | 'fatigued' | 'neglected';

export interface MuscleRecoveryState {
  muscle: string;
  daysSinceLastTrained: number | null;
  recoveryScore: number;
  status: MuscleRecoveryStatus;
  weeklyVolume: number;
  previousWeeklyVolume: number;
  volumeChangePercent: number;
  isTight: boolean;
}

export interface TrainingLoadResult {
  acuteLoad: number;
  chronicLoad: number;
  acuteChronicRatio: number;
  averageRPE: number | null;
  fatigueScore: number;
  muscles: MuscleRecoveryState[];
  previousWeeklyVolume: number;
  primaryConstraint: TrainingLoadConstraint;
  recoveryScore: number | null;
  readinessLabel: 'low' | 'moderate' | 'good' | 'high';
  readinessScore: number;
  recommendation: TrainingLoadRecommendation;
  weeklySessionCount: number;
  weeklyVolume: number;
  volumeChangePercent: number;
  /** True when at least one acute-week working set carried an RPE. When false,
   * acuteLoad/fatigue used the DEFAULT_RPE_FACTOR assumption — consumers should
   * treat the recommendation as lower-confidence (see dataSufficiency). */
  hasRpeData: boolean;
  /** True when a recovery log fed the recovery penalty (else a default was used). */
  hasRecoveryData: boolean;
  /** True when there is enough history (>=1 prior week) for a meaningful ACWR. */
  hasChronicBaseline: boolean;
}

export interface TrainingLoadOptions {
  now?: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const round = (value: number, decimals = 0): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const getDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const daysBetween = (latest: Date, earlierDateKey: string): number => {
  const latestMidnight = new Date(getDateKey(latest));
  const earlierMidnight = new Date(earlierDateKey);
  return Math.max(0, Math.floor((latestMidnight.getTime() - earlierMidnight.getTime()) / DAY_MS));
};

const getMuscle = (exercise: WorkoutExercise): string =>
  exercise.muscleGroup || exercise.targetMuscle || 'Unknown';

const isCompletedWorkingSet = (set: WorkoutSet): boolean => set.isCompleted && !set.isWarmup;

function getExerciseVolume(exercise: WorkoutExercise): number {
  return completedSetsVolume(exercise.sets.filter(isCompletedWorkingSet));
}

function getSessionVolume(session: WorkoutSession): number {
  // Prefer computing from working sets for consistent warmup exclusion.
  // Fall back to the persisted session.totalVolume when no set data is
  // populated (summary/legacy sessions) so volume isn't under-counted to 0.
  const hasSetData = session.exercises.some((exercise) => exercise.sets.length > 0);
  if (!hasSetData) {
    const fallback = session.totalVolume ?? 0;
    return Number.isFinite(fallback) ? fallback : 0;
  }
  return session.exercises.reduce((sum, exercise) => sum + getExerciseVolume(exercise), 0);
}

function getSessionAverageRPE(session: WorkoutSession): number | null {
  const rpes = session.exercises
    .flatMap((exercise) => exercise.sets)
    .filter(isCompletedWorkingSet)
    .map((set) => set.rpe)
    .filter((rpe): rpe is number => rpe != null);

  if (rpes.length === 0) {
    return null;
  }

  return rpes.reduce((sum, rpe) => sum + rpe, 0) / rpes.length;
}

function latestRecoveryScore(recoveryLogs: RecoveryLog[]): number | null {
  const latest = [...recoveryLogs].sort((a, b) => b.date.localeCompare(a.date))[0];
  return latest ? calculateRecoveryScore(latest).overall : null;
}

/**
 * RPE-weighted load of a single session: volume * (avgRPE/10), falling back to
 * DEFAULT_RPE_FACTOR when the session has no logged RPE. Used for BOTH the acute
 * and chronic windows so the acute:chronic ratio is unit-consistent (TL-1).
 */
function getSessionLoad(session: WorkoutSession): number {
  const avgRPE = getSessionAverageRPE(session);
  const factor = avgRPE !== null ? avgRPE / 10 : DEFAULT_RPE_FACTOR;
  return getSessionVolume(session) * factor;
}

/**
 * Per-muscle readiness (0-100) from days since last trained. Rises from a
 * freshly-trained low, peaks in the recovery window (~day 3), then declines as
 * neglect/detraining sets in, so a neglected muscle scores LOWER than a freshly
 * recovered one (the previous flat-100 plateau made them indistinguishable).
 *   day0 ~50 · day1 ~67 · day2 ~83 · day3 100 · day7 ~82 · day14 ~50 · day21+ ~floor 35
 */
function muscleReadinessFromDays(days: number): number {
  if (days <= 0) return 50;
  if (days <= 3) return 50 + days * (50 / 3); // ramp up to the 100 peak at day 3
  if (days <= 14) return Math.max(50, 100 - (days - 3) * 4.5); // decline through the week
  return Math.max(35, 50 - (days - 14) * 1.5); // long-neglect floor
}

function getPrimaryConstraint(params: {
  averageRPE: number | null;
  recoveryScore: number | null;
  weeklyVolume: number;
  volumeChangePercent: number;
}): TrainingLoadConstraint {
  const { averageRPE, recoveryScore, weeklyVolume, volumeChangePercent } = params;

  if (recoveryScore !== null && recoveryScore < RECOVERY_BANDS.LOW) return 'recovery';
  if (volumeChangePercent > VOLUME_SPIKE_PERCENT) return 'load_spike';
  if (averageRPE !== null && averageRPE >= 8.5) return 'high_rpe';
  if (weeklyVolume === 0) return 'low_volume';
  return 'balanced';
}

function calculateMuscleRecovery(params: {
  now: Date;
  previousSessions: WorkoutSession[];
  tightAreas: string[];
  weeklySessions: WorkoutSession[];
}): MuscleRecoveryState[] {
  const { now, previousSessions, tightAreas, weeklySessions } = params;
  const weeklyVolumeByMuscle = new Map<string, number>();
  const previousVolumeByMuscle = new Map<string, number>();
  const lastTrainedByMuscle = new Map<string, string>();

  const addMuscleVolume = (map: Map<string, number>, exercise: WorkoutExercise) => {
    const muscle = getMuscle(exercise);
    map.set(muscle, (map.get(muscle) ?? 0) + getExerciseVolume(exercise));
  };

  for (const session of weeklySessions) {
    for (const exercise of session.exercises) {
      addMuscleVolume(weeklyVolumeByMuscle, exercise);
      const muscle = getMuscle(exercise);
      const previousDate = lastTrainedByMuscle.get(muscle);
      if (!previousDate || session.date > previousDate) {
        lastTrainedByMuscle.set(muscle, session.date);
      }
    }
  }

  for (const session of previousSessions) {
    for (const exercise of session.exercises) {
      addMuscleVolume(previousVolumeByMuscle, exercise);
      const muscle = getMuscle(exercise);
      const previousDate = lastTrainedByMuscle.get(muscle);
      if (!previousDate || session.date > previousDate) {
        lastTrainedByMuscle.set(muscle, session.date);
      }
    }
  }

  const muscles = new Set([
    ...weeklyVolumeByMuscle.keys(),
    ...previousVolumeByMuscle.keys(),
    ...tightAreas,
  ]);

  return Array.from(muscles)
    .map((muscle) => {
      const weeklyVolume = weeklyVolumeByMuscle.get(muscle) ?? 0;
      const previousWeeklyVolume = previousVolumeByMuscle.get(muscle) ?? 0;
      const volumeChangePercent =
        previousWeeklyVolume > 0
          ? Math.round(((weeklyVolume - previousWeeklyVolume) / previousWeeklyVolume) * 100)
          : weeklyVolume > 0
            ? 100
            : 0;
      const lastTrained = lastTrainedByMuscle.get(muscle);
      const daysSinceLastTrained = lastTrained ? daysBetween(now, lastTrained) : null;
      const isTight = tightAreas.includes(muscle);

      // Physiological readiness curve: a freshly-trained muscle is fatigued (low),
      // readiness climbs to a peak around the recovery window, then DECLINES as the
      // muscle is increasingly neglected/detrained. This restores monotonic meaning
      // to the scalar — previously the term only subtracted for days<3 and plateaued
      // at a flat 100, so a 2-week-neglected muscle scored the SAME 100 as a perfectly
      // recovered one (TL-3) and days 3-6 were indistinguishable (TL-8).
      let recoveryScore =
        daysSinceLastTrained !== null ? muscleReadinessFromDays(daysSinceLastTrained) : 100;
      if (volumeChangePercent > VOLUME_SPIKE_PERCENT) {
        recoveryScore -= Math.min(
          30,
          Math.round((volumeChangePercent - VOLUME_SPIKE_PERCENT) * 0.3)
        );
      }
      if (isTight) {
        recoveryScore -= 45;
      }
      recoveryScore = clamp(Math.round(recoveryScore), 0, 100);

      let status: MuscleRecoveryStatus = 'fresh';
      if (isTight || recoveryScore < 55) {
        status = 'fatigued';
      } else if (daysSinceLastTrained !== null && daysSinceLastTrained >= 7) {
        status = 'neglected';
      } else if (daysSinceLastTrained !== null && daysSinceLastTrained <= 2) {
        status = 'trained';
      }

      return {
        muscle,
        daysSinceLastTrained,
        recoveryScore,
        status,
        weeklyVolume,
        previousWeeklyVolume,
        volumeChangePercent,
        isTight,
      };
    })
    .sort((a, b) => a.recoveryScore - b.recoveryScore || a.muscle.localeCompare(b.muscle));
}

export function calculateTrainingLoad(
  sessions: WorkoutSession[],
  recoveryLogs: RecoveryLog[] = [],
  options: TrainingLoadOptions = {}
): TrainingLoadResult {
  const now = options.now ?? new Date();
  const todayKey = getDateKey(now);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);
  const previousWeekStart = new Date(now);
  previousWeekStart.setDate(previousWeekStart.getDate() - 14);
  const chronicStart = new Date(now);
  chronicStart.setDate(chronicStart.getDate() - 28);

  const completedSessions = sessions.filter((session) => session.status === 'completed');
  const weeklySessions = completedSessions.filter(
    (session) => session.date >= getDateKey(weekStart) && session.date <= todayKey
  );
  const previousSessions = completedSessions.filter(
    (session) =>
      session.date >= getDateKey(previousWeekStart) && session.date < getDateKey(weekStart)
  );
  // Chronic baseline = the 3 weeks BEFORE the acute week ([-28d, -7d)). Excluding
  // the acute week makes acute-vs-chronic a genuine comparison against an
  // independent baseline; previously the 28-day window CONTAINED the acute week,
  // so a spike inflated both sides and the ratio was biased toward 1 (TL-2).
  const baselineSessions = completedSessions.filter(
    (session) => session.date >= getDateKey(chronicStart) && session.date < getDateKey(weekStart)
  );

  const weeklyVolume = weeklySessions.reduce((sum, session) => sum + getSessionVolume(session), 0);
  const previousWeeklyVolume = previousSessions.reduce(
    (sum, session) => sum + getSessionVolume(session),
    0
  );
  const volumeChangePercent =
    previousWeeklyVolume > 0
      ? Math.round(((weeklyVolume - previousWeeklyVolume) / previousWeeklyVolume) * 100)
      : weeklyVolume > 0
        ? 100
        : 0;

  const weeklyRPEs = weeklySessions
    .map(getSessionAverageRPE)
    .filter((rpe): rpe is number => rpe !== null);
  const averageRPE =
    weeklyRPEs.length > 0
      ? weeklyRPEs.reduce((sum, rpe) => sum + rpe, 0) / weeklyRPEs.length
      : null;

  // Both sides are RPE-weighted load (volume * RPE/10, same DEFAULT_RPE_FACTOR
  // fallback), so the ratio is unit-consistent (TL-1). Chronic is the mean
  // weekly load over the 3-week baseline.
  const acuteLoad = weeklySessions.reduce((sum, session) => sum + getSessionLoad(session), 0);
  const baselineLoad = baselineSessions.reduce((sum, session) => sum + getSessionLoad(session), 0);
  // Divide by the number of prior weeks that ACTUALLY have data (1-3), not a fixed
  // 3. A cold start with only one prior week would otherwise be divided by 3,
  // understating the baseline and inflating the ratio into a false load spike.
  const baselineWeeks = new Set(
    baselineSessions.map((s) => Math.floor((daysBetween(now, s.date) - 7) / 7))
  ).size;
  const chronicLoad = baselineLoad / Math.max(1, baselineWeeks);
  const acuteChronicRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : acuteLoad > 0 ? 1.0 : 0;

  const recoveryScore = latestRecoveryScore(recoveryLogs);
  const recoveryPenalty = recoveryScore !== null ? (100 - recoveryScore) * 0.45 : 8;
  const loadSpikePenalty = Math.max(0, acuteChronicRatio - 1) * 35;
  const rpePenalty = averageRPE !== null && averageRPE > 8 ? (averageRPE - 8) * 12 : 0;
  const frequencyPenalty = weeklySessions.length >= 6 ? 10 : 0;
  const noVolumePenalty = weeklyVolume === 0 ? 25 : 0;
  const fatigueScore = clamp(
    Math.round(
      recoveryPenalty + loadSpikePenalty + rpePenalty + frequencyPenalty + noVolumePenalty
    ),
    0,
    100
  );
  const readinessScore = clamp(100 - fatigueScore, 0, 100);
  const primaryConstraint = getPrimaryConstraint({
    averageRPE,
    recoveryScore,
    weeklyVolume,
    volumeChangePercent,
  });
  const latestRecovery = [...recoveryLogs].sort((a, b) => b.date.localeCompare(a.date))[0];

  return {
    acuteLoad: Math.round(acuteLoad),
    chronicLoad: Math.round(chronicLoad),
    acuteChronicRatio: round(acuteChronicRatio, 2),
    averageRPE: averageRPE !== null ? round(averageRPE, 1) : null,
    fatigueScore,
    muscles: calculateMuscleRecovery({
      now,
      previousSessions,
      tightAreas: latestRecovery?.tightAreas ?? [],
      weeklySessions,
    }),
    previousWeeklyVolume,
    primaryConstraint,
    recoveryScore,
    readinessLabel: readinessBandFromFatigue(fatigueScore),
    readinessScore,
    recommendation: recommendationFromFatigue(fatigueScore),
    weeklySessionCount: weeklySessions.length,
    weeklyVolume,
    volumeChangePercent,
    hasRpeData: weeklyRPEs.length > 0,
    hasRecoveryData: recoveryScore !== null,
    hasChronicBaseline: baselineSessions.length > 0,
  };
}

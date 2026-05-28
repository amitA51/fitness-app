import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { setVolume } from '../utils/workoutMath';
import { type RecoveryLog, calculateRecoveryScore } from './bodyStatsService';

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

const getDateKey = (date: Date): string => date.toISOString().split('T')[0] ?? '';

const daysBetween = (latest: Date, earlierDateKey: string): number => {
  const latestMidnight = new Date(getDateKey(latest));
  const earlierMidnight = new Date(earlierDateKey);
  return Math.max(0, Math.floor((latestMidnight.getTime() - earlierMidnight.getTime()) / DAY_MS));
};

const getMuscle = (exercise: WorkoutExercise): string =>
  exercise.muscleGroup || exercise.targetMuscle || 'Unknown';

const isCompletedWorkingSet = (set: WorkoutSet): boolean => set.isCompleted && !set.isWarmup;

function getExerciseVolume(exercise: WorkoutExercise): number {
  return exercise.sets.filter(isCompletedWorkingSet).reduce((sum, set) => sum + setVolume(set), 0);
}

function getSessionVolume(session: WorkoutSession): number {
  if (session.totalVolume > 0) {
    return session.totalVolume;
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

function getReadinessLabel(score: number): TrainingLoadResult['readinessLabel'] {
  if (score < 45) return 'low';
  if (score < 65) return 'moderate';
  if (score < 82) return 'good';
  return 'high';
}

function getRecommendation(fatigueScore: number): TrainingLoadRecommendation {
  if (fatigueScore >= 75) return 'rest';
  if (fatigueScore >= 55) return 'deload';
  if (fatigueScore >= 35) return 'maintain';
  return 'push';
}

function getPrimaryConstraint(params: {
  averageRPE: number | null;
  recoveryScore: number | null;
  weeklyVolume: number;
  volumeChangePercent: number;
}): TrainingLoadConstraint {
  const { averageRPE, recoveryScore, weeklyVolume, volumeChangePercent } = params;

  if (recoveryScore !== null && recoveryScore < 45) return 'recovery';
  if (volumeChangePercent > 25) return 'load_spike';
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

      let recoveryScore = 100;
      if (daysSinceLastTrained !== null) {
        recoveryScore -= Math.max(0, 35 - daysSinceLastTrained * 12);
      }
      if (volumeChangePercent > 25) {
        recoveryScore -= Math.min(30, Math.round((volumeChangePercent - 25) * 0.3));
      }
      if (isTight) {
        recoveryScore -= 45;
      }
      recoveryScore = clamp(recoveryScore, 0, 100);

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
  const chronicSessions = completedSessions.filter(
    (session) => session.date >= getDateKey(chronicStart) && session.date <= todayKey
  );

  const weeklyVolume = weeklySessions.reduce((sum, session) => sum + getSessionVolume(session), 0);
  const previousWeeklyVolume = previousSessions.reduce(
    (sum, session) => sum + getSessionVolume(session),
    0
  );
  const chronicVolume = chronicSessions.reduce(
    (sum, session) => sum + getSessionVolume(session),
    0
  );
  const chronicLoad = chronicVolume / 4;
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
  const rpeFactor = averageRPE !== null ? averageRPE / 10 : 0.7;
  const acuteLoad = weeklyVolume * rpeFactor;
  const acuteChronicRatio = chronicLoad > 0 ? acuteLoad / chronicLoad : acuteLoad > 0 ? 1.5 : 0;

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
    readinessLabel: getReadinessLabel(readinessScore),
    readinessScore,
    recommendation: getRecommendation(fatigueScore),
    weeklySessionCount: weeklySessions.length,
    weeklyVolume,
    volumeChangePercent,
  };
}

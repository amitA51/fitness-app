// ============================================================================
// SPARKOS FITNESS - Progression Service
// Algorithm for determining when to increase weight
// ============================================================================

import type { WorkoutExercise, WorkoutSession, WorkoutSet } from '../types';
import { completedSetsVolume } from '../utils/workoutMath';

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
  priority: number;
}

export interface ExerciseProgressionData {
  exerciseId: string;
  exerciseName: string;
  recommendation: ProgressionRecommendation;
  currentWeight: number;
  suggestedWeight: number;
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
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RPE_THRESHOLD_TO_INCREASE = 6.5;
const RPE_THRESHOLD_TO_MAINTAIN = 8;
const RPE_THRESHOLD_TO_DECREASE = 9.5;

const MIN_SESSIONS_FOR_CONFIDENT_RECOMMENDATION = 2;
const CONSISTENCY_THRESHOLD = 0.85; // 85% of sets completed

const WEIGHT_INCREMENT_SMALL = 2.5; // kg
const WEIGHT_INCREMENT_MEDIUM = 5; // kg

const DELOAD_PERCENT = 0.6; // 60% of last weight for deload
const RECOVERY_SCORE_DELOAD_THRESHOLD = 40;
const RECOVERY_SCORE_MAINTAIN_THRESHOLD = 65;
const RECOVERY_DELOAD_PERCENT = 0.8;
const FATIGUE_SCORE_DELOAD_THRESHOLD = 65;
const FATIGUE_SCORE_MAINTAIN_THRESHOLD = 40;
const FATIGUE_DELOAD_PERCENT = 0.85;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
 * Get snapshot from a session for a specific exercise
 */
export function getExerciseSnapshot(
  session: WorkoutSession,
  exerciseId: string
): SessionSnapshot | null {
  const exercise = session.exercises.find((e) => e.exerciseId === exerciseId);
  if (!exercise) return null;

  const completedSets = exercise.sets.filter((s) => s.isCompleted && !s.isWarmup);
  const targetSets = exercise.sets.filter((s) => !s.isWarmup).length;

  return {
    date: session.date,
    weight: getBestWeight(exercise),
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
  };
}

/**
 * Get session history for an exercise (last N sessions)
 */
function getExerciseHistory(
  sessions: WorkoutSession[],
  exerciseId: string,
  limit = 10
): SessionSnapshot[] {
  // Sort descending (newest first) so the limit takes the most recent sessions
  const sorted = [...sessions]
    .filter((s) => s.status === 'completed')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const history: SessionSnapshot[] = [];

  for (const session of sorted) {
    const snapshot = getExerciseSnapshot(session, exerciseId);
    if (snapshot && snapshot.weight > 0) {
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
}

export function calculateProgression(input: ProgressionInput): ExerciseProgressionData {
  const { exerciseId, exerciseName, targetReps, sessions, fatigueScore, recoveryScore } = input;

  const history = getExerciseHistory(sessions, exerciseId);
  const lastSession = history[history.length - 1] ?? null;

  const reasons: ProgressionReason[] = [];
  let recommendation: ProgressionRecommendation = 'MAINTAIN';
  let confidence = 30; // Base confidence
  const currentWeight = lastSession?.weight || 0;
  let suggestedWeight = currentWeight;

  // Not enough history - give conservative recommendation
  if (history.length < MIN_SESSIONS_FOR_CONFIDENT_RECOMMENDATION) {
    reasons.push({
      code: 'NEW_EXERCISE',
      message: 'תרגיל חדש - ממליצים להתחזק לפני שמעלים משקל',
      priority: 1,
    });
    return {
      exerciseId,
      exerciseName,
      recommendation: 'MAINTAIN',
      currentWeight,
      suggestedWeight,
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

  // =========================================================================
  // RULE 1: Too hard - RPE high, consider deload
  // =========================================================================
  if (avgRPE != null && avgRPE >= RPE_THRESHOLD_TO_DECREASE) {
    recommendation = 'DECREASE_WEIGHT';
    suggestedWeight =
      Math.round((currentWeight * DELOAD_PERCENT) / WEIGHT_INCREMENT_SMALL) *
      WEIGHT_INCREMENT_SMALL;
    confidence = 85;
    reasons.push({
      code: 'HIGH_RPE',
      message: `RPE גבוה (${avgRPE.toFixed(1)}) - מומלץ להוריד משקל ולהתחזק`,
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

    // Determine increment based on exercise type and consistency
    let increment = WEIGHT_INCREMENT_SMALL;
    if (consistency >= 0.95 && history.length >= 4) {
      increment = WEIGHT_INCREMENT_MEDIUM;
    }

    // For compound exercises (bench, squat, deadlift), increase more
    const compoundExercises = ['סקוואט', 'דדליפט', 'בנץ', 'שכיבה', 'לחיצה', 'גב'];
    const isCompound = compoundExercises.some((name) =>
      exerciseName.toLowerCase().includes(name.toLowerCase())
    );

    if (isCompound && consistency >= 0.9) {
      increment = WEIGHT_INCREMENT_MEDIUM;
    }

    suggestedWeight = currentWeight + increment;
    confidence = 80;

    reasons.push({
      code: 'CONSISTENT_EASY',
      message: `השלמת ${Math.round(consistency * 100)}% מהסטים בקלות - מומלץ להעלות ${increment} ק"ג`,
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
          suggestedWeight = currentWeight + WEIGHT_INCREMENT_SMALL;
          confidence = 70;
          reasons.push({
            code: 'REPS_INCREASED',
            message: `הגדלת חזרות ל-${lastSession.reps} - מוכן להעלות משקל`,
            priority: 2,
          });
        }
      }
    }
  }

  // =========================================================================
  // RULE 5: Strong consistency over time
  // =========================================================================
  if (consistency >= 0.9 && history.length >= 4 && recommendation === 'MAINTAIN') {
    recommendation = 'INCREASE_WEIGHT';
    suggestedWeight = currentWeight + WEIGHT_INCREMENT_SMALL;
    confidence = Math.min(85, confidence + 15);
    reasons.push({
      code: 'CONSISTENT_LONG_TERM',
      message: `עקביות גבוהה (${Math.round(consistency * 100)}%) ב-${history.length} אימונים - הגיע הזמן להעלות`,
      priority: 3,
    });
  }

  // =========================================================================
  // RULE 6: Very fresh (low RPE, low volume) - might need more volume first
  // =========================================================================
  const rpeForRule6 = avgRPE;
  if (
    lastSession &&
    lastSession.volume < targetReps * currentWeight * 0.5 &&
    rpeForRule6 != null &&
    rpeForRule6 < 5
  ) {
    reasons.push({
      code: 'LOW_VOLUME',
      message: 'נפח נמוך - מומלץ להוסיף סטים לפני שמעלים משקל',
      priority: 2,
    });
    if (recommendation === 'INCREASE_WEIGHT') {
      recommendation = 'INCREASE_REPS';
    }
  }

  // =========================================================================
  // Default: maintain
  // =========================================================================
  if (reasons.length === 0) {
    reasons.push({
      code: 'GENERAL_MAINTAIN',
      message: 'המשך להתאמן במשקל הנוכחי ובנה ביטחון',
      priority: 1,
    });
  }

  if (recoveryScore != null && Number.isFinite(recoveryScore)) {
    if (recoveryScore < RECOVERY_SCORE_DELOAD_THRESHOLD) {
      recommendation = 'DELOAD';
      suggestedWeight =
        Math.round((currentWeight * RECOVERY_DELOAD_PERCENT) / WEIGHT_INCREMENT_SMALL) *
        WEIGHT_INCREMENT_SMALL;
      confidence = Math.max(confidence, 90);
      reasons.push({
        code: 'LOW_RECOVERY',
        message: `התאוששות נמוכה (${Math.round(recoveryScore)}/100) - עדיף אימון קל או דלואד היום`,
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
        priority: 90,
      });
    }
  }

  if (fatigueScore != null && Number.isFinite(fatigueScore)) {
    if (fatigueScore >= FATIGUE_SCORE_DELOAD_THRESHOLD) {
      recommendation = 'DELOAD';
      suggestedWeight =
        Math.round((currentWeight * FATIGUE_DELOAD_PERCENT) / WEIGHT_INCREMENT_SMALL) *
        WEIGHT_INCREMENT_SMALL;
      confidence = Math.max(confidence, 88);
      reasons.push({
        code: 'HIGH_TRAINING_LOAD',
        message: `עומס אימון גבוה (${Math.round(fatigueScore)}/100) - מומלץ דלואד כדי להתאושש`,
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
        priority: 95,
      });
    }
  }

  return {
    exerciseId,
    exerciseName,
    recommendation,
    currentWeight,
    suggestedWeight,
    weightChange: suggestedWeight - currentWeight,
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

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

export function getRecommendationLabel(recommendation: ProgressionRecommendation): string {
  const labels: Record<ProgressionRecommendation, string> = {
    INCREASE_WEIGHT: 'העלה משקל',
    MAINTAIN: 'שמור על המשקל',
    DECREASE_WEIGHT: 'הורד משקל',
    INCREASE_REPS: 'הוסף חזרות',
    DELOAD: 'דלואד',
  };
  return labels[recommendation];
}

export function getRecommendationColor(recommendation: ProgressionRecommendation): string {
  const colors: Record<ProgressionRecommendation, string> = {
    INCREASE_WEIGHT: 'text-green-500',
    MAINTAIN: 'text-yellow-500',
    DECREASE_WEIGHT: 'text-red-500',
    INCREASE_REPS: 'text-blue-500',
    DELOAD: 'text-orange-500',
  };
  return colors[recommendation];
}

export function getRecommendationIcon(recommendation: ProgressionRecommendation): string {
  const icons: Record<ProgressionRecommendation, string> = {
    INCREASE_WEIGHT: '↑',
    MAINTAIN: '→',
    DECREASE_WEIGHT: '↓',
    INCREASE_REPS: '+',
    DELOAD: '↺',
  };
  return icons[recommendation];
}

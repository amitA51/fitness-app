// ============================================================================
// AI Context Builder - Builds context from user data for AI prompts
// ============================================================================

import type { MacroNutrients, WorkoutSession } from '../../types';
import { completedSetsVolume, oneRepMax } from '../../utils/workoutMath';
import { calculateStreak } from '../achievementService';
import type { RecoveryLog } from '../bodyStatsService';
import {
  type MuscleRecoveryState,
  type TrainingLoadRecommendation,
  calculateTrainingLoad,
} from '../trainingLoadService';
import { WEAK_MUSCLE_THRESHOLD } from './constants';

export interface TopExerciseEntry {
  readonly exerciseName: string;
  /** Estimated 1RM (kg) from the best completed working set in recent sessions */
  readonly currentEst1RM: number;
  readonly lastWeight: number;
  readonly lastReps: number;
  /** Percentage change vs earliest comparable session (null if only one session) */
  readonly progressPercent: number | null;
}

export interface AIContext {
  recentWorkouts: WorkoutSession[];
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  weeklyVolume: number;
  previousWeeklyVolume: number;
  volumeChangePercent: number;
  acuteChronicRatio: number;
  fatigueScore: number;
  muscleCoverage: string[];
  muscleRecovery: MuscleRecoveryState[];
  weakMuscles: string[];
  recoveryScore: number | null;
  nutritionCompliance: number | null;
  readinessScore: number;
  readinessLabel: 'low' | 'moderate' | 'good' | 'high';
  primaryConstraint: 'recovery' | 'load_spike' | 'high_rpe' | 'low_volume' | 'balanced';
  trainingLoadRecommendation: TrainingLoadRecommendation;
  streakDays: number;
  /** Top exercises by frequency/recency with pre-computed 1RM and progress */
  topExercises?: readonly TopExerciseEntry[];
}

export function buildSystemPrompt(context: AIContext): string {
  // Sanitize user-derived strings before embedding in prompt
  const sanitize = (s: string) =>
    s
      .replace(/[\r\n\t]/g, ' ')
      .replace(/[^\p{L}\p{N}\p{Zs}\-_'"()]/gu, '')
      .slice(0, 60)
      .trim();

  // ה-persona הגלובלי מוזרק אוטומטית ב-RemoteProvider (ראה ai/config.ts::withPersona).
  // כאן רק מוסיפים את ההקשר הדינמי של המשתמש.
  let prompt = `נתוני המתאמן (התייחס אליהם בתשובה):
- מגמת נפח: ${context.volumeTrend}
- נפח שבועי: ${context.weeklyVolume} ק"ג
- נפח שבוע קודם: ${context.previousWeeklyVolume} ק"ג
- שינוי נפח שבועי: ${context.volumeChangePercent}%
- יחס עומס acute/chronic: ${context.acuteChronicRatio}
- ציון עייפות מתמטי: ${context.fatigueScore}/100
- ציון מוכנות מתמטי: ${context.readinessScore}/100 (${context.readinessLabel})
- מגבלת אימון מרכזית: ${context.primaryConstraint}
- המלצת עומס מתמטית: ${context.trainingLoadRecommendation}
- שרירים שעבד: ${context.muscleCoverage.map(sanitize).join(', ') || 'אין'}
- שרירים חלשים: ${context.weakMuscles.map(sanitize).join(', ') || 'אין'}
- ציון התאוששות: ${context.recoveryScore ?? 'לא ידוע'}
- עמידה בתזונה: ${context.nutritionCompliance !== null ? `${context.nutritionCompliance}%` : 'לא ידוע'}
- רצף אימונים: ${context.streakDays} ימים`;

  if (context.topExercises && context.topExercises.length > 0) {
    prompt += '\n\n--- תרגילים מובילים (חישוב מתמטי מדויק, יחידות: ק"ג) ---';
    for (const entry of context.topExercises) {
      const progress =
        entry.progressPercent !== null ? `${entry.progressPercent}%` : 'אין מספיק נתונים';
      prompt += `\n• ${sanitize(entry.exerciseName)}: 1RM=${entry.currentEst1RM} ק"ג | אחרון=${entry.lastWeight}x${entry.lastReps} | התקדמות=${progress}`;
    }
  }

  prompt +=
    '\n\nקודם השתמש בחישובים המתמטיים האלה כדי להחליט על עומס/מנוחה/דלואד. השתמש ב-AI רק כדי לנסח הסבר קצר וברור.';

  return prompt;
}

/**
 * Compute top exercises by frequency and recency from recent sessions.
 * Uses oneRepMax from workoutMath as the single source of truth for 1RM.
 */
function computeTopExercises(sessions: ReadonlyArray<WorkoutSession>): readonly TopExerciseEntry[] {
  // Gather per-exercise data: frequency, most recent session index, best 1RM, etc.
  interface ExerciseAgg {
    exerciseName: string;
    frequency: number;
    /** Index in sessions array (lower = more recent since sessions are newest-first) */
    mostRecentIdx: number;
    /** Best 1RM across all completed working sets in recent sessions */
    best1RM: number;
    /** Last completed working set weight/reps (from most recent session) */
    lastWeight: number;
    lastReps: number;
    /** Earliest session's best 1RM for progress comparison */
    earliest1RM: number;
  }

  const aggMap = new Map<string, ExerciseAgg>();

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i];
    if (!session || session.status !== 'completed') continue;

    for (const exercise of session.exercises) {
      const name = exercise.exerciseName;
      let agg = aggMap.get(name);
      if (!agg) {
        agg = {
          exerciseName: name,
          frequency: 0,
          mostRecentIdx: i,
          best1RM: 0,
          lastWeight: 0,
          lastReps: 0,
          earliest1RM: 0,
        };
        aggMap.set(name, agg);
      }

      agg.frequency += 1;
      // Track most recent (lowest index)
      if (i < agg.mostRecentIdx) {
        agg.mostRecentIdx = i;
      }

      // Find best completed working set in this exercise instance
      let sessionBest1RM = 0;
      let sessionLastWeight = 0;
      let sessionLastReps = 0;
      for (const set of exercise.sets) {
        if (set.isCompleted && !set.isWarmup && set.weight > 0 && set.reps > 0) {
          const est = oneRepMax(set.weight, set.reps);
          if (est > sessionBest1RM) {
            sessionBest1RM = est;
            sessionLastWeight = set.weight;
            sessionLastReps = set.reps;
          }
        }
      }

      if (sessionBest1RM > agg.best1RM) {
        agg.best1RM = sessionBest1RM;
      }

      // Update last weight/reps from the most recent session
      if (i === agg.mostRecentIdx && sessionBest1RM > 0) {
        agg.lastWeight = sessionLastWeight;
        agg.lastReps = sessionLastReps;
      }

      // Track earliest 1RM (overwrite each time — last write is the oldest session)
      if (sessionBest1RM > 0) {
        agg.earliest1RM = sessionBest1RM;
      }
    }
  }

  // Score by frequency + recency, take top 5
  const entries = Array.from(aggMap.values()).filter((a) => a.best1RM > 0);
  entries.sort((a, b) => {
    // Primary: frequency descending
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    // Secondary: recency (lower index = more recent)
    return a.mostRecentIdx - b.mostRecentIdx;
  });

  return entries.slice(0, 5).map((agg): TopExerciseEntry => {
    const progressPercent =
      agg.earliest1RM > 0 && agg.earliest1RM !== agg.best1RM
        ? Math.round(((agg.best1RM - agg.earliest1RM) / agg.earliest1RM) * 100)
        : null;
    return {
      exerciseName: agg.exerciseName,
      currentEst1RM: agg.best1RM,
      lastWeight: agg.lastWeight,
      lastReps: agg.lastReps,
      progressPercent,
    };
  });
}

export function buildContext(
  sessions: WorkoutSession[],
  recoveryLogs: RecoveryLog[] = [],
  nutritionData?: { dailyAverage: MacroNutrients; goal: MacroNutrients }
): AIContext {
  const recentSessions = sessions.slice(0, 10);
  const trainingLoad = calculateTrainingLoad(sessions, recoveryLogs);

  let volumeTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (trainingLoad.volumeChangePercent > 5) volumeTrend = 'increasing';
  else if (trainingLoad.volumeChangePercent < -5) volumeTrend = 'decreasing';

  // Muscle coverage
  const muscleSet = new Set<string>();
  recentSessions.forEach((s) =>
    s.exercises.forEach((e) => {
      const muscle = e.muscleGroup || e.targetMuscle;
      if (muscle) muscleSet.add(muscle);
    })
  );

  // Calculate weak muscles (below average volume) — uses COMPLETED working sets only
  const muscleVolumes: Record<string, number> = {};
  recentSessions.forEach((s) =>
    s.exercises.forEach((e) => {
      const muscle = e.muscleGroup || e.targetMuscle;
      if (muscle) {
        const vol = completedSetsVolume(e.sets);
        muscleVolumes[muscle] = (muscleVolumes[muscle] || 0) + vol;
      }
    })
  );

  const volumes = Object.values(muscleVolumes);
  const avgVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
  const weakMuscles = Object.entries(muscleVolumes)
    .filter(([, v]) => v < avgVolume * WEAK_MUSCLE_THRESHOLD)
    .map(([m]) => m);

  // Nutrition compliance
  let nutritionCompliance: number | null = null;
  if (nutritionData && nutritionData.goal.calories > 0) {
    const pct = Math.min(
      100,
      Math.round((nutritionData.dailyAverage.calories / nutritionData.goal.calories) * 100)
    );
    nutritionCompliance = pct;
  }

  // Streak (shared canonical calculation — local-date keyed, see achievementService)
  const streakDays = calculateStreak(sessions).currentStreak;

  // Top exercises enrichment
  const topExercises = computeTopExercises(recentSessions);

  return {
    recentWorkouts: recentSessions,
    volumeTrend,
    weeklyVolume: trainingLoad.weeklyVolume,
    previousWeeklyVolume: trainingLoad.previousWeeklyVolume,
    volumeChangePercent: trainingLoad.volumeChangePercent,
    acuteChronicRatio: trainingLoad.acuteChronicRatio,
    fatigueScore: trainingLoad.fatigueScore,
    muscleCoverage: Array.from(muscleSet),
    muscleRecovery: trainingLoad.muscles,
    weakMuscles,
    recoveryScore: trainingLoad.recoveryScore,
    nutritionCompliance,
    primaryConstraint: trainingLoad.primaryConstraint,
    readinessLabel: trainingLoad.readinessLabel,
    readinessScore: trainingLoad.readinessScore,
    trainingLoadRecommendation: trainingLoad.recommendation,
    streakDays,
    topExercises,
  };
}

// ============================================================================
// AI Context Builder - Builds context from user data for AI prompts
// ============================================================================

import type { MacroNutrients, WorkoutSession } from '../../types';
import { completedSetsVolume, oneRepMax } from '../../utils/workoutMath';
import { calculateStreak } from '../achievementService';
import type { RecoveryLog } from '../bodyStatsService';
import {
  type NutritionAdherence,
  computeNutritionAdherence,
} from '../intelligence/nutritionAdherence';
import { type AthleteProfile, describeProfile, readAthleteProfile } from '../intelligence/profile';
import {
  type MuscleRecoveryState,
  type TrainingLoadRecommendation,
  calculateTrainingLoad,
} from '../trainingLoadService';
import { WEAK_MUSCLE_THRESHOLD } from './constants';

/** Which inputs were actually available, so the model can hedge rather than
 * narrate defaulted values as fact (TL-7). */
export interface DataSufficiency {
  hasRpe: boolean;
  hasRecovery: boolean;
  hasChronicBaseline: boolean;
  /** 0..1 fraction of profile fields populated. */
  profileCompleteness: number;
  sessionCount: number;
}

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
  neglectedMuscles: string[];
  recoveryScore: number | null;
  nutrition: NutritionAdherence | null;
  profile: AthleteProfile;
  dataSufficiency: DataSufficiency;
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
- פרופיל: ${describeProfile(context.profile)}
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
- שרירים מוזנחים: ${context.neglectedMuscles.map(sanitize).join(', ') || 'אין'}
- ציון התאוששות: ${context.recoveryScore ?? 'לא ידוע'}
- עמידה בתזונה: ${context.nutrition ? context.nutrition.summary : 'לא ידוע'}
- רצף אימונים: ${context.streakDays} ימים`;

  if (context.topExercises && context.topExercises.length > 0) {
    prompt += '\n\n--- תרגילים מובילים (חישוב מתמטי מדויק, יחידות: ק"ג) ---';
    for (const entry of context.topExercises) {
      const progress =
        entry.progressPercent !== null ? `${entry.progressPercent}%` : 'אין מספיק נתונים';
      prompt += `\n• ${sanitize(entry.exerciseName)}: 1RM=${entry.currentEst1RM} ק"ג | אחרון=${entry.lastWeight}x${entry.lastReps} | התקדמות=${progress}`;
    }
  }

  // Per-muscle recovery — previously computed and stored but never shown to the
  // model (TL-6). Render the most fatigued/neglected muscles only, to keep it tight.
  const notableMuscles = context.muscleRecovery
    .filter((m) => m.status === 'fatigued' || m.status === 'neglected')
    .slice(0, 5);
  if (notableMuscles.length > 0) {
    prompt += '\n\n--- התאוששות לפי שריר (חישוב מתמטי) ---';
    for (const m of notableMuscles) {
      const days = m.daysSinceLastTrained === null ? '?' : m.daysSinceLastTrained;
      prompt += `\n• ${sanitize(m.muscle)}: ${m.status} | מוכנות=${m.recoveryScore}/100 | ${days} ימים מאז אימון`;
    }
  }

  // Data-sufficiency hedge (TL-7): when key inputs were defaulted, tell the model
  // to qualify its confidence instead of narrating assumptions as fact.
  const { dataSufficiency: ds } = context;
  const gaps: string[] = [];
  if (!ds.hasRpe) gaps.push('אין נתוני RPE');
  if (!ds.hasRecovery) gaps.push('אין יומן התאוששות');
  if (!ds.hasChronicBaseline) gaps.push('אין בסיס נתונים של 3 שבועות');
  if (ds.profileCompleteness < 0.5) gaps.push('פרופיל חלקי');
  if (gaps.length > 0) {
    prompt += `\n\nשים לב — נתונים חסרים (${gaps.join(', ')}): סייג את רמת הביטחון בהמלצה ואל תציג הערכות ברירת-מחדל כעובדה.`;
  }

  prompt +=
    '\n\nקודם השתמש בחישובים המתמטיים האלה כדי להחליט על עומס/מנוחה/דלואד. השתמש ב-AI רק כדי לנסח הסבר קצר וברור. אל תמציא מספרים — השתמש רק במספרים שסופקו כאן.';

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

  // Profile (age/weight/experience/goal/equipment) — feeds personalization and
  // the goal-aware nutrition signal. Read from settings/onboarding stores.
  const profile = readAthleteProfile();

  // Goal-aware, protein-inclusive nutrition adherence (replaces calories-only %).
  const nutrition = nutritionData
    ? computeNutritionAdherence(
        nutritionData.dailyAverage,
        nutritionData.goal,
        profile.weightDirection
      )
    : null;

  const neglectedMuscles = trainingLoad.muscles
    .filter((m) => m.status === 'neglected')
    .map((m) => m.muscle);

  // Streak — use COMPLETED sessions so the AI's streak matches the dashboard's
  // (which counts completed-only), instead of counting in-progress sessions (SM-4).
  const streakDays = calculateStreak(
    sessions.filter((s) => s.status === 'completed')
  ).currentStreak;

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
    neglectedMuscles,
    recoveryScore: trainingLoad.recoveryScore,
    nutrition,
    profile,
    dataSufficiency: {
      hasRpe: trainingLoad.hasRpeData,
      hasRecovery: trainingLoad.hasRecoveryData,
      hasChronicBaseline: trainingLoad.hasChronicBaseline,
      profileCompleteness: profile.completeness,
      sessionCount: sessions.filter((s) => s.status === 'completed').length,
    },
    primaryConstraint: trainingLoad.primaryConstraint,
    readinessLabel: trainingLoad.readinessLabel,
    readinessScore: trainingLoad.readinessScore,
    trainingLoadRecommendation: trainingLoad.recommendation,
    streakDays,
    topExercises,
  };
}

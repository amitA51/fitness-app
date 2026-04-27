// ============================================================================
// AI Context Builder - Builds context from user data for AI prompts
// ============================================================================

import type { MacroNutrients, WorkoutSession } from '../../types';
import type { RecoveryLog } from '../bodyStatsService';
import {
  type MuscleRecoveryState,
  type TrainingLoadRecommendation,
  calculateTrainingLoad,
} from '../trainingLoadService';

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
}

export function buildSystemPrompt(context: AIContext): string {
  // ה-persona הגלובלי מוזרק אוטומטית ב-RemoteProvider (ראה ai/config.ts::withPersona).
  // כאן רק מוסיפים את ההקשר הדינמי של המשתמש.
  return `נתוני המתאמן (התייחס אליהם בתשובה):
- מגמת נפח: ${context.volumeTrend}
- נפח שבועי: ${context.weeklyVolume} ק"ג
- נפח שבוע קודם: ${context.previousWeeklyVolume} ק"ג
- שינוי נפח שבועי: ${context.volumeChangePercent}%
- יחס עומס acute/chronic: ${context.acuteChronicRatio}
- ציון עייפות מתמטי: ${context.fatigueScore}/100
- ציון מוכנות מתמטי: ${context.readinessScore}/100 (${context.readinessLabel})
- מגבלת אימון מרכזית: ${context.primaryConstraint}
- המלצת עומס מתמטית: ${context.trainingLoadRecommendation}
- שרירים שעבד: ${context.muscleCoverage.join(', ') || 'אין'}
- שרירים חלשים: ${context.weakMuscles.join(', ') || 'אין'}
- ציון התאוששות: ${context.recoveryScore ?? 'לא ידוע'}
- עמידה בתזונה: ${context.nutritionCompliance !== null ? `${context.nutritionCompliance}%` : 'לא ידוע'}
- רצף אימונים: ${context.streakDays} ימים

קודם השתמש בחישובים המתמטיים האלה כדי להחליט על עומס/מנוחה/דלואד. השתמש ב-AI רק כדי לנסח הסבר קצר וברור.`;
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

  // Calculate weak muscles (below average volume)
  const muscleVolumes: Record<string, number> = {};
  recentSessions.forEach((s) =>
    s.exercises.forEach((e) => {
      const muscle = e.muscleGroup || e.targetMuscle;
      if (muscle) {
        const vol = e.sets.reduce((sum, set) => sum + set.weight * set.reps, 0);
        muscleVolumes[muscle] = (muscleVolumes[muscle] || 0) + vol;
      }
    })
  );

  const volumes = Object.values(muscleVolumes);
  const avgVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
  const weakMuscles = Object.entries(muscleVolumes)
    .filter(([, v]) => v < avgVolume * 0.8)
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

  // Streak
  const uniqueDates = [...new Set(sessions.map((s) => s.date))].sort().reverse();
  let streakDays = 0;
  if (uniqueDates.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < uniqueDates.length; i++) {
      const dateStr = uniqueDates[i];
      if (!dateStr) break;
      const d = new Date(dateStr);
      const expected = new Date(today);
      expected.setDate(today.getDate() - i);
      if (d.toDateString() === expected.toDateString()) streakDays++;
      else break;
    }
  }

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
  };
}

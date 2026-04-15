// ============================================================================
// AI Context Builder - Builds context from user data for AI prompts
// ============================================================================

import type { WorkoutSession, MacroNutrients } from '../../types';
import type { RecoveryLog } from '../bodyStatsService';

export interface AIContext {
  recentWorkouts: WorkoutSession[];
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  weeklyVolume: number;
  muscleCoverage: string[];
  weakMuscles: string[];
  recoveryScore: number | null;
  nutritionCompliance: number | null;
  streakDays: number;
}

function computeRecoveryScore(log: RecoveryLog): number {
  const sleepHoursScore = log.sleepHours >= 7 ? 25 : log.sleepHours >= 5 ? 15 : 5;
  const qualityScore = log.sleepQuality * 5;
  const energyScore = log.energyLevel * 5;
  const stressScore = (6 - log.stressLevel) * 5;
  return sleepHoursScore + qualityScore + energyScore + stressScore;
}

export function buildSystemPrompt(context: AIContext): string {
  return `אתה מאמן כושר אישי מקצועי. ענה בעברית.
נתוני המתאמן:
- מגמת נפח: ${context.volumeTrend}
- נפח שבועי: ${context.weeklyVolume} ק"ג
- שרירים שעבד: ${context.muscleCoverage.join(', ')}
- שרירים חלשים: ${context.weakMuscles.join(', ') || 'אין'}
- ציון התאוששות: ${context.recoveryScore ?? 'לא ידוע'}
- עמידה בתזונה: ${context.nutritionCompliance !== null ? context.nutritionCompliance + '%' : 'לא ידוע'}
- רצף אימונים: ${context.streakDays} ימים

תן עצות מעשיות וספציפיות. התמקד בנתונים של המתאמן.`;
}

export function buildContext(
  sessions: WorkoutSession[],
  recoveryLogs: RecoveryLog[] = [],
  nutritionData?: { dailyAverage: MacroNutrients; goal: MacroNutrients }
): AIContext {
  const recentSessions = sessions.slice(0, 10);

  // Calculate weekly volume from last week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const lastWeekSessions = sessions.filter(s => new Date(s.startTime) >= oneWeekAgo);
  const weeklyVolume = lastWeekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);

  // Volume trend
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const prevWeekSessions = sessions.filter(s => {
    const d = new Date(s.startTime);
    return d >= twoWeeksAgo && d < oneWeekAgo;
  });
  const prevVolume = prevWeekSessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0);

  let volumeTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (prevVolume > 0) {
    const change = (weeklyVolume - prevVolume) / prevVolume;
    if (change > 0.05) volumeTrend = 'increasing';
    else if (change < -0.05) volumeTrend = 'decreasing';
  }

  // Muscle coverage
  const muscleSet = new Set<string>();
  recentSessions.forEach(s => s.exercises.forEach(e => {
    const muscle = e.muscleGroup || e.targetMuscle;
    if (muscle) muscleSet.add(muscle);
  }));

  // Calculate weak muscles (below average volume)
  const muscleVolumes: Record<string, number> = {};
  recentSessions.forEach(s => s.exercises.forEach(e => {
    const muscle = e.muscleGroup || e.targetMuscle;
    if (muscle) {
      const vol = e.sets.reduce((sum, set) => sum + (set.weight * set.reps), 0);
      muscleVolumes[muscle] = (muscleVolumes[muscle] || 0) + vol;
    }
  }));

  const volumes = Object.values(muscleVolumes);
  const avgVolume = volumes.length > 0 ? volumes.reduce((a, b) => a + b, 0) / volumes.length : 0;
  const weakMuscles = Object.entries(muscleVolumes)
    .filter(([, v]) => v < avgVolume * 0.8)
    .map(([m]) => m);

  // Recovery score
  const latestRecovery = recoveryLogs[0];
  const recoveryScore = latestRecovery ? computeRecoveryScore(latestRecovery) : null;

  // Nutrition compliance
  let nutritionCompliance: number | null = null;
  if (nutritionData && nutritionData.goal.calories > 0) {
    const pct = Math.min(100, Math.round((nutritionData.dailyAverage.calories / nutritionData.goal.calories) * 100));
    nutritionCompliance = pct;
  }

  // Streak
  const uniqueDates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  let streakDays = 0;
  if (uniqueDates.length > 0) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < uniqueDates.length; i++) {
      const d = new Date(uniqueDates[i]);
      const expected = new Date(today);
      expected.setDate(today.getDate() - i);
      if (d.toDateString() === expected.toDateString()) streakDays++;
      else break;
    }
  }

  return {
    recentWorkouts: recentSessions,
    volumeTrend,
    weeklyVolume,
    muscleCoverage: Array.from(muscleSet),
    weakMuscles,
    recoveryScore,
    nutritionCompliance,
    streakDays,
  };
}

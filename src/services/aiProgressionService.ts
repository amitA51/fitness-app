/**
 * AI Progression Service
 * Provides AI-enhanced workout progression recommendations
 */

import type { WorkoutSession } from '../types';
import { logger } from '../utils/logger';
import { buildContext } from './ai/contextBuilder';
import { type ChatMessage, getAIProvider } from './ai/core';
import {
  type AIProgressionContext,
  type ExerciseProgressionData,
  buildAIProgressionContext,
  calculateProgression,
  getRecommendationLabel,
} from './progressionService';

// ============================================================================
// TYPES
// ============================================================================

export interface AIProgressionResponse {
  recommendation: string;
  reasoning: string;
  suggestedWeight: number;
  suggestedReps: number;
  warnings: string[];
  tips: string[];
  nextWorkout?: string;
}

export interface ExerciseWithProgression {
  exerciseId: string;
  exerciseName: string;
  aiAdvice: AIProgressionResponse;
}

// ============================================================================
// MAIN AI FUNCTIONS
// ============================================================================

/**
 * Generate AI-enhanced progression advice for a single exercise
 */
export async function getAIProgressionAdvice(
  exerciseId: string,
  exerciseName: string,
  sessions: WorkoutSession[],
  targetReps = 8,
  targetSets = 4
): Promise<AIProgressionResponse> {
  // First calculate base recommendation
  const baseRec = calculateProgression({
    exerciseId,
    exerciseName,
    targetReps,
    targetSets,
    sessions,
  });

  const ctx = buildAIProgressionContext(baseRec);

  // Build AI prompt
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `אתה מאמן כושר מקצועי עם ניסיון של 15 שנה. 
אתה מתמחה בתכנון אימונים, התקדמות במשקלות, והבנת סימני עייפות.
תמיד תן עצות בעברית, מעשיות ובטוחות.
שים לב לסימני overtraining ופציעות.`,
    },
    {
      role: 'user',
      content: buildProgressionPrompt(ctx),
    },
  ];

  try {
    const provider = getAIProvider();
    const response = await provider.chat(messages);
    return parseAIResponse(response, baseRec);
  } catch (error) {
    logger.ai.error('AI progression error:', error);
    return fallbackResponse(baseRec);
  }
}

/**
 * Generate AI progression advice for multiple exercises (workout plan)
 */
export async function getAIWorkoutProgressionPlan(
  exercises: { id: string; name: string; targetReps?: number; targetSets?: number }[],
  sessions: WorkoutSession[]
): Promise<ExerciseWithProgression[]> {
  // Parallel with concurrency cap of 3 — keeps OpenRouter happy while
  // collapsing a 6-exercise plan from ~10s sequential to ~4s.
  const CONCURRENCY = 3;
  const results: ExerciseWithProgression[] = [];

  for (let i = 0; i < exercises.length; i += CONCURRENCY) {
    const chunk = exercises.slice(i, i + CONCURRENCY);
    const chunkResults = await Promise.all(
      chunk.map(async (exercise) => {
        const advice = await getAIProgressionAdvice(
          exercise.id,
          exercise.name,
          sessions,
          exercise.targetReps || 8,
          exercise.targetSets || 4
        );
        return {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          aiAdvice: advice,
        } as ExerciseWithProgression;
      })
    );
    results.push(...chunkResults);
  }

  return results;
}

/**
 * Generate weekly progression summary with AI
 */
export async function getAIWeeklyProgressionSummary(sessions: WorkoutSession[]): Promise<string> {
  if (sessions.length === 0) {
    return 'אין מספיק נתונים ליצירת סיכום שבועי.';
  }

  const context = buildContext(sessions);

  // Calculate workouts this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const workoutsThisWeek = sessions.filter(
    (s) => s.status === 'completed' && new Date(s.startTime) >= oneWeekAgo
  ).length;

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `אתה מאמן כושר חכם. נתח את ההתקדמות השבועית ותן סיכום קצר (2-3 משפטים) עם:
1. מה השתפר
2. מה צריך לשים לב
3. המלצה קטנה לאימון הבא`,
    },
    {
      role: 'user',
      content: `סכם את ההתקדמות השבועית שלי:
- נפח שבועי: ${context.weeklyVolume} ק"ג
- מגמת נפח: ${context.volumeTrend}
- אימונים השבוע: ${workoutsThisWeek}
- שרירים חלשים: ${context.weakMuscles.join(', ') || 'אין'}`,
    },
  ];

  try {
    const provider = getAIProvider();
    return await provider.chat(messages);
  } catch (error) {
    logger.ai.error('AI weekly summary error:', error);
    return 'לא הצלחנו ליצור סיכום. נסה שוב מאוחר יותר.';
  }
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildProgressionPrompt(ctx: AIProgressionContext): string {
  return `
נתח את ההתקדמות שלי בתרגיל ${ctx.exerciseName} ותן לי עצה מותאמת אישית.

**נתונים:**
- משקל נוכחי: ${ctx.currentWeight} ק"ג
- מטרה: ${ctx.targetSets} סטים × ${ctx.targetReps} חזרות
- RPE ממוצע: ${ctx.averageRPE?.toFixed(1) || 'לא נמדד'}
- RPE אחרונים: [${ctx.recentRPEs.map((r) => r.toFixed(1)).join(', ') || 'אין'}]
- עקביות: ${Math.round(ctx.consistency * 100)}%
- מגמת נפח: ${ctx.volumeTrend}
- המלצת מערכת: ${getRecommendationLabel(ctx.recommendation)}

**היסטוריה אחרונה:**
${ctx.history
  .slice(-3)
  .map(
    (h, i) =>
      `  ${i + 1}. ${h.date}: ${h.weight}ק"ג × ${h.reps} חזרות, RPE: ${h.rpe?.toFixed(1) || '?'}, ${h.wasCompleted ? '✓' : '✗'}`
  )
  .join('\n')}

תן לי:
1. המלצה ברורה למשקל הבא
2. הסבר קצר למה
3. אזהרות אם יש (פציעות, overtraining)
4. טיפ אחד לשיפור`;
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

function parseAIResponse(
  response: string,
  baseRec: ExerciseProgressionData
): AIProgressionResponse {
  // Try to extract structured data from response
  const weightMatch = response.match(/(\d+(?:\.\d+)?)\s*ק"?ג/);
  const suggestedWeight =
    weightMatch && weightMatch[1] ? Number.parseFloat(weightMatch[1]) : baseRec.suggestedWeight;

  // Extract warnings (look for patterns like "אזהרה", "שים לב", "היזהר")
  const warningPatterns = [
    /אזהרה[^\n]*\n?([^\n]+)/gi,
    /שים לב[^\n]*\n?([^\n]+)/gi,
    /היזהר[^\n]*\n?([^\n]+)/gi,
  ];
  const warnings: string[] = [];
  warningPatterns.forEach((pattern) => {
    const matches = response.match(pattern);
    if (matches) {
      matches.forEach((m) => warnings.push(m.trim()));
    }
  });

  // Extract tips (look for "טיפ", "הצעה", "כדאי")
  const tipPatterns = [
    /טיפ[^\n]*\n?([^\n]+)/gi,
    /כדאי[^\n]*\n?([^\n]+)/gi,
    /הצעה[^\n]*\n?([^\n]+)/gi,
  ];
  const tips: string[] = [];
  tipPatterns.forEach((pattern) => {
    const matches = response.match(pattern);
    if (matches) {
      matches.forEach((m) => tips.push(m.trim()));
    }
  });

  return {
    recommendation: getRecommendationLabel(baseRec.recommendation),
    reasoning: response,
    suggestedWeight,
    suggestedReps: baseRec.lastSession
      ? Math.round(baseRec.lastSession.reps / baseRec.lastSession.setsCompleted)
      : 8,
    warnings: warnings.slice(0, 3), // Max 3 warnings
    tips: tips.slice(0, 2), // Max 2 tips
  };
}

function fallbackResponse(baseRec: ExerciseProgressionData): AIProgressionResponse {
  const label = getRecommendationLabel(baseRec.recommendation);

  let reasoning = '';
  switch (baseRec.recommendation) {
    case 'INCREASE_WEIGHT':
      reasoning = `על בסיס ${baseRec.history.length} אימונים, אתה מוכן להעלות משקל. `;
      reasoning += `העקביות שלך טובה וה-RPE מאפשר.`;
      break;
    case 'MAINTAIN':
      reasoning = `מומלץ לשמור על המשקל הנוכחי ולהתמקד בטכניקה.`;
      break;
    case 'DECREASE_WEIGHT':
      reasoning = `ה-RPE גבוה מדי. מומלץ להוריד משקל ולהתחזק.`;
      break;
    default:
      reasoning = baseRec.reasons[0]?.message || 'המשך להתאמן באופן עקבי.';
  }

  return {
    recommendation: label,
    reasoning,
    suggestedWeight: baseRec.suggestedWeight,
    suggestedReps: baseRec.lastSession?.reps || 8,
    warnings:
      baseRec.recommendation === 'DECREASE_WEIGHT' ? ['שים לב לכאבים - אל תתאמן דרך כאב'] : [],
    tips: [],
  };
}

// ============================================================================
// UTILITY: Check if user is ready to progress
// ============================================================================

export function isReadyToProgress(
  sessions: WorkoutSession[],
  exerciseId: string,
  exerciseName: string
): boolean {
  const baseRec = calculateProgression({
    exerciseId,
    exerciseName,
    targetReps: 8,
    targetSets: 4,
    sessions,
  });

  return baseRec.recommendation === 'INCREASE_WEIGHT' && baseRec.confidence >= 70;
}

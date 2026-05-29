// ============================================================================
// AI Features - AI-powered features that use the provider
// ============================================================================

import type { WorkoutSession } from '../../types';
import type { MacroNutrients } from '../../types';
import { exerciseVolume, sessionVolume } from '../../utils/workoutMath';
import type { RecoveryLog } from '../bodyStatsService';
import { buildContext, buildSystemPrompt } from './contextBuilder';
import { type ChatMessage, getAIProvider } from './core';

/**
 * Sanitize user-provided text before embedding in prompts to mitigate
 * prompt-injection. Strips control characters and trims to a safe length.
 */
function sanitizeForPrompt(input: string, maxLength = 100): string {
  return input
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^\p{L}\p{N}\p{Zs}\-_'"()]/gu, '')
    .slice(0, maxLength)
    .trim();
}

export async function getWorkoutAdvice(
  sessions: WorkoutSession[],
  recoveryLogs?: RecoveryLog[],
  nutritionData?: { dailyAverage: MacroNutrients; goal: MacroNutrients }
): Promise<string> {
  const context = buildContext(sessions, recoveryLogs || [], nutritionData);
  const provider = getAIProvider();

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    { role: 'user', content: 'תן לי עצה לאימון הבא שלי על בסיס הנתונים שלי' },
  ];

  try {
    return await provider.chat(messages);
  } catch {
    return 'לא הצלחתי להפיק עצה כרגע. בדוק את החיבור לאינטרנט ונסה שוב בעוד רגע.';
  }
}

export async function suggestWeight(
  exerciseName: string,
  targetReps: number,
  previousBest?: { weight: number; reps: number }
): Promise<string> {
  const provider = getAIProvider();

  // The professional-coach persona is injected globally by the provider
  // (withPersona in ai/config.ts), so we only supply the task-specific
  // instruction here to avoid sending two persona blocks to the model.
  const safeName = sanitizeForPrompt(exerciseName);
  let contextMsg = `אני רוצה לדעת איזה משקל להשתמש ב-${safeName} ל-${targetReps} חזרות.`;
  if (previousBest) {
    contextMsg += ` בפעם האחרונה עשיתי ${previousBest.weight}ק"ג ל-${previousBest.reps} חזרות.`;
  }
  contextMsg += ' תן המלצת משקל ספציפית.';

  const messages: ChatMessage[] = [{ role: 'user', content: contextMsg }];

  try {
    return await provider.chat(messages);
  } catch {
    return 'לא הצלחתי להמליץ על משקל כרגע. נסה שוב בעוד רגע.';
  }
}

/**
 * Rule-based exercise suggestions — no AI/network call. Returns up to 3
 * exercises for the muscle group that the user is not already doing.
 */
export async function suggestExercises(
  muscleGroup: string,
  currentExercises: string[] = []
): Promise<string[]> {
  // Rule-based fallback for exercise suggestions
  const exerciseDatabase: Record<string, string[]> = {
    חזה: ['לחיצת חזה בנטילות', 'פרפר במכשיר', 'לחיצת חזה עליון', 'כפיפת מרפקים בשכיבה', 'קרוסאובר'],
    גב: ['חתירה בפולי עליון', 'חתירה בפולי תחתון', 'משיכת יד בפולי', 'לחיצת גב לט', 'דדליפט'],
    כתפיים: ['לחיצת כתפיים עם משקולות', 'הרמת ידיים צידה', 'הרמת ידיים קדימה', 'פרפר כתפיים'],
    רגליים: ['סקווט', 'לחיצת רגליים', 'כפיפת ברך במכשיר', 'פשיטת רגל במכשיר', 'סרבן'],
    ביצפס: ['כפיפת מרפקים עם משקולת', 'כפיפת מרפקים בפולי', 'כפיפת מרפקים עם מוט Z', 'פטיש'],
    טריצפס: ['פשיטת מרפקים בפולי', 'פשיטת מרפקים עם משקולת', 'דיפ', 'פשיטת מרפקים בשכיבה'],
    אמות: ['כפיפת שורש כף יד', 'פשיטת שורש כף יד', 'סיבוב אמה'],
    בטן: ['כפיפת בטן', 'שכיבות סירה', 'פלאנק', 'כפיפת בטן עם סיבוב', 'הרמת רגליים'],
  };

  const available = exerciseDatabase[muscleGroup] || [];
  const notAlreadyDoing = available.filter((e) => !currentExercises.includes(e));
  return notAlreadyDoing.slice(0, 3);
}

/**
 * Rule-based workout summary — no AI/network call. Formats volume, sets and
 * duration from the session data.
 */
export async function generateWorkoutSummary(session: WorkoutSession): Promise<string> {
  const exercises = session.exercises || [];
  const totalVolume = sessionVolume(session);

  const completedSets = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.isCompleted && !s.isWarmup).length,
    0
  );

  const totalSets = exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => !s.isWarmup).length,
    0
  );

  const durationMin = Math.round((session.duration || 0) / 60);

  const exerciseSummary = exercises
    .map((ex) => {
      const vol = exerciseVolume(ex);
      return `${ex.exerciseName}: ${vol.toLocaleString()} ק"ג נפח`;
    })
    .join('\n');

  return `סיכום אימון · ${session.date || 'היום'}

משך:   ${durationMin} דקות
נפח:   ${totalVolume.toLocaleString()} ק"ג
סטים:  ${completedSets}/${totalSets}

לפי תרגיל:
${exerciseSummary}`;
}

/**
 * Rule-based form tips — no AI/network call. Looks up tips by exercise name
 * with a generic fallback.
 */
export async function getFormTips(exerciseName: string): Promise<string[]> {
  const safeName = sanitizeForPrompt(exerciseName);
  const tipsDatabase: Record<string, string[]> = {
    סקווט: ['שמור על הגב ישר', 'הברכיים לא עוברות את קצות האצבעות', 'רד עד שהירך מקבילה לרצפה'],
    'לחיצת חזה': ['הורד את המוט עד שנוגע בחזה', 'שמור על השכמות מכווצות', 'רגליים יציבות על הרצפה'],
    דדליפט: ['שמור על המוט קרוב לגוף', 'גב ישר לאורך כל התנועה', 'דחוף דרך העקבים'],
    חתירה: ['משוך אל הבטן התחתונה', 'שמור על הגב ישר', 'סחוץ את השכמות בנקודה העליונה'],
    'לחיצת כתפיים': ['אל תיקח את המשקל מאחורי הצוואר', 'שמור על הליבה יציבה', 'חיבור מלא בכל חזרה'],
  };

  for (const [key, tips] of Object.entries(tipsDatabase)) {
    if (safeName.includes(key) || key.includes(safeName)) {
      return tips;
    }
  }

  return [
    'שמור על טכניקה נכונה לאורך כל התנועה',
    'נשום נכון: נשיפה במאמץ, שאיפה בחזרה',
    'התחל עם משקל קל והעלה בהדרגה',
  ];
}

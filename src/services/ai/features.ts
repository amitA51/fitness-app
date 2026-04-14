// ============================================================================
// AI Features - AI-powered features that use the provider
// ============================================================================

import { getAIProvider, type ChatMessage } from './core';
import { buildSystemPrompt, buildContext } from './contextBuilder';
import type { WorkoutSession } from '../../types';
import type { RecoveryLog } from '../recoveryService';
import type { MacroNutrients } from '../../types';

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

  return provider.chat(messages);
}

export async function suggestWeight(
  exerciseName: string,
  targetReps: number,
  previousBest?: { weight: number; reps: number }
): Promise<string> {
  const provider = getAIProvider();

  let contextMsg = `אני רוצה לדעת איזה משקל להשתמש ב-${exerciseName} ל-${targetReps} חזרות.`;
  if (previousBest) {
    contextMsg += ` בפעם האחרונה עשיתי ${previousBest.weight}ק"ג ל-${previousBest.reps} חזרות.`;
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: 'אתה מאמן כושר מקצועי. ענה בעברית בקצרה ובמעשיות. תן המלצת משקל ספציפית.' },
    { role: 'user', content: contextMsg },
  ];

  return provider.chat(messages);
}

export async function suggestExercises(
  muscleGroup: string,
  currentExercises: string[] = [],
  _weakMuscles: string[] = []
): Promise<string[]> {
  // Rule-based fallback for exercise suggestions
  const exerciseDatabase: Record<string, string[]> = {
    'חזה': ['לחיצת חזה בנטילות', 'פרפר במכשיר', 'לחיצת חזה עליון', 'כפיפת מרפקים בשכיבה', 'קרוסאובר'],
    'גב': ['חתירה בפולי עליון', 'חתירה בפולי תחתון', 'משיכת יד בפולי', 'לחיצת גב לט', 'דדליפט'],
    'כתפיים': ['לחיצת כתפיים עם משקולות', 'הרמת ידיים צידה', 'הרמת ידיים קדימה', 'פרפר כתפיים'],
    'רגליים': ['סקווט', 'לחיצת רגליים', 'כפיפת ברך במכשיר', 'פשיטת רגל במכשיר', 'סרבן'],
    'ביצפס': ['כפיפת מרפקים עם משקולת', 'כפיפת מרפקים בפולי', 'כפיפת מרפקים עם מוט Z', 'פטיש'],
    'טריצפס': ['פשיטת מרפקים בפולי', 'פשיטת מרפקים עם משקולת', 'דיפ', 'פשיטת מרפקים בשכיבה'],
    'אמות': ['כפיפת שורש כף יד', 'פשיטת שורש כף יד', 'סיבוב אמה'],
    'בטן': ['כפיפת בטן', 'שכיבות סירה', 'פלאנק', 'כפיפת בטן עם סיבוב', 'הרמת רגליים'],
  };

  const available = exerciseDatabase[muscleGroup] || [];
  const notAlreadyDoing = available.filter(e => !currentExercises.includes(e));
  return notAlreadyDoing.slice(0, 3);
}

export async function generateWorkoutSummary(
  session: WorkoutSession
): Promise<string> {
  const exercises = session.exercises || [];
  const totalVolume = exercises.reduce((sum, ex) => {
    return sum + ex.sets.reduce((s, set) => s + (set.isWarmup ? 0 : set.weight * set.reps), 0);
  }, 0);

  const completedSets = exercises.reduce((sum, ex) =>
    sum + ex.sets.filter(s => s.isCompleted && !s.isWarmup).length, 0
  );

  const totalSets = exercises.reduce((sum, ex) =>
    sum + ex.sets.filter(s => !s.isWarmup).length, 0
  );

  const durationMin = Math.round((session.duration || 0) / 60);

  const exerciseSummary = exercises.map(ex => {
    const vol = ex.sets.filter(s => !s.isWarmup).reduce((s, set) => s + set.weight * set.reps, 0);
    return `${ex.exerciseName}: ${vol.toLocaleString()} ק"ג נפח`;
  }).join('\n');

  return `סיכום אימון - ${session.date || 'היום'}

⏱️ משך: ${durationMin} דקות
📊 נפח כולל: ${totalVolume.toLocaleString()} ק"ג
✅ סטים: ${completedSets}/${totalSets}

פירוט לפי תרגיל:
${exerciseSummary}`;
}

export async function getFormTips(exerciseName: string): Promise<string[]> {
  const tipsDatabase: Record<string, string[]> = {
    'סקווט': ['שמור על הגב ישר', 'הברכיים לא עוברות את קצות האצבעות', 'רד עד שהירך מקבילה לרצפה'],
    'לחיצת חזה': ['הורד את המוט עד שנוגע בחזה', 'שמור על השכמות מכווצות', 'רגליים יציבות על הרצפה'],
    'דדליפט': ['שמור על המוט קרוב לגוף', 'גב ישר לאורך כל התנועה', 'דחוף דרך העקבים'],
    'חתירה': ['משוך אל הבטן התחתונה', 'שמור על הגב ישר', 'סחוץ את השכמות בנקודה העליונה'],
    'לחיצת כתפיים': ['אל תיקח את המשקל מאחורי הצוואר', 'שמור על הליבה יציבה', 'חיבור מלא בכל חזרה'],
  };

  for (const [key, tips] of Object.entries(tipsDatabase)) {
    if (exerciseName.includes(key) || key.includes(exerciseName)) {
      return tips;
    }
  }

  return ['שמור על טכניקה נכונה לאורך כל התנועה', 'נשום נכון: נשיפה במאמץ, שאיפה בחזרה', 'התחל עם משקל קל והעלה בהדרגה'];
}

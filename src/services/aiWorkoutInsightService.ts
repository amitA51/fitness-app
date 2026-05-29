import type { WorkoutSession } from '../types';
import { buildContext, buildSystemPrompt } from './ai/contextBuilder';
import { type ChatMessage, getAIProvider } from './ai/core';

/** Sanitize user-derived text before embedding in prompts. */
function sanitizeForPrompt(input: string, maxLength = 60): string {
  return input
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^\p{L}\p{N}\p{Zs}\-_'"()]/gu, '')
    .slice(0, maxLength)
    .trim();
}

export async function generateAIWorkoutInsight(sessions: WorkoutSession[]): Promise<string> {
  if (sessions.length === 0) {
    return 'אין עדיין נתוני אימון. התחל להתאמן כדי לקבל תובנות מותאמות אישית!';
  }

  const context = buildContext(sessions);
  const provider = getAIProvider();

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    {
      role: 'user',
      content: `נתח את האימונים שלי מהתקופה האחרונה ותן תובנה קצרה אחת ומעשית. נתונים:
- מגמת נפח: ${context.volumeTrend}
- נפח שבועי: ${context.weeklyVolume} ק"ג
- שינוי נפח שבועי: ${context.volumeChangePercent}%
- ציון מוכנות מתמטי: ${context.readinessScore}/100
- מגבלה מרכזית: ${context.primaryConstraint}
- שרירים חלשים: ${context.weakMuscles.map(sanitizeForPrompt).join(', ') || 'אין'}
- רצף: ${context.streakDays} ימים`,
    },
  ];

  try {
    return await provider.chat(messages);
  } catch {
    return 'לא הצלחתי להפיק תובנה כרגע. בדוק את החיבור לאינטרנט ונסה שוב בעוד רגע.';
  }
}

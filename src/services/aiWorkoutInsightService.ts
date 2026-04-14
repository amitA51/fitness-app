import type { WorkoutSession } from '../types';
import { getAIProvider, type ChatMessage } from './ai/core';
import { buildContext, buildSystemPrompt } from './ai/contextBuilder';

export async function generateAIWorkoutInsight(
  sessions: WorkoutSession[]
): Promise<string> {
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
- שרירים חלשים: ${context.weakMuscles.join(', ') || 'אין'}
- רצף: ${context.streakDays} ימים`,
    },
  ];

  return provider.chat(messages);
}

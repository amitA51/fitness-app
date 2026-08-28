import type { WorkoutSession } from '../types';
import { toLocalDateStr, todayStr } from '../utils/dateUtils';
import { buildContext, buildSystemPrompt } from './ai/contextBuilder';
import { type ChatMessage, getAIProvider } from './ai/core';
import { type RecoveryLog, getRecoveryLogsByDateRange } from './bodyStatsService';

/** Sanitize user-derived text before embedding in prompts. */
function sanitizeForPrompt(input: string, maxLength = 60): string {
  return input
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[^\p{L}\p{N}\p{Zs}\-_'"()]/gu, '')
    .slice(0, maxLength)
    .trim();
}

/** Window of recovery logs the load engine can use (it reads the most recent). */
const RECOVERY_WINDOW_DAYS = 7;

/**
 * Load the recent recovery logs when the caller does not hold them. Without this
 * the context was built with recoveryLogs defaulting to [], so calculateTrainingLoad
 * fell back to its default recovery penalty and the prompt reported "no recovery
 * log" — and hedged its readiness figure — even for a user who had just logged one.
 * A read failure degrades to [] (the previous behaviour), never to a thrown insight.
 */
async function loadRecentRecoveryLogs(): Promise<RecoveryLog[]> {
  try {
    return await getRecoveryLogsByDateRange(
      toLocalDateStr(new Date(Date.now() - RECOVERY_WINDOW_DAYS * 86400000)),
      todayStr()
    );
  } catch {
    return [];
  }
}

export async function generateAIWorkoutInsight(
  sessions: WorkoutSession[],
  /** Pass the already-loaded logs when the caller has them; otherwise they are fetched. */
  recoveryLogs?: RecoveryLog[]
): Promise<string> {
  if (sessions.length === 0) {
    return 'אין עדיין נתוני אימון. התחל להתאמן כדי לקבל תובנות מותאמות אישית!';
  }

  const logs = recoveryLogs ?? (await loadRecentRecoveryLogs());
  const context = buildContext(sessions, logs);
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

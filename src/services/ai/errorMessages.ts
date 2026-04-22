// ============================================================================
// ממפה AIError להודעה קצרה בעברית שמתאימה להצגה למשתמש
// ============================================================================

import { AIError, type AIErrorCode } from './core';

const MESSAGES: Record<AIErrorCode, string> = {
  config_error: 'ה-AI לא מוגדר עדיין. יוצגו טיפים מקומיים.',
  auth_error: 'מפתח ה-API לא תקף. פנה למנהל האפליקציה.',
  rate_limit: 'יותר מדי בקשות. נסה שוב עוד דקה.',
  network_error: 'אין חיבור לאינטרנט. יוצגו טיפים מקומיים.',
  timeout: 'הבקשה ארכה יותר מדי. נסה שוב.',
  provider_down: 'שירות ה-AI לא זמין כרגע. נסה שוב מאוחר יותר.',
  bad_response: 'תשובה לא צפויה מהשרת. נסה שוב.',
  unknown: 'שגיאה לא ידועה. נסה שוב.',
};

export function humanizeAIError(err: unknown): string {
  if (err instanceof AIError) {
    return MESSAGES[err.code] ?? MESSAGES.unknown;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('network')) {
      return MESSAGES.network_error;
    }
    if (msg.includes('timeout') || msg.includes('aborted')) {
      return MESSAGES.timeout;
    }
  }
  return MESSAGES.unknown;
}

// ============================================================================
// AI Error Messages — maps AIError codes to user-facing Hebrew strings
// ============================================================================
// Documented in docs/AI_INTEGRATION.md but previously missing from the source.
// UI catch blocks call humanizeAIError(err) instead of parsing err.message.

import { AIError, type AIErrorCode } from './core';

const MESSAGES: Record<AIErrorCode, string> = {
  config_error: 'שירות ה-AI לא מוגדר. נסה שוב מאוחר יותר.',
  auth_error: 'בעיית הרשאה בשירות ה-AI. נסה שוב מאוחר יותר.',
  rate_limit: 'יותר מדי בקשות. המתן רגע ונסה שוב.',
  network_error: 'אין חיבור לאינטרנט. בדוק את החיבור ונסה שוב.',
  timeout: 'הבקשה ארכה זמן רב מדי. נסה שוב.',
  provider_down: 'שירות ה-AI אינו זמין כרגע. נסה שוב בעוד רגע.',
  bad_response: 'התקבלה תשובה לא תקינה. נסה שוב.',
  unknown: 'משהו השתבש. נסה שוב.',
};

/** Convert any thrown value into a friendly Hebrew message. */
export function humanizeAIError(error: unknown): string {
  if (error instanceof AIError) {
    return MESSAGES[error.code] ?? MESSAGES.unknown;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch')) return MESSAGES.network_error;
    if (msg.includes('timeout') || msg.includes('aborted')) return MESSAGES.timeout;
  }
  return MESSAGES.unknown;
}

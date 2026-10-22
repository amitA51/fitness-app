// ============================================================================
// AI Error Messages — maps AIError codes to user-facing Hebrew strings
// ============================================================================
// Documented in docs/AI_INTEGRATION.md but previously missing from the source.
// UI catch blocks call humanizeAIError(err) instead of parsing err.message.

import { AIError, type AIErrorCode } from './core';

const MESSAGES: Record<AIErrorCode, string> = {
  config_error: 'שירות ה-AI לא מוגדר. נסו שוב מאוחר יותר.',
  auth_error: 'בעיית הרשאה בשירות ה-AI. נסו שוב מאוחר יותר.',
  rate_limit: 'יותר מדי בקשות. חכו רגע ונסו שוב.',
  network_error: 'אין חיבור לאינטרנט. בדקו את החיבור ונסו שוב.',
  timeout: 'הבקשה ארכה זמן רב מדי. נסו שוב.',
  provider_down: 'שירות ה-AI אינו זמין כרגע. נסו שוב בעוד רגע.',
  bad_response: 'התקבלה תשובה לא תקינה. נסו שוב.',
  unknown: 'משהו השתבש. נסו שוב.',
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

/**
 * Error Reporting Utility
 * Provides consistent error handling across the app
 */

import { logger } from './logger';

export interface ErrorReport {
  message: string;
  context: string;
  error?: unknown;
  userMessage?: string;
}

/**
 * Report an error consistently
 * - Logs to console/logger
 * - Can be extended to send to error tracking service (e.g., Sentry)
 */
export function reportError({ message, context, error, userMessage }: ErrorReport): void {
  if (error) {
    logger.app.error(`[${context}] ${message}`, error);
  } else {
    logger.app.error(`[${context}] ${message}`);
  }
}

/**
 * Handle an error with optional user feedback
 * Returns a user-friendly message for display
 */
export function handleError(
  error: unknown,
  context: string,
  fallbackMessage = 'אירעה שגיאה בלתי צפויה'
): { userMessage: string; error: Error } {
  const errorObj = error instanceof Error ? error : new Error(String(error));
  reportError({
    message: errorObj.message,
    context,
    error: errorObj,
  });
  return {
    userMessage: userMessage || fallbackMessage,
    error: errorObj,
  };
}

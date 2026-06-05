/**
 * Error Reporter Service
 *
 * Wraps Sentry.captureException with structured tags so service-layer errors
 * are reported with context (service name, action, sync state).
 * Designed to be reusable in React Native (swap Sentry SDK import).
 */

import * as Sentry from '@sentry/react';

export interface ErrorContext {
  service: string;
  action: string;
  syncState?: 'online' | 'offline' | 'retrying';
  extra?: Record<string, unknown>;
}

/**
 * Report an error to Sentry with structured tags.
 */
export function reportError(error: unknown, ctx: ErrorContext): void {
  try {
    Sentry.captureException(error, {
      tags: {
        service: ctx.service,
        action: ctx.action,
        ...(ctx.syncState && { syncState: ctx.syncState }),
      },
      extra: ctx.extra,
    });
  } catch (reportingError) {
    // Sentry failed (not initialized, transport error, …). Never let the
    // original error vanish entirely — fall back to console so it stays
    // visible in logs. console.error is deliberate here: the dedicated logger
    // also routes through Sentry, which is exactly what just failed.
    console.error('reportError: failed to report to Sentry', { error, reportingError });
  }
}

/**
 * Logger Utility for SparkOS Fitness App
 * Provides structured logging with level support and environment-based output
 */

import * as Sentry from '@sentry/react';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  context: string;
  message: string;
  data?: unknown;
}

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
} as const satisfies Record<LogLevel, number>;

// Vite injects import.meta.env.DEV (true in dev/test, false in prod builds).
// The rest of the app keys off this flag, so the logger must too — the old
// window.__DEV__ lookup was never populated, leaving debug/info silenced.
const isDev = import.meta.env.DEV;

const currentLevel = (): LogLevel => (isDev ? 'debug' : 'warn');

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel()];
};

const formatMessage = (context: string, message: string): string => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${context}] ${message}`;
};

const createLogger = (context: string) => {
  const log = (level: LogLevel, message: string, data?: unknown) => {
    if (!shouldLog(level)) return;

    const formattedMessage = formatMessage(context, message);

    switch (level) {
      case 'debug':
        console.debug(formattedMessage, data ?? '');
        break;
      case 'info':
        console.info(formattedMessage, data ?? '');
        break;
      case 'warn':
        console.warn(formattedMessage, data ?? '');
        break;
      case 'error':
        // In production, route errors to Sentry only — keep the console clean.
        // In dev there is no Sentry, so surface the error on the console instead.
        if (isDev) {
          console.error(formattedMessage, data ?? '');
        }
        try {
          const error = data instanceof Error ? data : new Error(`${context}: ${message}`);
          Sentry.captureException(error, {
            level: 'error',
            extra: {
              context,
              message,
            },
          });
        } catch {
          // Sentry not initialized
        }
        break;
    }
  };

  return {
    debug: (message: string, data?: unknown) => log('debug', message, data),
    info: (message: string, data?: unknown) => log('info', message, data),
    warn: (message: string, data?: unknown) => log('warn', message, data),
    error: (message: string, data?: unknown) => log('error', message, data),
  };
};

export const createAppLogger = (context: string) => createLogger(context);

// Pre-configured loggers for common modules
export const logger = {
  app: createAppLogger('App'),
  workout: createAppLogger('Workout'),
  db: createAppLogger('DB'),
  sync: createAppLogger('Sync'),
  auth: createAppLogger('Auth'),
  analytics: createAppLogger('Analytics'),
  ai: createAppLogger('AI'),
  ui: createAppLogger('UI'),
};

export type { LogLevel, LogEntry };

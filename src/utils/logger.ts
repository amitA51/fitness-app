/**
 * Logger Utility for SparkOS Fitness App
 * Provides structured logging with level support and environment-based output
 */

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

const currentLevel = (): LogLevel => {
  if (typeof window !== 'undefined') {
    const env = (window as { __DEV__?: boolean }).__DEV__;
    if (env === false || env === undefined) return 'warn';
    if (env === true) return 'debug';
  }
  return 'warn';
};

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel()];
};

const formatMessage = (context: string, message: string, data?: unknown): string => {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${context}]`;
  return data ? `${prefix} ${message}` : `${prefix} ${message}`;
};

const createLogger = (context: string) => {
  const log = (level: LogLevel, message: string, data?: unknown) => {
    if (!shouldLog(level)) return;

    const formattedMessage = formatMessage(context, message, data);

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
        console.error(formattedMessage, data ?? '');
        break;
    }

    // In production, could send to error tracking service
    if (level === 'error' && typeof window !== 'undefined') {
      // TODO: Send to error tracking (e.g., Sentry) in production
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

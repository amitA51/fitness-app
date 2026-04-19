/**
 * Safe JSON parsing utilities.
 * Never throws — callers receive a typed fallback or `undefined`.
 */

import { logger } from './logger';

export function safeJsonParse<T = unknown>(raw: string | null | undefined): T | undefined {
  if (raw == null || raw === '') return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.app.warn('JSON parse failed', { error, preview: raw.slice(0, 80) });
    return undefined;
  }
}

export function safeJsonParseOr<T>(raw: string | null | undefined, fallback: T): T {
  const parsed = safeJsonParse<T>(raw);
  return parsed === undefined ? fallback : parsed;
}

export function readJsonStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    return safeJsonParseOr<T>(window.localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

export function writeJsonStorage(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.app.warn('localStorage write failed', { key, error });
    return false;
  }
}

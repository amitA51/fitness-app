/**
 * Supabase Client Configuration
 * SPARKOS Fitness App - Cloud Sync
 */

import { type SupabaseClient as SupabaseClientType, createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * A real project URL is an absolute `https:` URL (`https://<ref>.supabase.co`).
 *
 * Placeholder text in a committed `.env` (`your-supabase-url-here`) is a non-empty
 * string, so the previous `Boolean(url && key)` test accepted it: a client was built
 * against a host that is not a Supabase project and every sync call failed. The URL
 * parser rejects it — no network call, no length heuristics.
 */
const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

/**
 * The anon key is a JWT (JWS compact serialisation): three non-empty dot-separated
 * segments. Shape only — signature and contents are the server's business.
 */
const isJwtShaped = (value: string): boolean => {
  const segments = value.split('.');
  return segments.length === 3 && segments.every((segment) => segment.length > 0);
};

// Names only — a malformed value is still a secret and never reaches the log.
const malformedVars: string[] = [];
if (supabaseUrl && !isHttpsUrl(supabaseUrl)) {
  malformedVars.push('VITE_SUPABASE_URL');
}
if (supabaseAnonKey && !isJwtShaped(supabaseAnonKey)) {
  malformedVars.push('VITE_SUPABASE_ANON_KEY');
}

// Supabase configuration is optional — when missing OR malformed, the app runs in
// local-only mode. Fail closed: this app is offline-first, so no cloud is a designed
// state, while a client pointed at a bogus host is a stream of silent sync failures.
// Never throw here — a module-scope throw would turn a config typo into a blank boot.
const isConfigured = Boolean(supabaseUrl && supabaseAnonKey) && malformedVars.length === 0;

if (malformedVars.length > 0) {
  logger.sync.warn(
    `Supabase config ignored, running in local-only mode. Malformed (value not shown): ${malformedVars.join(', ')}`
  );
}

/**
 * Wrap fetch so every response teaches us the server's clock.
 *
 * Sync correctness depends on client-generated `updated_at` values, and the server
 * guard silently DISCARDS a write whose timestamp looks stale — no error, no log,
 * and the next pull then overwrites the local row with the older cloud copy. A
 * device whose clock is a few minutes slow therefore loses edits invisibly.
 *
 * Every HTTP response already carries a `Date` header, so the offset is measured
 * for free here instead of costing an extra round-trip. `observeServerDate` is
 * cheap, never throws, and ignores skew below its tolerance so a healthy device is
 * unaffected. See ../services/serverClock.
 */
const clockObservingFetch: typeof fetch = async (input, init) => {
  const startedAt = Date.now();
  const response = await fetch(input, init);
  try {
    const { observeServerDate } = await import('../services/serverClock');
    observeServerDate(response.headers.get('date'), startedAt);
  } catch {
    // Clock measurement is an optimisation for correctness, never a hard
    // dependency: a failure here must not break the request itself.
  }
  return response;
};

export const supabase = isConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      global: { fetch: clockObservingFetch },
    })
  : null;

export const isSupabaseConfigured = (): boolean => isConfigured;

export type SupabaseClient = SupabaseClientType;

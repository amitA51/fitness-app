/**
 * Supabase Client Configuration
 * SPARKOS Fitness App - Cloud Sync
 */

import { type SupabaseClient as SupabaseClientType, createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Supabase configuration is optional — when missing, the app runs in local-only mode.

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

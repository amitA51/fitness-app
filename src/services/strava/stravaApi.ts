// ============================================================================
// Strava — calls to the `strava` edge function
// ============================================================================
// The app never talks to strava.com and never holds a Strava token: every call
// goes through the edge function, which answers with trimmed activities.

import { supabase } from '../../lib/supabase';
import type { StravaActivityDetail, StravaActivitySummary } from './stravaMapping';

export type StravaCallError =
  | 'not_configured'
  | 'offline'
  | 'unauthenticated'
  | 'rate_limited'
  | 'strava_rate_limited'
  | 'invalid'
  | 'expired'
  | 'denied'
  | 'scope'
  | 'failed';

export type StravaResult<T> = ({ ok: true } & T) | { ok: false; error: StravaCallError };

const KNOWN_ERRORS: readonly StravaCallError[] = [
  'not_configured',
  'unauthenticated',
  'rate_limited',
  'strava_rate_limited',
  'invalid',
  'expired',
  'denied',
  'scope',
];

async function call<T>(body: Record<string, unknown>): Promise<StravaResult<T>> {
  if (!supabase) return { ok: false, error: 'not_configured' };
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { ok: false, error: 'offline' };
  }
  const { data, error } = await supabase.functions.invoke('strava', { body });
  const res = (data ?? null) as ({ ok?: boolean; error?: string } & T) | null;
  if (error || !res) {
    // A non-2xx answer still carries the function's JSON error code.
    const context = (error as { context?: Response } | null)?.context;
    const code = await context
      ?.json()
      .then((b: { error?: unknown }) => b?.error)
      .catch(() => undefined);
    const known = KNOWN_ERRORS.find((k) => k === code);
    if (known) return { ok: false, error: known };
    if (context?.status === 401) return { ok: false, error: 'unauthenticated' };
    if (context?.status === 429) return { ok: false, error: 'rate_limited' };
    if (context?.status === 503) return { ok: false, error: 'not_configured' };
    return { ok: false, error: 'failed' };
  }
  if (!res.ok) {
    const known = KNOWN_ERRORS.find((k) => k === res.error);
    return { ok: false, error: known ?? 'failed' };
  }
  return { ...res, ok: true };
}

/** The Strava page to send the user to. `mobile` opens the Strava app when installed. */
export const startStravaConnect = (redirectUri: string, mobile: boolean) =>
  call<{ url: string }>({ action: 'start', redirectUri, mobile });

/** Finish a connect from the redirect page — no user session needed. */
export const finishStravaConnect = (code: string, state: string, scope: string) =>
  call<{ athleteName: string | null }>({ action: 'exchange', code, state, scope });

export interface StravaStatus {
  connected: boolean;
  athleteName: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
}

export const fetchStravaStatus = () => call<StravaStatus>({ action: 'status' });

export interface StravaSyncPage {
  connected: boolean;
  activities?: StravaActivitySummary[];
  hasMore?: boolean;
  newestEpoch?: number;
  rateLimited?: boolean;
}

/** Activities that started after the saved cursor, oldest first. */
export const fetchNewStravaActivities = () => call<StravaSyncPage>({ action: 'sync' });

/** Move the cursor past what the app has saved, and hand back every id it was given. */
export const ackStravaActivities = (cursorEpoch: number, ids: number[]) =>
  call<Record<string, never>>({ action: 'ack', cursorEpoch, ids });

export interface StravaDetailsPage {
  connected: boolean;
  details?: StravaActivityDetail[];
  rateLimited?: boolean;
}

/** Calories and km splits of up to 30 activities. */
export const fetchStravaDetails = (ids: number[]) =>
  call<StravaDetailsPage>({ action: 'details', ids });

export const disconnectStrava = () => call<Record<string, never>>({ action: 'disconnect' });

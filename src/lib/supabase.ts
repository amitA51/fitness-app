/**
 * Supabase Client Configuration
 * SPARKOS Fitness App - Cloud Sync
 */

import {
  type Session,
  type SupabaseClient as SupabaseClientType,
  createClient,
} from '@supabase/supabase-js';
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
 * How long a request may wait for the server to start answering before it fails.
 *
 * fetch has no timeout of its own. When the database is overloaded the server
 * holds a request for minutes, so a login button spun forever and a sync froze.
 * Failing after a bounded wait hands the caller an error it can show and retry.
 * Only the wait for the response headers is capped: once they arrive the body
 * may take as long as it needs, so the AI coach's streamed answers are safe.
 */
export const REQUEST_TIMEOUT_MS = {
  /**
   * On an overloaded night a password login was measured answering in 29 s —
   * slow, but it worked. Cutting it at 15 s turned a working login into an
   * error and a retry; healthy logins answer in under a second anyway.
   */
  auth: 30_000,
  /**
   * The token refresh is the one call that must not be cut short: the server
   * may already have rotated the token, and retrying with the old one outside
   * Supabase's 10 s reuse window ends the session.
   */
  refresh: 60_000,
  /** Reads: nothing changes on the server, so failing early costs nothing. */
  rest: 25_000,
  /**
   * Writes (a 50-workout import batch, an upsert) get longer: one cut off after
   * the server committed it is simply sent again, but each extra round on an
   * overloaded server adds to its load.
   */
  restWrite: 60_000,
  /** Edge functions do real work first: the AI coach, a Strava import page. */
  functions: 60_000,
} as const;

/** null = no cap: storage uploads are as slow as the photo is big. */
export function requestTimeoutFor(url: string, method = 'GET'): number | null {
  if (isRefreshTokenRequest(url)) return REQUEST_TIMEOUT_MS.refresh;
  if (url.includes('/auth/v1/')) return REQUEST_TIMEOUT_MS.auth;
  if (url.includes('/rest/v1/')) {
    const isRead = method.toUpperCase() === 'GET' || method.toUpperCase() === 'HEAD';
    return isRead ? REQUEST_TIMEOUT_MS.rest : REQUEST_TIMEOUT_MS.restWrite;
  }
  if (url.includes('/functions/v1/')) return REQUEST_TIMEOUT_MS.functions;
  return null;
}

const urlOf = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

const methodOf = (input: RequestInfo | URL, init?: RequestInit): string =>
  init?.method ?? (input instanceof Request ? input.method : 'GET');

export const timedFetch: typeof fetch = async (input, init) => {
  const limit = requestTimeoutFor(urlOf(input), methodOf(input, init));
  if (limit === null) return fetch(input, init);

  const controller = new AbortController();
  const outer = init?.signal;
  // The caller's own abort (a "stop" button) still cancels the request, the
  // body included, so this link is never removed.
  if (outer?.aborted) controller.abort(outer.reason);
  else outer?.addEventListener('abort', () => controller.abort(outer.reason), { once: true });
  const timer = setTimeout(
    () => controller.abort(new DOMException('The server did not answer in time', 'TimeoutError')),
    limit
  );
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

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
  const response = await timedFetch(input, init);
  try {
    const { observeServerDate } = await import('../services/serverClock');
    observeServerDate(response.headers.get('date'), startedAt);
  } catch {
    // Clock measurement is an optimisation for correctness, never a hard
    // dependency: a failure here must not break the request itself.
  }
  return response;
};

function isRefreshTokenRequest(url: string): boolean {
  return url.includes('/auth/v1/token') && url.includes('grant_type=refresh_token');
}

/**
 * supabase-js sends the ANON key in place of the user's token whenever
 * `getSession()` comes back empty — and that is exactly what a failed token
 * refresh looks like while the session is still stored. Such a request runs as
 * "nobody": the consent RPC answers "everything still needs accepting", the age
 * table returns no row, a write is refused. Cached as real answers, those walled
 * a verified user off until a restart. So while a session is stored, a database
 * or function call that would leave as anon fails here like a network error, and
 * every caller treats the server as unreachable and falls back to what it knows.
 */
const isAnonCallWhileSignedIn = (input: RequestInfo | URL, init?: RequestInit): boolean => {
  const url = urlOf(input);
  if (!url.includes('/rest/v1/') && !url.includes('/functions/v1/')) return false;
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
  return (
    headers.get('authorization') === `Bearer ${supabaseAnonKey}` && readStoredAuthSession() !== null
  );
};

/**
 * A refresh answer that says nothing about the token itself: the server, or
 * something in front of it, failed. The auth server words every real rejection
 * in JSON, so an HTML page (a proxy, a firewall challenge) is never its verdict.
 */
const isServerSideRefreshFailure = (response: Response): boolean => {
  if (response.ok) return false;
  if (response.status >= 500 || response.status === 429 || response.status === 408) return true;
  return !(response.headers.get('content-type') ?? '').includes('json');
};

/**
 * After such a failure auth-js retries the refresh about eight times in 30 s,
 * then again on every 30 s tick — load aimed at a server that is already
 * failing. For a short while after one, refresh attempts fail here without
 * being sent (honouring Retry-After when the server gives one).
 */
const REFRESH_BACKOFF_MS = { min: 5_000, fallback: 10_000, max: 60_000 } as const;
let refreshBlockedUntil = 0;

const refreshBackoffFor = (response: Response): number => {
  const seconds = Number(response.headers.get('retry-after') ?? Number.NaN);
  const wanted = Number.isFinite(seconds) ? seconds * 1000 : REFRESH_BACKOFF_MS.fallback;
  return Math.min(Math.max(wanted, REFRESH_BACKOFF_MS.min), REFRESH_BACKOFF_MS.max);
};

/**
 * The fetch the Supabase client uses: timed, clock-observing, and session-keeping.
 *
 * auth-js deletes the stored session — signing the user out — when the token
 * refresh fails with anything it does not consider a network error. It treats
 * only a thrown fetch and 502/503/504/52x as network errors (auth-js
 * lib/fetch.js), so a 500 or a 429 from an overloaded server logged people out
 * although their refresh token was perfectly valid. For the refresh call only,
 * such an answer is turned into a thrown error: auth-js then reports it as
 * retryable, keeps the session, and its auto-refresh tries again later. A real
 * rejection of the token (a JSON 400: invalid_grant, refresh_token_not_found)
 * still passes through and signs out as it should.
 */
export const supabaseFetch: typeof fetch = async (input, init) => {
  if (isAnonCallWhileSignedIn(input, init)) {
    throw new TypeError('The session could not be refreshed; not sending this request as a guest');
  }
  const isRefresh = isRefreshTokenRequest(urlOf(input));
  if (isRefresh && Date.now() < refreshBlockedUntil) {
    throw new TypeError('Token refresh is backing off after a server failure; keeping the session');
  }
  const response = await clockObservingFetch(input, init);
  if (isRefresh && isServerSideRefreshFailure(response)) {
    refreshBlockedUntil = Date.now() + refreshBackoffFor(response);
    throw new TypeError(`Token refresh answered HTTP ${response.status}; keeping the session`);
  }
  return response;
};

/**
 * Where the SDK keeps the session in localStorage. Passed to the client
 * explicitly (it is the SDK's own default, `sb-<project ref>-auth-token`) so
 * the readers below can never drift from where the SDK actually writes.
 */
const authStorageKey = (() => {
  if (!isConfigured) return null;
  try {
    return `sb-${new URL(supabaseUrl!).hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
})();

export const supabase = isConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        ...(authStorageKey ? { storageKey: authStorageKey } : {}),
      },
      global: { fetch: supabaseFetch },
    })
  : null;

export const isSupabaseConfigured = (): boolean => isConfigured;

/**
 * Call an edge function as nobody, on purpose — for the few actions built to
 * run without a session (the Strava sign-in return, which lands in a browser
 * that may hold a stale session). The client would attach a user token when it
 * has one, and the guard in supabaseFetch refuses an anon call while a session
 * is stored; this goes around both, still with the request timeout.
 */
export async function invokePublicFunction<T>(
  name: string,
  body: unknown
): Promise<{ status: number; data: T | null }> {
  if (!isConfigured) return { status: 0, data: null };
  const response = await timedFetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey!,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => null)) as T | null;
  return { status: response.status, data };
}

/**
 * A second, throwaway auth client for the native apps' Google sign-in. It runs
 * the PKCE flow: the system browser hands the app back only a one-time code,
 * which is worthless without the verifier this client keeps in memory — so a
 * forged or intercepted `com.sparkos.fitness://` link cannot sign anyone in.
 * It never stores a session; the main client receives the tokens it exchanges.
 */
export const createPkceAuthClient = () =>
  isConfigured
    ? createClient(supabaseUrl!, supabaseAnonKey!, {
        auth: {
          flowType: 'pkce',
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: 'sb-native-oauth',
        },
        global: { fetch: timedFetch },
      })
    : null;

/**
 * The session as stored on this device, read synchronously and without the
 * network. `auth.getSession()` cannot answer until the SDK has finished its
 * start-up token refresh, which waits on the server; this lets the app paint
 * the signed-in user at once. The access token may be expired — callers use it
 * for WHO is signed in, never as a credential. Null when nothing usable is stored.
 */
export const readStoredAuthSession = (): Session | null => {
  if (!authStorageKey) return null;
  try {
    const raw = localStorage.getItem(authStorageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const candidate = parsed as Partial<Session>;
    // Same shape test the SDK applies (GoTrueClient._isValidSession), plus a user.
    if (
      typeof candidate.access_token !== 'string' ||
      typeof candidate.refresh_token !== 'string' ||
      !('expires_at' in candidate) ||
      typeof candidate.user?.id !== 'string'
    ) {
      return null;
    }
    return candidate as Session;
  } catch {
    return null;
  }
};

/**
 * True when this page load carries a sign-in callback the SDK is about to
 * exchange with the server — a Google return, a magic or recovery link. The
 * same test auth-js applies (GoTrueClient._isImplicitGrantCallback /
 * _isPKCECallback), so the app can wait for THAT session instead of painting
 * whichever one happens to be stored.
 */
export const hasPendingAuthCallback = (): boolean => {
  if (!authStorageKey || typeof window === 'undefined') return false;
  try {
    const { search, hash } = window.location;
    const params = new URLSearchParams(search);
    for (const [key, value] of new URLSearchParams(hash.replace(/^#/, ''))) params.set(key, value);
    if (params.get('access_token') || params.get('error_description') || params.get('error_code')) {
      return true;
    }
    return Boolean(params.get('code') && localStorage.getItem(`${authStorageKey}-code-verifier`));
  } catch {
    return false;
  }
};

/**
 * Remove the stored session without asking the server. Sign-out uses this when
 * `auth.signOut()` fails or hangs: auth-js keeps the session on a 5xx or a
 * timeout, so without it "התנתקות" would leave the user signed in.
 */
export const clearStoredAuthSession = (): void => {
  if (!authStorageKey) return;
  for (const suffix of ['', '-code-verifier', '-user']) {
    try {
      localStorage.removeItem(`${authStorageKey}${suffix}`);
    } catch {
      // Storage unavailable: nothing was persisted there either.
    }
  }
};

export type SupabaseClient = SupabaseClientType;

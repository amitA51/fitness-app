/**
 * Supabase Authentication Service
 * SPARKOS Fitness App - Auth with Supabase
 */

import type { Session, User } from '@supabase/supabase-js';
import {
  clearStoredAuthSession,
  isSupabaseConfigured,
  readStoredAuthSession,
  supabase,
} from '../lib/supabase';
import { logger } from '../utils/logger';
import { isTimeoutError, withTimeout } from '../utils/withTimeout';
import { getInviteConfirmationRedirectUrl } from './authContinuation';
import {
  type AuthErrorKind,
  SIGN_OUT_STEP_TIMEOUT_MS,
  classifyAuthError,
  isUnreachableAuthError,
  settlesWithin,
} from './authErrors';
import { transitionAuthSession } from './authSessionTransition';

export type AuthCallback = (session: Session | null) => void;
export type AuthUserCallback = (user: User | null) => void;

/**
 * Every server-calling auth action answers in this shape and never throws.
 * `error` is the raw server message, for logs; screens show `errorKind`
 * through `authErrorMessage()` (./authErrors), never `error` itself.
 */
export interface AuthActionResult {
  error: string | null;
  errorKind: AuthErrorKind | null;
}

export interface AuthUserResult extends AuthActionResult {
  user: User | null;
}

const NOT_CONFIGURED: AuthActionResult = {
  error: 'Supabase not configured',
  errorKind: 'unknown',
};

const messageOf = (err: unknown): string => {
  if (err instanceof Error) return err.message;
  if (
    err &&
    typeof err === 'object' &&
    typeof (err as { message?: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message;
  }
  return String(err);
};

/** An error the SDK RETURNED: classify it by its code and status. */
const returnedFailure = (err: unknown): AuthActionResult => ({
  error: messageOf(err),
  errorKind: classifyAuthError(err),
});

/**
 * An error the SDK THREW. auth-js returns every server answer as `{ error }`; a
 * throw means the request itself never completed (lock timeout, network stack),
 * so the honest message is "the server is not reachable, try again".
 */
const thrownFailure = (err: unknown): AuthActionResult => ({
  error: messageOf(err),
  errorKind: 'unreachable',
});

/**
 * No-op kept for backward compatibility with call sites that imported
 * `initSupabaseAuth`. The `AuthProvider` in `src/contexts/AuthContext.tsx`
 * now owns the onAuthStateChange subscription. Calling this is safe but
 * does nothing — new code should use `useAuth()` instead.
 */
export const initSupabaseAuth = (): void => {
  if (!isSupabaseConfigured() || !supabase) {
    logger.auth.info('Supabase not configured - auth disabled');
    return;
  }
};

/**
 * Detect Supabase auth errors that indicate an expired or otherwise invalid
 * session. We match on:
 *   - HTTP 401 status
 *   - error.code === 'session_not_found' or 'invalid_token' / 'token_expired'
 *   - message containing "token", "expired", "invalid JWT", or "JWT"
 * When true, the cached session is stale and the caller should be logged out.
 */
const isSessionExpiredError = (err: unknown): boolean => {
  if (!err || typeof err !== 'object') return false;
  // A server that did not answer says nothing about the session. Treating it as
  // expiry signed people out every time the database was overloaded.
  if (isUnreachableAuthError(err)) return false;
  const e = err as { status?: unknown; code?: unknown; message?: unknown };

  if (typeof e.status === 'number' && e.status === 401) return true;

  if (typeof e.code === 'string') {
    const code = e.code.toLowerCase();
    if (
      code === 'session_not_found' ||
      code === 'invalid_token' ||
      code === 'token_expired' ||
      code.includes('expired')
    ) {
      return true;
    }
  }

  if (typeof e.message === 'string') {
    const msg = e.message.toLowerCase();
    if (
      msg.includes('jwt expired') ||
      msg.includes('invalid jwt') ||
      msg.includes('token expired') ||
      msg.includes('token has expired') ||
      msg.includes('session expired') ||
      msg.includes('session not found') ||
      (msg.includes('token') && msg.includes('expired')) ||
      (msg.includes('token') && msg.includes('invalid'))
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Remove this device's session, bounded in time and certain to take effect.
 *
 * `auth.signOut()` asks the server first and keeps the local session when the
 * server answers 5xx or not at all — so on an overloaded day "התנתקות" did
 * nothing, or hung. `scope: 'local'` ends only this device's session (the
 * server call is a courtesy that revokes its refresh token); when it fails or
 * runs out of time, the stored session is removed directly.
 */
const dropStoredSession = async (context: string): Promise<void> => {
  if (!supabase) return;
  const client = supabase;
  let removedBySdk = false;
  const attempt = Promise.resolve()
    .then(() => client.auth.signOut({ scope: 'local' }))
    .then((result) => {
      if (result?.error) logger.auth.warn(`${context}: server sign-out failed`, result.error);
      else removedBySdk = true;
    })
    .catch((err: unknown) => {
      logger.auth.warn(`${context}: sign-out threw`, err);
    });
  if (!(await settlesWithin(attempt, SIGN_OUT_STEP_TIMEOUT_MS))) {
    logger.auth.warn(`${context}: sign-out did not finish in time; removing the session locally`);
  }
  if (!removedBySdk) clearStoredAuthSession();
};

/**
 * Handle an expired/invalid session: drop the credentials and bounce the user to
 * the login screen, WITHOUT destroying their local data.
 *
 * This function used to call `transitionAuthSession(null, { forceCleanup: true })`,
 * which wipes every user-scoped IndexedDB store, every registered localStorage
 * key, AND the offline mutation queue including its dead-letter recovery store.
 * That was wrong, and it is the exact mechanism that destroyed a real user's
 * six weeks of 12-week-program progress: a single transient "invalid JWT" during
 * a token refresh erased data that had no cloud copy.
 *
 * The reasoning behind the change:
 *
 *   • A wipe on IDENTITY CHANGE is genuinely necessary — user B must never see
 *     user A's records. `transitionAuthSession` still does exactly that, keyed on
 *     the stored owner marker, and it is untouched.
 *   • A wipe on EXPIRY protects nothing. An expired token proves only that the
 *     credential aged out; it says nothing about who will authenticate next. The
 *     overwhelmingly common case is the SAME person re-logging in — and the
 *     identity check in `transitionAuthSession` will preserve their data, because
 *     the owner marker still matches. If a DIFFERENT user signs in, that same
 *     check fires and wipes then, which is the correct moment.
 *   • Destroying the offline queue here was strictly harmful: those are writes
 *     that have not reached the cloud yet, so the wipe is the one thing that
 *     makes them unrecoverable. Entries are owner-stamped and replay refuses to
 *     apply another account's rows, so retaining them is safe.
 *
 * Net effect: an expired session now costs the user a login, not their data.
 */
const handleExpiredSession = async (err: unknown): Promise<void> => {
  logger.auth.warn('Session expired or invalid — requiring re-authentication', err);

  // Drop the credential only. This clears the Supabase token from storage but
  // does NOT touch our IndexedDB stores, localStorage keys or the queue.
  await dropStoredSession('Expired-session sign-out');

  // The auth listener will see the null session and re-run the identity check,
  // which is where a real account change is detected and cleaned up.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
  }
};

/**
 * After a token refresh fails because the server did not answer, auth-js has
 * already spent up to ~30 s retrying. Every getCurrentUser() caller used to
 * start a fresh cycle of its own (and then a getUser() on top), so an outage
 * became a queue of half-minute stalls across the app. For this long after a
 * failure, callers get an answer straight away and the SDK's own auto-refresh
 * is left to recover.
 *
 * The answer is "no user", deliberately — NOT the stored user. Without a fresh
 * token supabase-js sends the anon key (SupabaseClient._getAccessToken), so a
 * write path handed a user would push as anonymous, get a 401, and file the
 * change as a permanent failure; a pull would read an empty table under RLS
 * and move its cursors past rows it never saw. "No user" makes writes queue
 * and pulls wait, which is what an outage needs. Who is signed in — for the
 * screens — comes from AuthContext, which keeps the stored session painted.
 */
const REFRESH_FAILURE_COOLDOWN_MS = 60_000;
let refreshFailedAt: number | null = null;

/** auth-js refreshes a token this close to expiry before handing it out (EXPIRY_MARGIN_MS). */
const TOKEN_EXPIRY_MARGIN_MS = 90_000;

/** The stored token is one REST calls can use as-is: the refresh has since succeeded. */
const hasUsableStoredToken = (): boolean => {
  const expiresAt = readStoredAuthSession()?.expires_at;
  return typeof expiresAt === 'number' && expiresAt * 1000 - Date.now() > TOKEN_EXPIRY_MARGIN_MS;
};

export const getCurrentUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured() || !supabase) return null;

  if (refreshFailedAt !== null) {
    if (hasUsableStoredToken()) refreshFailedAt = null;
    else if (Date.now() - refreshFailedAt < REFRESH_FAILURE_COOLDOWN_MS) return null;
  }

  // Use getSession() (reads from local storage, no network round-trip) for the
  // hot path. Only fall back to getUser() when the session is missing.
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError && isSessionExpiredError(sessionError)) {
    await handleExpiredSession(sessionError);
    return null;
  }

  if (session?.user) {
    refreshFailedAt = null;
    return session.user;
  }

  // The refresh failed for want of a server, and auth-js kept the stored
  // session. getUser() would only start another doomed round-trip.
  if (sessionError && isUnreachableAuthError(sessionError)) {
    refreshFailedAt = Date.now();
    logger.auth.warn('Session refresh unreachable; answering "no user" for now', sessionError);
    return null;
  }

  // No cached session — attempt a network call as last resort.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error && isSessionExpiredError(error)) {
    await handleExpiredSession(error);
    return null;
  }

  return user;
};

/**
 * `getCurrentUser()` for WRITE PATHS: a rejection is reported as `null`.
 *
 * Every offline-capable write in this app has the same shape — local write,
 * then `const user = await getCurrentUser()`, then either a direct push or
 * `queueMutation` in the `else`. A REJECTION there is the same situation as a
 * null user (auth cannot answer), but a bare `await` turns it into a throw that
 * escapes BEFORE the enqueue, leaving the row in IndexedDB, in no queue and in
 * no ledger — the exact silent-write shape this family keeps reproducing.
 *
 * That conclusion had already been reached three separate times and
 * hand-implemented three different ways (`nutritionService.addFoodFromPreset`,
 * `exerciseDb.pushExerciseMutation`, `offlineQueue.queueMutation`), while
 * thirteen other write paths still had the bare `await`. Divergent copies of one
 * rule are the defect; this is the single copy. Use it at every write-path auth
 * read. Read paths should keep using `getCurrentUser()` directly, where a
 * genuine auth failure must stay visible.
 *
 * Capped at WRITE_PATH_AUTH_TIMEOUT_MS: `getCurrentUser()` can wait on a token
 * refresh against an overloaded server, and every caller awaits this after its
 * local write and before it queues — a meal or a glass of water sat neither
 * pushed nor queued for as long as that took. A timeout answers null, exactly
 * like a failed lookup: every caller then queues, and the queue stamps the
 * owner from the session stored on this device (offlineQueue.resolveQueueOwner).
 * It deliberately does NOT answer with the stored user: without a fresh token a
 * direct push goes out with the anon key and is refused, see
 * REFRESH_FAILURE_COOLDOWN_MS above.
 */
const WRITE_PATH_AUTH_TIMEOUT_MS = 2_000;

export const resolveCurrentUserOrNull = async (): Promise<User | null> => {
  try {
    return await withTimeout(
      getCurrentUser(),
      WRITE_PATH_AUTH_TIMEOUT_MS,
      'write-path auth lookup'
    );
  } catch (err) {
    logger.auth.warn(
      isTimeoutError(err)
        ? 'Auth did not answer in time on a write path — treating it as no user'
        : 'Auth lookup failed on a write path — treating it as no user',
      err
    );
    return null;
  }
};

export const getSession = async (): Promise<Session | null> => {
  if (!isSupabaseConfigured() || !supabase) return null;

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error && isSessionExpiredError(error)) {
    await handleExpiredSession(error);
    return null;
  }

  return session;
};

/**
 * What a sign-up produced. `session` is non-null when the project confirms
 * addresses automatically: the user is signed in already and no email is sent,
 * so the screen must not tell them to go and check their inbox.
 */
export interface SignUpResult extends AuthUserResult {
  session: Session | null;
}

export const signUp = async (
  email: string,
  password: string,
  metadata?: Record<string, unknown>
): Promise<SignUpResult> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { user: null, session: null, ...NOT_CONFIGURED };
  }

  const emailRedirectTo = getInviteConfirmationRedirectUrl();
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
        ...(emailRedirectTo ? { emailRedirectTo } : {}),
      },
    });

    if (error) {
      logger.auth.error('Sign up error', error);
      return { user: null, session: null, ...returnedFailure(error) };
    }

    // A repeat sign-up of an address that is already confirmed "succeeds" with
    // a stand-in user that has no identities, and Supabase sends NO email (it
    // will not reveal which addresses exist). Reporting success here told the
    // user to wait for an email that was never coming.
    const identities = data.user?.identities;
    if (data.user && Array.isArray(identities) && identities.length === 0) {
      return {
        user: null,
        session: null,
        error: 'User already registered',
        errorKind: 'already_registered',
      };
    }

    return { user: data.user, session: data.session ?? null, error: null, errorKind: null };
  } catch (err) {
    logger.auth.error('Sign up threw', err);
    return { user: null, session: null, ...thrownFailure(err) };
  }
};

/**
 * Re-send the sign-up confirmation email for an address that already signed up
 * but never confirmed. Wraps Supabase's `auth.resend({ type: 'signup' })`.
 */
export const resendSignUpConfirmation = async (email: string): Promise<AuthActionResult> => {
  if (!isSupabaseConfigured() || !supabase) {
    return NOT_CONFIGURED;
  }

  const emailRedirectTo = getInviteConfirmationRedirectUrl();
  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
    });

    if (error) {
      logger.auth.warn('Resend sign-up confirmation error', error);
      return returnedFailure(error);
    }

    return { error: null, errorKind: null };
  } catch (err) {
    logger.auth.warn('Resend sign-up confirmation threw', err);
    return thrownFailure(err);
  }
};

export const signIn = async (email: string, password: string): Promise<AuthUserResult> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { user: null, ...NOT_CONFIGURED };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      logger.auth.error('Sign in error', error);
      return { user: null, ...returnedFailure(error) };
    }

    return { user: data.user, error: null, errorKind: null };
  } catch (err) {
    logger.auth.error('Sign in threw', err);
    return { user: null, ...thrownFailure(err) };
  }
};

const signInWithProvider = async (provider: 'google' | 'apple'): Promise<AuthUserResult> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { user: null, ...NOT_CONFIGURED };
  }

  try {
    // In the Android / iOS apps Google refuses the in-app WebView, so the
    // sign-in runs in the system browser and returns on the app's own scheme.
    const native = await import('./nativeOAuth');
    if (native.usesNativeOAuth()) {
      const { error } = await native.startNativeSignIn(provider);
      if (error) {
        logger.auth.error(`Native ${provider} sign in error`, error);
        return { user: null, error, errorKind: 'unknown' };
      }
      return { user: null, error: null, errorKind: null };
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: getInviteConfirmationRedirectUrl() ?? window.location.origin,
      },
    });

    if (error) {
      logger.auth.error(`${provider} sign in error`, error);
      return { user: null, ...returnedFailure(error) };
    }

    return { user: null, error: null, errorKind: null }; // OAuth doesn't return user directly
  } catch (err) {
    logger.auth.error(`${provider} sign in threw`, err);
    return { user: null, ...thrownFailure(err) };
  }
};

export const signInWithGoogle = (): Promise<AuthUserResult> => signInWithProvider('google');

/**
 * Sign in with Apple. Offered only when the Apple provider is set up in
 * Supabase (VITE_APPLE_SIGN_IN=true — see docs/STORE-LAUNCH.md): App Store
 * guideline 4.8 requires it next to Google in the iOS app.
 */
export const signInWithApple = (): Promise<AuthUserResult> => signInWithProvider('apple');

/**
 * Best-effort: flush pending offline mutations to the cloud before the local
 * wipe (data-loss guard), then clear the queue so leftover entries can never
 * replay into the next account on this device.
 */
const flushMutationQueue = async (): Promise<void> => {
  try {
    // A workout finished seconds ago may still be handing itself to the cloud
    // in the background; let it reach the push or the queue first.
    const { settleSessionCloudHandoffs } = await import('./sessionDb');
    await settleSessionCloudHandoffs();
    const { getQueueDepth, processQueue } = await import('./offlineQueue');
    if (typeof navigator === 'undefined' || navigator.onLine) {
      const depth = await getQueueDepth();
      if (depth > 0) {
        await processQueue();
      }
    }
  } catch (err) {
    logger.app.warn('signOut cleanup: offline-queue flush failed', err);
  }
};

export const signOut = async (): Promise<void> => {
  // Flush BEFORE wiping local stores: signing out must not silently discard
  // changes that never reached the cloud. Bounded, because an overloaded server
  // used to hold this await — and the whole sign-out — for minutes. What did not
  // make it is what the Settings warning dialog has already counted and named.
  if (!(await settlesWithin(flushMutationQueue(), SIGN_OUT_STEP_TIMEOUT_MS))) {
    logger.app.warn('signOut cleanup: offline-queue flush did not finish in time');
  }

  // Use the shared transition path even when Supabase is unavailable. This
  // force-wipes local data when a legacy install lacks an identity marker.
  try {
    await transitionAuthSession(null, { forceCleanup: true });
  } catch (err) {
    logger.auth.error('Sign-out local cleanup failed', err);
  }

  if (!isSupabaseConfigured() || !supabase) return;

  await dropStoredSession('Sign out');
};

export const resetPassword = async (email: string): Promise<AuthActionResult> => {
  if (!isSupabaseConfigured() || !supabase) {
    return NOT_CONFIGURED;
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      logger.auth.error('Reset password error', error);
      return returnedFailure(error);
    }

    return { error: null, errorKind: null };
  } catch (err) {
    logger.auth.error('Reset password threw', err);
    return thrownFailure(err);
  }
};

/**
 * The app's password rule — at least 8 characters, a letter and a digit — as a
 * Hebrew message naming the first rule broken, or null when it passes. Supabase
 * enforces its own policy server-side; checking first avoids a round-trip and
 * names the exact rule, which a server message cannot do in Hebrew.
 */
export const passwordRuleError = (password: string): string | null => {
  if (password.length < 8) return 'הסיסמה חייבת להכיל לפחות 8 תווים';
  if (!/[a-zA-Z֐-׿]/.test(password)) return 'הסיסמה חייבת להכיל לפחות אות אחת';
  if (!/[0-9]/.test(password)) return 'הסיסמה חייבת להכיל לפחות ספרה אחת';
  return null;
};

export const updatePassword = async (newPassword: string): Promise<AuthActionResult> => {
  if (!isSupabaseConfigured() || !supabase) {
    return NOT_CONFIGURED;
  }

  // Client-side strength check first, so the shared rule stays the gate here
  // even for a caller that did not run it itself.
  const ruleError = passwordRuleError(newPassword);
  if (ruleError) {
    return { error: ruleError, errorKind: 'weak_password' };
  }

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      logger.auth.error('Update password error', error);
      return returnedFailure(error);
    }

    return { error: null, errorKind: null };
  } catch (err) {
    logger.auth.error('Update password threw', err);
    return thrownFailure(err);
  }
};

export const updateUserMetadata = async (
  metadata: Record<string, unknown>
): Promise<{ error: string | null }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: 'Supabase not configured' };
  }

  const { error } = await supabase.auth.updateUser({ data: metadata });

  if (error) {
    logger.auth.error('Update user metadata error', error);
    return { error: error.message };
  }

  return { error: null };
};

export const onAuthStateChange = (callback: AuthCallback): (() => void) => {
  if (!isSupabaseConfigured() || !supabase) {
    return () => {};
  }

  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => subscription.unsubscribe();
};

export const isAuthenticated = async (): Promise<boolean> => {
  const user = await getCurrentUser();
  return user !== null;
};

/**
 * Supabase Authentication Service
 * SPARKOS Fitness App - Auth with Supabase
 */

import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { getInviteConfirmationRedirectUrl } from './authContinuation';
import { transitionAuthSession } from './authSessionTransition';

export type AuthCallback = (session: Session | null) => void;
export type AuthUserCallback = (user: User | null) => void;

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

  // Drop the credential only. `signOut()` clears the Supabase token from storage
  // but does NOT touch our IndexedDB stores, localStorage keys or the queue.
  try {
    if (supabase) await supabase.auth.signOut();
  } catch (signOutErr) {
    logger.auth.error('signOut after expired session failed', signOutErr);
  }

  // The auth listener will see the null session and re-run the identity check,
  // which is where a real account change is detected and cleaned up.
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured() || !supabase) return null;

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

  if (session?.user) return session.user;

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

export const signUp = async (
  email: string,
  password: string,
  metadata?: Record<string, unknown>
): Promise<{ user: User | null; error: string | null }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { user: null, error: 'Supabase not configured' };
  }

  const emailRedirectTo = getInviteConfirmationRedirectUrl();
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
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
};

/**
 * Re-send the sign-up confirmation email for an address that already signed up
 * but never confirmed. Wraps Supabase's `auth.resend({ type: 'signup' })`.
 * Returns a localized error string on failure, or null on success.
 */
export const resendSignUpConfirmation = async (
  email: string
): Promise<{ error: string | null }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: 'Supabase not configured' };
  }

  const emailRedirectTo = getInviteConfirmationRedirectUrl();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
  });

  if (error) {
    logger.auth.warn('Resend sign-up confirmation error', error);
    return { error: error.message };
  }

  return { error: null };
};

export const signIn = async (
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { user: null, error: 'Supabase not configured' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    logger.auth.error('Sign in error', error);
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
};

export const signInWithGoogle = async (): Promise<{ user: User | null; error: string | null }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { user: null, error: 'Supabase not configured' };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getInviteConfirmationRedirectUrl() ?? window.location.origin,
    },
  });

  if (error) {
    logger.auth.error('Google sign in error', error);
    return { user: null, error: error.message };
  }

  return { user: null, error: null }; // OAuth doesn't return user directly
};

/**
 * Best-effort: flush pending offline mutations to the cloud before the local
 * wipe (data-loss guard), then clear the queue so leftover entries can never
 * replay into the next account on this device.
 */
const flushMutationQueue = async (): Promise<void> => {
  try {
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
  // changes that never reached the cloud.
  await flushMutationQueue();

  // Use the shared transition path even when Supabase is unavailable. This
  // force-wipes local data when a legacy install lacks an identity marker.
  try {
    await transitionAuthSession(null, { forceCleanup: true });
  } catch (err) {
    logger.auth.error('Sign-out local cleanup failed', err);
  }

  if (!isSupabaseConfigured() || !supabase) return;

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.auth.error('Sign out error', error);
    }
  } catch (err) {
    logger.auth.error('Sign out threw', err);
  }
};

export const resetPassword = async (email: string): Promise<{ error: string | null }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: 'Supabase not configured' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    logger.auth.error('Reset password error', error);
    return { error: error.message };
  }

  return { error: null };
};

export const updatePassword = async (newPassword: string): Promise<{ error: string | null }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: 'Supabase not configured' };
  }

  // Client-side strength check: minimum 8 characters, at least one letter and
  // one digit. Supabase enforces its own policy server-side, but failing early
  // avoids a round-trip and gives users a clear, localised message.
  if (newPassword.length < 8) {
    return { error: 'הסיסמה חייבת להכיל לפחות 8 תווים' };
  }
  if (!/[a-zA-Z֐-׿]/.test(newPassword)) {
    return { error: 'הסיסמה חייבת להכיל לפחות אות אחת' };
  }
  if (!/[0-9]/.test(newPassword)) {
    return { error: 'הסיסמה חייבת להכיל לפחות ספרה אחת' };
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  if (error) {
    logger.auth.error('Update password error', error);
    return { error: error.message };
  }

  return { error: null };
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

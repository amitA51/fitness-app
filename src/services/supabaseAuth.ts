/**
 * Supabase Authentication Service
 * SPARKOS Fitness App - Auth with Supabase
 */

import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { logger } from '../utils/logger';

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
 * Clear a stale session from storage and notify the app layer so it can
 * bounce the user to the login screen. Best-effort — we swallow any error
 * from signOut since the session was already invalid.
 */
const handleExpiredSession = async (err: unknown): Promise<void> => {
  logger.auth.warn('Session expired or invalid — signing out', err);
  try {
    if (supabase) await supabase.auth.signOut();
  } catch (signOutErr) {
    logger.auth.error('signOut after expired session failed', signOutErr);
  }
  try {
    localStorage.removeItem('supabase_session');
  } catch {
    // ignore storage errors
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:session-expired'));
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured() || !supabase) return null;

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (error) {
    logger.auth.error('Sign up error', error);
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
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
      redirectTo: window.location.origin,
    },
  });

  if (error) {
    logger.auth.error('Google sign in error', error);
    return { user: null, error: error.message };
  }

  return { user: null, error: null }; // OAuth doesn't return user directly
};

export const signOut = async (): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) {
    logger.auth.error('Sign out error', error);
  }
  localStorage.removeItem('supabase_session');
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

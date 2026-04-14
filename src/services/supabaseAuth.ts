/**
 * Supabase Authentication Service
 * SPARKOS Fitness App - Auth with Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export type AuthCallback = (session: Session | null) => void;
export type AuthUserCallback = (user: User | null) => void;

let authStateListenerSetup = false;

export const initSupabaseAuth = (): void => {
  if (!isSupabaseConfigured() || !supabase) {
    console.info('Supabase not configured - auth disabled');
    return;
  }

  if (authStateListenerSetup) return;

  supabase.auth.onAuthStateChange((event, session) => {
    console.log('Supabase auth event:', event);
    if (session) {
      localStorage.setItem('supabase_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('supabase_session');
    }
    window.dispatchEvent(new CustomEvent('supabase_auth_change', { detail: { event, session } }));
  });

  authStateListenerSetup = true;
};

export const getCurrentUser = async (): Promise<User | null> => {
  if (!isSupabaseConfigured() || !supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getSession = async (): Promise<Session | null> => {
  if (!isSupabaseConfigured() || !supabase) return null;

  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

export const signUp = async (email: string, password: string, metadata?: Record<string, unknown>): Promise<{ user: User | null; error: string | null }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { user: null, error: 'Supabase not configured' };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: metadata },
  });

  if (error) {
    console.error('Sign up error:', error);
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
};

export const signIn = async (email: string, password: string): Promise<{ user: User | null; error: string | null }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { user: null, error: 'Supabase not configured' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error('Sign in error:', error);
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
    console.error('Google sign in error:', error);
    return { user: null, error: error.message };
  }

  return { user: null, error: null }; // OAuth doesn't return user directly
};

export const signOut = async (): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Sign out error:', error);
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
    console.error('Reset password error:', error);
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
    console.error('Update password error:', error);
    return { error: error.message };
  }

  return { error: null };
};

export const updateUserMetadata = async (metadata: Record<string, unknown>): Promise<{ error: string | null }> => {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: 'Supabase not configured' };
  }

  const { error } = await supabase.auth.updateUser({ data: metadata });

  if (error) {
    console.error('Update user metadata error:', error);
    return { error: error.message };
  }

  return { error: null };
};

export const onAuthStateChange = (callback: AuthCallback): (() => void) => {
  if (!isSupabaseConfigured() || !supabase) {
    return () => {};
  }

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });

  return () => subscription.unsubscribe();
};

export const isAuthenticated = async (): Promise<boolean> => {
  const user = await getCurrentUser();
  return user !== null;
};

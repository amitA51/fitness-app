import type { Session, User } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// supabaseAuth wraps Supabase auth with two security-critical behaviors:
//  1. Every entry point short-circuits safely when the backend is unconfigured.
//  2. signOut wipes user-scoped local data (IDB + localStorage) so the next user
//     on a shared device cannot read the previous user's records — and expired
//     sessions trigger a sign-out + an 'auth:session-expired' window event.
// These are the cases that protect user data, so they are covered exhaustively.

// ── Supabase auth mock ───────────────────────────────────────────────────────
// Each method is an independent spy so individual tests can drive success/error.
// vi.hoisted lets these spies exist before the hoisted vi.mock factory runs.
const { authMock, dbClearSpy, queueMock } = vi.hoisted(() => ({
  authMock: {
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    resend: vi.fn(),
    onAuthStateChange: vi.fn(),
  },
  dbClearSpy: vi.fn(async (_store?: string) => {}),
  queueMock: {
    getQueueDepth: vi.fn(async () => 0),
    processQueue: vi.fn(async () => ({ success: 0, failed: 0 })),
    clearMutationQueue: vi.fn(async () => {}),
  },
}));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: { auth: authMock },
}));

// signOut flushes + clears the offline mutation queue (data-loss + cross-account
// guards) — stub the queue so we can assert the calls and their ordering.
vi.mock('../offlineQueue', () => queueMock);

// ── IndexedDB mock ───────────────────────────────────────────────────────────
// STORES must include every key referenced by USER_SCOPED_STORES in the SUT.
vi.mock('../indexedDBCore', () => ({
  STORES: {
    WORKOUT_SESSIONS: 'workout_sessions',
    WORKOUT_TEMPLATES: 'workout_templates',
    PERSONAL_RECORDS: 'personal_records',
    BODY_MEASUREMENTS: 'body_measurements',
    BODY_WEIGHT: 'body_weight',
    RECOVERY_LOGS: 'recovery_logs',
    NUTRITION_LOGS: 'nutrition_logs',
    WATER_LOGS: 'water_logs',
    AI_CONVERSATIONS: 'ai_conversations',
    PERSONAL_ITEMS: 'personal_items',
    PERSONAL_EXERCISES: 'personal_exercises',
    USER_SETTINGS: 'user_settings',
    PENDING_SYNC: 'pending_sync',
  },
  dbClear: (store: string) => dbClearSpy(store),
}));

import { isSupabaseConfigured } from '../../lib/supabase';
import {
  getCurrentUser,
  getSession,
  isAuthenticated,
  onAuthStateChange,
  resendSignUpConfirmation,
  resetPassword,
  signIn,
  signInWithGoogle,
  signOut,
  signUp,
  updatePassword,
  updateUserMetadata,
} from '../supabaseAuth';

const mockIsConfigured = vi.mocked(isSupabaseConfigured);

const fakeUser = { id: 'user-1', email: 'a@b.com' } as User;
const fakeSession = { access_token: 'tok', user: fakeUser } as Session;

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  // Sensible success defaults; individual tests override.
  authMock.getSession.mockResolvedValue({ data: { session: fakeSession }, error: null });
  authMock.getUser.mockResolvedValue({ data: { user: fakeUser }, error: null });
  authMock.signOut.mockResolvedValue({ error: null });
  authMock.updateUser.mockResolvedValue({ error: null });
  authMock.resetPasswordForEmail.mockResolvedValue({ error: null });
  authMock.resend.mockResolvedValue({ error: null });
  authMock.signUp.mockResolvedValue({ data: { user: fakeUser }, error: null });
  authMock.signInWithPassword.mockResolvedValue({ data: { user: fakeUser }, error: null });
  authMock.signInWithOAuth.mockResolvedValue({ error: null });
  queueMock.getQueueDepth.mockResolvedValue(0);
  queueMock.processQueue.mockResolvedValue({ success: 0, failed: 0 });
  queueMock.clearMutationQueue.mockResolvedValue(undefined);
});

// ──────────────────────────────────────────────────────────────────────────
describe('not-configured short circuits', () => {
  beforeEach(() => mockIsConfigured.mockReturnValue(false));

  it('signUp returns the not-configured error without touching supabase', async () => {
    const result = await signUp('a@b.com', 'pw');
    expect(result).toEqual({ user: null, error: 'Supabase not configured' });
    expect(authMock.signUp).not.toHaveBeenCalled();
  });

  it('signIn returns the not-configured error', async () => {
    const result = await signIn('a@b.com', 'pw');
    expect(result).toEqual({ user: null, error: 'Supabase not configured' });
    expect(authMock.signInWithPassword).not.toHaveBeenCalled();
  });

  it('signInWithGoogle returns the not-configured error', async () => {
    const result = await signInWithGoogle();
    expect(result).toEqual({ user: null, error: 'Supabase not configured' });
    expect(authMock.signInWithOAuth).not.toHaveBeenCalled();
  });

  it('resetPassword returns the not-configured error', async () => {
    expect(await resetPassword('a@b.com')).toEqual({ error: 'Supabase not configured' });
  });

  it('resendSignUpConfirmation returns the not-configured error', async () => {
    expect(await resendSignUpConfirmation('a@b.com')).toEqual({
      error: 'Supabase not configured',
    });
    expect(authMock.resend).not.toHaveBeenCalled();
  });

  it('updatePassword returns the not-configured error', async () => {
    expect(await updatePassword('Valid1234')).toEqual({ error: 'Supabase not configured' });
  });

  it('updateUserMetadata returns the not-configured error', async () => {
    expect(await updateUserMetadata({ x: 1 })).toEqual({ error: 'Supabase not configured' });
  });

  it('getCurrentUser returns null', async () => {
    expect(await getCurrentUser()).toBeNull();
  });

  it('getSession returns null', async () => {
    expect(await getSession()).toBeNull();
  });

  it('onAuthStateChange returns a no-op unsubscribe that does not throw', () => {
    const unsub = onAuthStateChange(() => {});
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
    expect(authMock.onAuthStateChange).not.toHaveBeenCalled();
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('resendSignUpConfirmation', () => {
  it('calls Supabase resend with the signup type and returns no error on success', async () => {
    const result = await resendSignUpConfirmation('a@b.com');
    expect(authMock.resend).toHaveBeenCalledWith({ type: 'signup', email: 'a@b.com' });
    expect(result).toEqual({ error: null });
  });

  it('surfaces the Supabase error message on failure', async () => {
    authMock.resend.mockResolvedValueOnce({ error: { message: 'rate limited' } });
    const result = await resendSignUpConfirmation('a@b.com');
    expect(result).toEqual({ error: 'rate limited' });
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('signUp / signIn', () => {
  it('signUp returns the created user on success', async () => {
    const result = await signUp('a@b.com', 'pw', { role: 'athlete' });
    expect(result).toEqual({ user: fakeUser, error: null });
    expect(authMock.signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'pw',
      options: { data: { role: 'athlete' } },
    });
  });

  it('signUp returns the error message on failure', async () => {
    authMock.signUp.mockResolvedValue({ data: { user: null }, error: { message: 'email taken' } });
    expect(await signUp('a@b.com', 'pw')).toEqual({ user: null, error: 'email taken' });
  });

  it('signIn returns the user on success', async () => {
    expect(await signIn('a@b.com', 'pw')).toEqual({ user: fakeUser, error: null });
    expect(authMock.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pw' });
  });

  it('signIn returns the error message on bad credentials', async () => {
    authMock.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });
    expect(await signIn('a@b.com', 'wrong')).toEqual({
      user: null,
      error: 'Invalid login credentials',
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('signInWithGoogle', () => {
  it('calls signInWithOAuth with the google provider and returns no user on success', async () => {
    const result = await signInWithGoogle();
    expect(result).toEqual({ user: null, error: null });
    expect(authMock.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' })
    );
  });

  it('returns the error message when OAuth start fails', async () => {
    authMock.signInWithOAuth.mockResolvedValue({ error: { message: 'oauth blocked' } });
    expect(await signInWithGoogle()).toEqual({ user: null, error: 'oauth blocked' });
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('getCurrentUser', () => {
  it('returns the session user without calling getUser (hot path)', async () => {
    const user = await getCurrentUser();
    expect(user).toBe(fakeUser);
    expect(authMock.getUser).not.toHaveBeenCalled();
  });

  it('falls back to getUser when there is no cached session', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });

    const user = await getCurrentUser();

    expect(user).toBe(fakeUser);
    expect(authMock.getUser).toHaveBeenCalledTimes(1);
  });

  it('signs out and dispatches auth:session-expired on a 401 getSession error', async () => {
    authMock.getSession.mockResolvedValue({
      data: { session: null },
      error: { status: 401, message: 'unauthorized' },
    });
    const onExpired = vi.fn();
    window.addEventListener('auth:session-expired', onExpired);

    const user = await getCurrentUser();

    expect(user).toBeNull();
    expect(authMock.signOut).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:session-expired', onExpired);
  });

  it('treats a token_expired code from getUser as an expired session', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMock.getUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'token_expired', message: 'nope' },
    });
    const onExpired = vi.fn();
    window.addEventListener('auth:session-expired', onExpired);

    const user = await getCurrentUser();

    expect(user).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:session-expired', onExpired);
  });

  it('treats a "JWT expired" message as an expired session', async () => {
    authMock.getSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'JWT expired' },
    });
    const onExpired = vi.fn();
    window.addEventListener('auth:session-expired', onExpired);

    const user = await getCurrentUser();

    expect(user).toBeNull();
    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:session-expired', onExpired);
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('getSession', () => {
  it('returns the active session', async () => {
    expect(await getSession()).toBe(fakeSession);
  });

  it('returns null and dispatches the expired event on a session_not_found error', async () => {
    authMock.getSession.mockResolvedValue({
      data: { session: null },
      error: { code: 'session_not_found', message: 'gone' },
    });
    const onExpired = vi.fn();
    window.addEventListener('auth:session-expired', onExpired);

    const session = await getSession();

    expect(session).toBeNull();
    expect(authMock.signOut).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
    window.removeEventListener('auth:session-expired', onExpired);
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('signOut — local data wipe', () => {
  it('clears user-scoped IDB stores and localStorage even when unconfigured', async () => {
    mockIsConfigured.mockReturnValue(false);
    localStorage.setItem('user_profile', '{"x":1}');
    localStorage.setItem('ai_tutorial_squat', 'seen');

    await signOut();

    // All 13 user-scoped IDB stores cleared.
    expect(dbClearSpy).toHaveBeenCalledTimes(13);
    expect(dbClearSpy).toHaveBeenCalledWith('workout_sessions');
    expect(dbClearSpy).toHaveBeenCalledWith('water_logs');
    // Known + prefixed localStorage keys removed.
    expect(localStorage.getItem('user_profile')).toBeNull();
    expect(localStorage.getItem('ai_tutorial_squat')).toBeNull();
    // Supabase signOut must NOT run when unconfigured.
    expect(authMock.signOut).not.toHaveBeenCalled();
  });

  it('clears local data AND calls supabase.auth.signOut when configured', async () => {
    localStorage.setItem('onboarding_data', '{}');

    await signOut();

    expect(dbClearSpy).toHaveBeenCalledTimes(13);
    expect(localStorage.getItem('onboarding_data')).toBeNull();
    expect(authMock.signOut).toHaveBeenCalledTimes(1);
  });

  it('swallows a thrown supabase signOut without rejecting', async () => {
    authMock.signOut.mockRejectedValue(new Error('network down'));
    await expect(signOut()).resolves.toBeUndefined();
  });

  it('removes coach view/role/reminder localStorage keys', async () => {
    localStorage.setItem('view_mode', 'coach');
    localStorage.setItem('cached_role', 'coach');
    localStorage.setItem('coach_reminders_fired', '["r1"]');

    await signOut();

    expect(localStorage.getItem('view_mode')).toBeNull();
    expect(localStorage.getItem('cached_role')).toBeNull();
    expect(localStorage.getItem('coach_reminders_fired')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('signOut — offline mutation queue', () => {
  it('flushes pending mutations BEFORE wiping local data when the queue is non-empty', async () => {
    queueMock.getQueueDepth.mockResolvedValue(2);

    await signOut();

    expect(queueMock.processQueue).toHaveBeenCalledTimes(1);
    // Flush must happen before the local wipe, or the data is already gone.
    const flushOrder = queueMock.processQueue.mock.invocationCallOrder[0]!;
    const firstWipeOrder = dbClearSpy.mock.invocationCallOrder[0]!;
    expect(flushOrder).toBeLessThan(firstWipeOrder);
  });

  it('skips the flush when the queue is empty', async () => {
    queueMock.getQueueDepth.mockResolvedValue(0);

    await signOut();

    expect(queueMock.processQueue).not.toHaveBeenCalled();
  });

  it('always clears the mutation queue so entries cannot replay into the next account', async () => {
    await signOut();
    expect(queueMock.clearMutationQueue).toHaveBeenCalledTimes(1);
  });

  it('still signs out when the queue flush throws', async () => {
    queueMock.getQueueDepth.mockRejectedValue(new Error('idb broken'));

    await expect(signOut()).resolves.toBeUndefined();
    expect(dbClearSpy).toHaveBeenCalled();
    expect(authMock.signOut).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('updatePassword — client-side strength validation', () => {
  it('rejects a password shorter than 8 characters with the Hebrew error', async () => {
    expect(await updatePassword('Ab12')).toEqual({
      error: 'הסיסמה חייבת להכיל לפחות 8 תווים',
    });
    expect(authMock.updateUser).not.toHaveBeenCalled();
  });

  it('rejects an 8+ char password with no letter', async () => {
    expect(await updatePassword('12345678')).toEqual({
      error: 'הסיסמה חייבת להכיל לפחות אות אחת',
    });
    expect(authMock.updateUser).not.toHaveBeenCalled();
  });

  it('rejects a password with letters but no digit', async () => {
    expect(await updatePassword('abcdefgh')).toEqual({
      error: 'הסיסמה חייבת להכיל לפחות ספרה אחת',
    });
    expect(authMock.updateUser).not.toHaveBeenCalled();
  });

  it('accepts a valid password (8+ chars, a letter and a digit) and updates the user', async () => {
    const result = await updatePassword('Valid1234');
    expect(result).toEqual({ error: null });
    expect(authMock.updateUser).toHaveBeenCalledWith({ password: 'Valid1234' });
  });

  it('returns the supabase error message when updateUser fails', async () => {
    authMock.updateUser.mockResolvedValue({ error: { message: 'same as old password' } });
    expect(await updatePassword('Valid1234')).toEqual({ error: 'same as old password' });
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('updateUserMetadata', () => {
  it('updates the user metadata and returns {error:null} on success', async () => {
    const result = await updateUserMetadata({ displayName: 'Dana' });
    expect(result).toEqual({ error: null });
    expect(authMock.updateUser).toHaveBeenCalledWith({ data: { displayName: 'Dana' } });
  });

  it('returns the error message on failure', async () => {
    authMock.updateUser.mockResolvedValue({ error: { message: 'metadata too large' } });
    expect(await updateUserMetadata({ x: 1 })).toEqual({ error: 'metadata too large' });
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('resetPassword', () => {
  it('sends the reset email and returns {error:null} on success', async () => {
    expect(await resetPassword('a@b.com')).toEqual({ error: null });
    expect(authMock.resetPasswordForEmail).toHaveBeenCalledWith(
      'a@b.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('/reset-password') })
    );
  });

  it('returns the error message on failure', async () => {
    authMock.resetPasswordForEmail.mockResolvedValue({ error: { message: 'rate limited' } });
    expect(await resetPassword('a@b.com')).toEqual({ error: 'rate limited' });
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('onAuthStateChange', () => {
  it('registers a listener, forwards the session to the callback, and unsubscribes', () => {
    const unsubscribe = vi.fn();
    let registered: ((event: string, session: Session | null) => void) | undefined;
    authMock.onAuthStateChange.mockImplementation(
      (cb: (event: string, session: Session | null) => void) => {
        registered = cb;
        return { data: { subscription: { unsubscribe } } };
      }
    );
    const callback = vi.fn();

    const stop = onAuthStateChange(callback);
    // Simulate Supabase firing the listener.
    registered?.('SIGNED_IN', fakeSession);

    expect(callback).toHaveBeenCalledWith(fakeSession);

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────────────────────────────────────────────────────────
describe('isAuthenticated', () => {
  it('is true when a current user exists', async () => {
    expect(await isAuthenticated()).toBe(true);
  });

  it('is false when there is no user', async () => {
    authMock.getSession.mockResolvedValue({ data: { session: null }, error: null });
    authMock.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await isAuthenticated()).toBe(false);
  });
});

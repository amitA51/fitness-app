// ============================================================================
// AuthContext — start-up must never hang on the server, and an outage must
// never look like a sign-out.
// ============================================================================
// getSession() waits for the SDK's start-up token refresh, which waits on the
// server. With the database overloaded the app sat on its loading skeleton, and
// when the refresh finally failed the user landed on Login while still signed
// in. These pin the fix: paint from the stored session, keep it through
// "unreachable", and let only a real SIGNED_OUT end it.
// ============================================================================

import type { Session } from '@supabase/supabase-js';
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: string, session: Session | null) => void;

const { auth, device, pullAllData } = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
    listener: null as Listener | null,
  },
  // What src/lib/supabase reads from localStorage without the network.
  device: { stored: null as unknown, callbackInUrl: false },
  pullAllData: vi.fn(async () => ({ success: true })),
}));

vi.mock('../../lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  supabase: { auth },
  readStoredAuthSession: () => device.stored,
  hasPendingAuthCallback: () => device.callbackInUrl,
  clearStoredAuthSession: vi.fn(),
}));
vi.mock('../../services/authSessionTransition', () => ({
  transitionAuthSession: vi.fn(async () => ({
    previousUserId: null,
    nextUserId: null,
    localDataCleared: false,
  })),
}));
vi.mock('../../services/authContinuation', () => ({
  getInviteContinuationCleanupOptions: () => null,
}));
vi.mock('../../services/supabaseSync', () => ({ pullAllData: () => pullAllData() }));
vi.mock('../../utils/logger', () => ({
  logger: { auth: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } },
}));

import { AuthProvider, useAuth } from '../AuthContext';

const session = (userId: string): Session =>
  ({
    access_token: `t-${userId}`,
    refresh_token: 'r',
    expires_at: 1,
    user: { id: userId },
  }) as Session;

const unreachable = { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' };

function Probe() {
  const { status, user } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="user">{user?.id ?? 'none'}</span>
    </div>
  );
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );

const emit = async (event: string, next: Session | null) => {
  await act(async () => {
    auth.listener?.(event, next);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  device.stored = null;
  device.callbackInUrl = false;
  auth.listener = null;
  auth.onAuthStateChange.mockImplementation((cb: Listener) => {
    auth.listener = cb;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  auth.signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AuthContext start-up', () => {
  it('paints the stored user at once while getSession is still waiting on the server', async () => {
    device.stored = session('user-1');
    auth.getSession.mockReturnValue(new Promise(() => {})); // the server never answers

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('user-1');
  });

  it('shows Login after a bounded wait when nothing is stored and getSession hangs', async () => {
    vi.useFakeTimers();
    auth.getSession.mockReturnValue(new Promise(() => {}));

    renderProvider();
    expect(screen.getByTestId('status')).toHaveTextContent('loading');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
  });

  it('is signed out, as before, when nothing is stored and the SDK says so', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
  });

  it('keeps the user signed in when the refresh fails because the server is unreachable', async () => {
    device.stored = session('user-1');
    auth.getSession.mockResolvedValue({ data: { session: null }, error: unreachable });

    renderProvider();
    // auth-js then reports INITIAL_SESSION with no session — but kept it stored.
    await emit('INITIAL_SESSION', null);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('user')).toHaveTextContent('user-1');
  });

  it('waits for a sign-in callback in the URL instead of painting the stored user', async () => {
    device.stored = session('user-1');
    device.callbackInUrl = true;
    auth.getSession.mockReturnValue(new Promise(() => {}));

    renderProvider();
    await act(async () => {});
    expect(screen.getByTestId('status')).toHaveTextContent('loading');

    await emit('SIGNED_IN', session('user-2'));
    expect(screen.getByTestId('user')).toHaveTextContent('user-2');
  });

  it('signs out when the server really ends the session', async () => {
    device.stored = session('user-1');
    auth.getSession.mockReturnValue(new Promise(() => {}));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    // auth-js removes the stored session, then emits SIGNED_OUT.
    device.stored = null;
    await emit('SIGNED_OUT', null);

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
  });
});

describe('AuthContext auto-pull', () => {
  it('pulls once per sign-in, not on every foreground SIGNED_IN', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    device.stored = session('user-1');
    auth.getSession.mockResolvedValue({ data: { session: session('user-1') }, error: null });

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    await emit('INITIAL_SESSION', session('user-1'));
    // auth-js re-announces SIGNED_IN on every return to the foreground.
    await emit('SIGNED_IN', session('user-1'));
    await emit('SIGNED_IN', session('user-1'));

    await waitFor(() => expect(pullAllData).toHaveBeenCalledTimes(1));

    // A quarter of an hour later the next foreground may refresh the data.
    vi.setSystemTime(Date.now() + 15 * 60_000);
    await emit('SIGNED_IN', session('user-1'));
    await waitFor(() => expect(pullAllData).toHaveBeenCalledTimes(2));
  });

  it('lets a pull that did not land try again after two minutes, not fifteen', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    pullAllData.mockResolvedValueOnce({ success: false });
    auth.getSession.mockResolvedValue({ data: { session: session('user-1') }, error: null });

    renderProvider();
    await waitFor(() => expect(pullAllData).toHaveBeenCalledTimes(1));

    vi.setSystemTime(Date.now() + 60_000);
    await emit('SIGNED_IN', session('user-1'));
    expect(pullAllData).toHaveBeenCalledTimes(1);

    vi.setSystemTime(Date.now() + 61_000);
    await emit('SIGNED_IN', session('user-1'));
    await waitFor(() => expect(pullAllData).toHaveBeenCalledTimes(2));
  });

  it('pulls at once for a different account, and after signing out and back in', async () => {
    auth.getSession.mockResolvedValue({ data: { session: session('user-1') }, error: null });

    renderProvider();
    await waitFor(() => expect(pullAllData).toHaveBeenCalledTimes(1));

    await emit('SIGNED_IN', session('user-2'));
    await waitFor(() => expect(pullAllData).toHaveBeenCalledTimes(2));

    await emit('SIGNED_OUT', null);
    await emit('SIGNED_IN', session('user-2'));
    await waitFor(() => expect(pullAllData).toHaveBeenCalledTimes(3));
  });
});

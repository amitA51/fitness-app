import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The system browser hands the app back a URL on its own scheme. Any web page
// can fire that scheme and another Android app can claim it, so the URL carries
// only a one-time code (PKCE), and only a sign-in this app started may finish.

const exchangeCodeForSession = vi.fn();
const signInWithOAuth = vi.fn();
const setSession = vi.fn();
const browserOpen = vi.fn(async () => undefined);

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: { setSession: (...a: unknown[]) => setSession(...a) } },
  createPkceAuthClient: () => ({
    auth: {
      signInWithOAuth: (...a: unknown[]) => signInWithOAuth(...a),
      exchangeCodeForSession: (...a: unknown[]) => exchangeCodeForSession(...a),
    },
  }),
}));
vi.mock('../../utils/platform', () => ({
  isNativePlatform: () => true,
  loadCapacitorPlugin: async () => ({
    plugin: { open: browserOpen, close: async () => undefined },
  }),
}));

import {
  NATIVE_AUTH_ERROR_EVENT,
  NATIVE_AUTH_REDIRECT,
  finishNativeSignIn,
  parseAuthCallback,
  resetNativeSignInForTests,
  startNativeGoogleSignIn,
} from '../nativeOAuth';

describe('parseAuthCallback', () => {
  it('reads the one-time code from the query', () => {
    expect(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}?code=abc123`)).toEqual({
      kind: 'code',
      code: 'abc123',
    });
  });

  it('prefers the readable error description', () => {
    expect(
      parseAuthCallback(
        `${NATIVE_AUTH_REDIRECT}?error=access_denied&error_description=User+cancelled`
      )
    ).toEqual({ kind: 'error', message: 'User cancelled' });
  });

  it('finds an error in the fragment too', () => {
    expect(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}#error=server_error`)).toEqual({
      kind: 'error',
      message: 'server_error',
    });
  });

  it('never accepts tokens from the link itself', () => {
    expect(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}#access_token=aaa&refresh_token=rrr`)).toEqual(
      { kind: 'error', message: 'missing_code' }
    );
  });

  it('ignores links that are not the auth callback', () => {
    expect(parseAuthCallback('com.sparkos.fitness://join/ABC123')).toBeNull();
    expect(parseAuthCallback('https://fitness-app-amit.netlify.app/?code=x')).toBeNull();
  });
});

describe('finishNativeSignIn', () => {
  const failures: string[] = [];
  const onFailure = (e: Event) => failures.push(String((e as CustomEvent).detail));

  beforeEach(() => {
    resetNativeSignInForTests();
    failures.length = 0;
    window.addEventListener(NATIVE_AUTH_ERROR_EVENT, onFailure);
    signInWithOAuth.mockResolvedValue({
      data: { url: 'https://auth.example/authorize' },
      error: null,
    });
    exchangeCodeForSession.mockResolvedValue({
      data: { session: { access_token: 'acc', refresh_token: 'ref' } },
      error: null,
    });
    setSession.mockResolvedValue({ error: null });
  });
  afterEach(() => {
    window.removeEventListener(NATIVE_AUTH_ERROR_EVENT, onFailure);
    vi.clearAllMocks();
  });

  it('ignores a callback when no sign-in was started (a forged link)', async () => {
    await finishNativeSignIn(`${NATIVE_AUTH_REDIRECT}?code=attacker`);
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
  });

  it('exchanges the code and hands the session to the main client', async () => {
    await startNativeGoogleSignIn();
    expect(signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          redirectTo: NATIVE_AUTH_REDIRECT,
          skipBrowserRedirect: true,
        }),
      })
    );
    expect(browserOpen).toHaveBeenCalled();

    await finishNativeSignIn(`${NATIVE_AUTH_REDIRECT}?code=real`);
    expect(exchangeCodeForSession).toHaveBeenCalledWith('real');
    expect(setSession).toHaveBeenCalledWith({ access_token: 'acc', refresh_token: 'ref' });
    expect(failures).toEqual([]);
  });

  it('does not let a stray error link cancel a sign-in in progress', async () => {
    await startNativeGoogleSignIn();
    await finishNativeSignIn(`${NATIVE_AUTH_REDIRECT}?error=access_denied`);
    await finishNativeSignIn(`${NATIVE_AUTH_REDIRECT}?code=real`);
    expect(exchangeCodeForSession).toHaveBeenCalledWith('real');
  });

  it('tells the login screen when a code arrives with no sign-in to finish', async () => {
    await finishNativeSignIn(`${NATIVE_AUTH_REDIRECT}?code=orphan`);
    expect(failures).toEqual(['no_sign_in_in_progress']);
  });

  it('accepts one callback per sign-in', async () => {
    await startNativeGoogleSignIn();
    await finishNativeSignIn(`${NATIVE_AUTH_REDIRECT}?code=first`);
    await finishNativeSignIn(`${NATIVE_AUTH_REDIRECT}?code=second`);
    expect(exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('reports a failed exchange to the login screen', async () => {
    exchangeCodeForSession.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'bad code' },
    });
    await startNativeGoogleSignIn();
    await finishNativeSignIn(`${NATIVE_AUTH_REDIRECT}?code=stale`);
    expect(setSession).not.toHaveBeenCalled();
    expect(failures).toEqual(['bad code']);
  });
});

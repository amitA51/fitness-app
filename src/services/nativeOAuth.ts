// ============================================================================
// Google sign-in inside the native apps (Android / iOS)
// ============================================================================
// Google refuses OAuth inside an embedded WebView ("disallowed_useragent"), and
// a web redirect back to the app's own origin would land on capacitor://
// localhost, which Supabase cannot redirect to. In the native shell the sign-in
// therefore runs in the system browser (Custom Tabs / SFSafariViewController),
// which Google allows, and comes back through the app's own URL scheme:
//
//   app → Browser.open(Supabase /authorize, PKCE challenge) → Google →
//   Supabase → com.sparkos.fitness://auth/callback?code=… → App 'appUrlOpen'
//   → exchange the code with the verifier kept in memory → setSession on the
//   main client → AuthContext takes over.
//
// PKCE, not the implicit flow: a custom scheme can be fired by any web page or
// claimed by another Android app, so the link must carry nothing usable on its
// own. The code is useless without the verifier, which never leaves this app,
// and a callback that arrives with no sign-in in progress is ignored.
//
// The scheme must be in Supabase → Authentication → URL Configuration →
// Redirect URLs, and registered by the shells (AndroidManifest intent-filter,
// iOS Info.plist CFBundleURLTypes).
// ============================================================================

import { createPkceAuthClient, supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { isNativePlatform, loadCapacitorPlugin } from '../utils/platform';

export const NATIVE_AUTH_REDIRECT = 'com.sparkos.fitness://auth/callback';

/** Fired on window when a sign-in that came back to the app failed. */
export const NATIVE_AUTH_ERROR_EVENT = 'native-auth-error';

/** A sign-in left unfinished this long (the user walked away) is forgotten. */
const PENDING_SIGN_IN_TTL_MS = 10 * 60 * 1000;

interface BrowserPlugin {
  open(options: { url: string; presentationStyle?: 'fullscreen' | 'popover' }): Promise<void>;
  close(): Promise<void>;
}

interface AppPlugin {
  addListener(
    event: 'appUrlOpen',
    listener: (event: { url: string }) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

export type AuthCallback = { kind: 'code'; code: string } | { kind: 'error'; message: string };

/**
 * Read the one-time code (PKCE, in the query) or the error (query or fragment)
 * from a callback URL. null when the URL is not an auth callback.
 */
export function parseAuthCallback(url: string): AuthCallback | null {
  if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return null;
  const hashAt = url.indexOf('#');
  const queryAt = url.indexOf('?');
  const query = new URLSearchParams(
    queryAt >= 0 ? url.slice(queryAt + 1, hashAt > queryAt ? hashAt : undefined) : ''
  );
  const fragment = new URLSearchParams(hashAt >= 0 ? url.slice(hashAt + 1) : '');

  const error =
    query.get('error_description') ??
    query.get('error') ??
    fragment.get('error_description') ??
    fragment.get('error');
  if (error) return { kind: 'error', message: error };

  const code = query.get('code');
  if (code) return { kind: 'code', code };
  return { kind: 'error', message: 'missing_code' };
}

/** True when Google sign-in should go through the system browser. */
export function usesNativeOAuth(): boolean {
  return isNativePlatform();
}

type PkceClient = NonNullable<ReturnType<typeof createPkceAuthClient>>;

/** The sign-in in progress: the client holding its verifier, and when it began. */
let pending: { client: PkceClient; startedAt: number } | null = null;

export type NativeOAuthProvider = 'google' | 'apple';

/** Open the provider's sign-in in the system browser. The app resumes in installNativeAuthCallback. */
export async function startNativeSignIn(
  provider: NativeOAuthProvider
): Promise<{ error: string | null }> {
  const client = createPkceAuthClient();
  if (!client) return { error: 'not_configured' };
  const browser = await loadCapacitorPlugin<BrowserPlugin>('Browser');
  if (!browser) return { error: 'browser_unavailable' };

  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return { error: error?.message ?? 'no_url' };

  pending = { client, startedAt: Date.now() };
  await browser.plugin.open({ url: data.url, presentationStyle: 'popover' });
  return { error: null };
}

/** Google sign-in in the system browser (see startNativeSignIn). */
export const startNativeGoogleSignIn = () => startNativeSignIn('google');

const reportFailure = (message: string): void => {
  logger.auth.warn('Native sign-in did not complete', message);
  window.dispatchEvent(new CustomEvent(NATIVE_AUTH_ERROR_EVENT, { detail: message }));
};

/** Exported for tests; the app reaches it through installNativeAuthCallback. */
export async function finishNativeSignIn(url: string): Promise<void> {
  const callback = parseAuthCallback(url);
  if (!callback) return;

  // Only a sign-in this app started, and recently, may complete. A stray
  // error link must not cancel a real sign-in still in progress, so only a
  // callback carrying a code consumes it.
  const inFlight =
    pending && Date.now() - pending.startedAt <= PENDING_SIGN_IN_TTL_MS ? pending : null;
  if (!inFlight) {
    pending = null;
    // A code with no sign-in to finish: forged, or Android stopped the app
    // while the browser was open and its in-memory verifier is gone.
    if (callback.kind === 'code') reportFailure('no_sign_in_in_progress');
    else logger.auth.warn('Ignored an auth callback with no sign-in in progress');
    return;
  }
  if (callback.kind === 'code') pending = null;

  // iOS keeps SFSafariViewController on top until it is closed; Android's
  // Custom Tab has no close call and simply rejects.
  const browser = await loadCapacitorPlugin<BrowserPlugin>('Browser');
  await browser?.plugin.close().catch(() => undefined);

  if (callback.kind === 'error') {
    reportFailure(callback.message);
    return;
  }
  if (!supabase) {
    reportFailure('not_configured');
    return;
  }

  const exchanged = await inFlight.client.auth.exchangeCodeForSession(callback.code);
  const session = exchanged.data?.session;
  if (exchanged.error || !session) {
    reportFailure(exchanged.error?.message ?? 'no_session');
    return;
  }
  const { error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (error) reportFailure(error.message);
}

let installed = false;

/** Listen for the sign-in callback. Called once at boot; inert on the web. */
export async function installNativeAuthCallback(): Promise<void> {
  if (installed || !isNativePlatform()) return;
  const app = await loadCapacitorPlugin<AppPlugin>('App');
  if (!app) return;
  installed = true;
  await app.plugin.addListener('appUrlOpen', ({ url }) => {
    void finishNativeSignIn(url);
  });
}

/** Tests only: forget a sign-in in progress. */
export function resetNativeSignInForTests(): void {
  pending = null;
}

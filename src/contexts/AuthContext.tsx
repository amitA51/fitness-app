// ============================================================================
// SPARKOS FITNESS - Auth Context
// Wraps Supabase auth state changes in a proper React context.
// Replaces the legacy window-event bus (`supabase_auth_change`, `skip_auth`).
// ============================================================================

import type { Session, User } from '@supabase/supabase-js';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  clearStoredAuthSession,
  hasPendingAuthCallback,
  isSupabaseConfigured,
  readStoredAuthSession,
  supabase,
} from '../lib/supabase';
import { getInviteContinuationCleanupOptions } from '../services/authContinuation';
import { isUnreachableAuthError } from '../services/authErrors';
import { transitionAuthSession } from '../services/authSessionTransition';
import {
  clearGuestClaimPending,
  isGuestClaimPending,
  markGuestClaimPending,
} from '../services/guestClaim';
import { logger } from '../utils/logger';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export type AuthStatus = 'loading' | 'authenticated' | 'guest' | 'unauthenticated';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  status: AuthStatus;
  /** True when the user has explicitly chosen to use the app without auth. */
  isGuest: boolean;
  /** Skip auth for this device — enables local-only mode. */
  skipAuth: () => void;
  /** Clear guest mode (used before sending user back to login). */
  clearGuest: () => void;
}

const SKIP_AUTH_STORAGE_KEY = 'skip_auth';

/**
 * With nothing stored on the device, the SDK answers from storage in
 * milliseconds; this only bounds a start-up that hangs for another reason, so
 * the loading screen can never be permanent.
 */
const STARTUP_FALLBACK_MS = 3_000;
/**
 * A sign-in callback in the URL (Google return, magic link) is exchanged with
 * the server first. auth requests give up after 15 s (src/lib/supabase.ts), so
 * this is a backstop, not the expected wait.
 */
const CALLBACK_FALLBACK_MS = 20_000;
/**
 * auth-js re-announces SIGNED_IN every time the app returns to the foreground.
 * Each used to start a full cloud pull — a dozen requests per app switch, which
 * is load the server can least afford exactly when it is struggling.
 */
const REPEAT_PULL_INTERVAL_MS = 15 * 60_000;
/** After a pull that did not land, the next announce may try again this soon. */
const FAILED_PULL_RETRY_MS = 2 * 60_000;

const AuthContext = createContext<AuthContextValue | null>(null);

// ----------------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [isGuest, setIsGuest] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SKIP_AUTH_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  // Keep a ref to the guest flag so onAuthStateChange can read latest value
  // without needing to re-subscribe on every change.
  const isGuestRef = useRef(isGuest);
  useEffect(() => {
    isGuestRef.current = isGuest;
  }, [isGuest]);

  // Read by the start-up fallbacks, which run long after the effect captured
  // its closure.
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Who the last auto-pull was for, and when. Null whenever nobody is signed
  // in, so the next sign-in always counts as new and pulls.
  const lastPullRef = useRef<{ userId: string; at: number } | null>(null);

  useEffect(() => {
    // Offline / unconfigured: resolve immediately without any network call.
    if (!isSupabaseConfigured() || !supabase) {
      setStatus(isGuestRef.current ? 'guest' : 'unauthenticated');
      return;
    }

    let cancelled = false;
    let transitionQueue: Promise<void> = Promise.resolve();
    // Captured once: the async closures below run after awaits, where TypeScript
    // can no longer prove the module-level `supabase` is still non-null.
    const client = supabase;

    // A new sign-in (or a cold start) pulls at once. The same user announced
    // again — a foreground SIGNED_IN, a second INITIAL_SESSION — pulls only if
    // the last pull is old.
    const pullIfDue = (userId: string): void => {
      const last = lastPullRef.current;
      const now = Date.now();
      if (last?.userId === userId && now - last.at < REPEAT_PULL_INTERVAL_MS) return;
      const entry = { userId, at: now };
      lastPullRef.current = entry;
      // A pull that did not land (offline, server down, another tab syncing)
      // must not hold the slot for the full interval — but retrying on every
      // foreground would hammer a struggling server, so it waits a little.
      const allowEarlyRetry = (): void => {
        if (lastPullRef.current !== entry) return;
        lastPullRef.current = {
          userId,
          at: Date.now() - REPEAT_PULL_INTERVAL_MS + FAILED_PULL_RETRY_MS,
        };
      };
      import('../services/supabaseSync')
        .then((m) => m.pullAllData())
        .then((result) => {
          if (!result.success) allowEarlyRetry();
        })
        .catch(() => {
          // best-effort — offline is fine
          allowEarlyRetry();
        });
    };

    const applySession = async (event: string, nextSession: Session | null): Promise<void> => {
      const nextUserId = nextSession?.user.id ?? null;
      try {
        // Preserve an explicitly requested invite continuation only while the
        // authentication round-trip is in progress. All other account state is
        // wiped before a different user's data can be read or pulled.
        //
        // Guest signing into their FIRST account: adopt instead of wipe. A
        // guest has no owner marker yet, so without this branch execution used
        // to fall through to the destructive cleanup below and destroy every
        // local record at exactly the moment signup promised "כדי לשמור את
        // הנתונים שלכם". Only fires when this device was in guest mode — or
        // left it a moment ago to reach the Login screen (services/guestClaim).
        const baseCleanupOptions = nextUserId ? (getInviteContinuationCleanupOptions() ?? {}) : {};
        const claimGuestData = Boolean(nextUserId && (isGuestRef.current || isGuestClaimPending()));
        await transitionAuthSession(nextUserId, {
          ...baseCleanupOptions,
          ...(claimGuestData ? { claimGuestData: true } : {}),
        });
      } catch (err) {
        logger.auth.error('Auth transition cleanup failed; refusing to load the session', err);
        if (cancelled) return;
        setSession(null);
        setIsGuest(false);
        setStatus('unauthenticated');
        // A failed wipe must never leave another account's local records visible.
        // auth-js keeps the session when the server fails the sign-out, so on
        // failure it is removed locally — otherwise the next start-up would
        // paint it again.
        if (nextSession) {
          void client.auth.signOut({ scope: 'local' }).then(
            ({ error }) => {
              if (!error) return;
              logger.auth.error('Auth transition safety sign-out failed', error);
              clearStoredAuthSession();
            },
            (signOutErr: unknown) => {
              logger.auth.error('Auth transition safety sign-out failed', signOutErr);
              clearStoredAuthSession();
            }
          );
        }
        return;
      }

      if (cancelled) return;
      setSession(nextSession);
      if (nextSession) {
        // A real sign-in clears guest mode.
        try {
          localStorage.removeItem(SKIP_AUTH_STORAGE_KEY);
        } catch {
          // ignore
        }
        clearGuestClaimPending();
        setIsGuest(false);
        setStatus('authenticated');

        // Auto-pull only after transitionAuthSession has fully wiped a prior
        // account. pullAllData merges rows, so this ordering is security-critical.
        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          pullIfDue(nextSession.user.id);
        }
      } else {
        lastPullRef.current = null;
        setStatus(isGuestRef.current ? 'guest' : 'unauthenticated');
      }
    };

    const enqueueSession = (event: string, nextSession: Session | null): void => {
      transitionQueue = transitionQueue.then(
        () => applySession(event, nextSession),
        () => applySession(event, nextSession)
      );
    };

    // Leave 'loading' for the signed-out state — never downgrade a session
    // that something else has already applied.
    const settleSignedOutIfLoading = (): void => {
      setStatus((prev) =>
        prev === 'loading' ? (isGuestRef.current ? 'guest' : 'unauthenticated') : prev
      );
    };

    // Paint the signed-in user from this device's stored session right away.
    // getSession() cannot answer until the SDK's start-up token refresh has
    // been to the server and back, and on an overloaded day that held the app
    // on its loading skeleton for half a minute or more. The stored session
    // still goes through the same transition gate as SDK events, so a persisted
    // session cannot bypass local cleanup; the server's answer replaces it when
    // it arrives, and a real sign-out still arrives as SIGNED_OUT.
    //
    // Not when the URL carries a sign-in callback: that session is the one
    // being signed in to, so it is awaited instead of painting another.
    const callbackPending = hasPendingAuthCallback();
    const storedAtStart = readStoredAuthSession();
    if (storedAtStart && !callbackPending) {
      enqueueSession('INITIAL_SESSION', storedAtStart);
    }

    // The server could not be asked (offline, timeout, 5xx) and auth-js kept
    // the stored session for its auto-refresh to retry: that is NOT a sign-out.
    // Showing Login here is what logged people out every time the database
    // struggled. auth-js deletes the stored session itself when the server
    // actually rejects it, so "still stored" is the tell. Returns whether a
    // stored session exists; paints it if nothing has been painted yet.
    const keepStoredSession = (): boolean => {
      const stored = readStoredAuthSession();
      if (!stored) return false;
      if (statusRef.current === 'loading') enqueueSession('INITIAL_SESSION', stored);
      return true;
    };

    const fallbackTimer = setTimeout(
      () => {
        if (cancelled || statusRef.current !== 'loading') return;
        logger.auth.warn('Auth start-up did not settle in time');
        if (!keepStoredSession()) settleSignedOutIfLoading();
      },
      callbackPending ? CALLBACK_FALLBACK_MS : STARTUP_FALLBACK_MS
    );

    // Ask the SDK too. It goes through the same transition gate as SDK events
    // so a persisted session cannot bypass local cleanup.
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (data.session) {
          enqueueSession('INITIAL_SESSION', data.session);
          return;
        }
        if (error && isUnreachableAuthError(error) && keepStoredSession()) {
          logger.auth.warn('Session refresh unreachable at start-up; keeping the stored session');
          return;
        }
        enqueueSession('INITIAL_SESSION', null);
      })
      .catch((err) => {
        if (cancelled) return;
        logger.auth.warn('getSession failed, continuing offline', err);
        if (!keepStoredSession()) settleSignedOutIfLoading();
      });

    // Subscribe once; Supabase SDK emits INITIAL_SESSION too. The queue makes
    // duplicate/rapid events deterministic and prevents interleaved cleanups.
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, nextSession) => {
      logger.auth.info('Auth event', { event });
      // auth-js sends INITIAL_SESSION with null both when nobody is signed in
      // and when the start-up refresh failed for want of a server; only the
      // second leaves a session stored.
      if (event === 'INITIAL_SESSION' && !nextSession && keepStoredSession()) {
        logger.auth.warn('Initial session unavailable from the server; keeping the stored session');
        return;
      }
      enqueueSession(event, nextSession ?? null);
    });

    return () => {
      cancelled = true;
      clearTimeout(fallbackTimer);
      subscription.unsubscribe();
    };
  }, []);

  // Listen for auth:session-expired events dispatched by API layers or token
  // refresh failures. Resets auth state to unauthenticated so the login screen
  // is shown, and surfaces a Hebrew message via the global toast system.
  useEffect(() => {
    const handler = () => {
      logger.auth.info('Session expired — signing out');
      lastPullRef.current = null;
      setSession(null);
      setIsGuest(false);
      setStatus('unauthenticated');
      // Fire the toast via the global singleton (no-op when ToastContainer is unmounted)
      import('../components/ui/GlobalToast')
        .then(({ showToast }) => {
          showToast('החיבור פג. התחבר מחדש.', 'error');
        })
        .catch(() => {
          // ignore — toast is best-effort
        });
    };
    window.addEventListener('auth:session-expired', handler);
    return () => window.removeEventListener('auth:session-expired', handler);
  }, []);

  const skipAuth = useCallback(() => {
    try {
      localStorage.setItem(SKIP_AUTH_STORAGE_KEY, 'true');
    } catch {
      // ignore storage errors
    }
    setIsGuest(true);
    if (!session) setStatus('guest');
  }, [session]);

  const clearGuest = useCallback(() => {
    // Leaving guest mode to sign in: the first account adopts what the guest
    // saved here, instead of the sign-in wiping it (services/guestClaim).
    if (isGuestRef.current) markGuestClaimPending();
    try {
      localStorage.removeItem(SKIP_AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
    setIsGuest(false);
    if (!session) setStatus('unauthenticated');
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      status,
      isGuest,
      skipAuth,
      clearGuest,
    }),
    [session, status, isGuest, skipAuth, clearGuest]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

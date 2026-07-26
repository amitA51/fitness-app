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
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getInviteContinuationCleanupOptions } from '../services/authContinuation';
import { transitionAuthSession } from '../services/authSessionTransition';
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

    const applySession = async (event: string, nextSession: Session | null): Promise<void> => {
      const nextUserId = nextSession?.user.id ?? null;
      try {
        // Preserve an explicitly requested invite continuation only while the
        // authentication round-trip is in progress. All other account state is
        // wiped before a different user's data can be read or pulled.
        await transitionAuthSession(
          nextUserId,
          nextUserId ? (getInviteContinuationCleanupOptions() ?? {}) : {}
        );
      } catch (err) {
        logger.auth.error('Auth transition cleanup failed; refusing to load the session', err);
        if (cancelled) return;
        setSession(null);
        setIsGuest(false);
        setStatus('unauthenticated');
        // A failed wipe must never leave another account's local records visible.
        if (nextSession) {
          void client.auth.signOut().catch((signOutErr) => {
            logger.auth.error('Auth transition safety sign-out failed', signOutErr);
          });
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
        setIsGuest(false);
        setStatus('authenticated');

        // Auto-pull only after transitionAuthSession has fully wiped a prior
        // account. pullAllData merges rows, so this ordering is security-critical.
        if (event === 'SIGNED_IN') {
          import('../services/supabaseSync').then((m) => {
            m.pullAllData().catch(() => {
              // best-effort — offline is fine
            });
          });
        }
      } else {
        setStatus(isGuestRef.current ? 'guest' : 'unauthenticated');
      }
    };

    const enqueueSession = (event: string, nextSession: Session | null): void => {
      transitionQueue = transitionQueue.then(
        () => applySession(event, nextSession),
        () => applySession(event, nextSession)
      );
    };

    // Prime state from the cached session. It goes through the same transition
    // gate as SDK events so a persisted session cannot bypass local cleanup.
    supabase.auth
      .getSession()
      .then(({ data }) => enqueueSession('INITIAL_SESSION', data.session ?? null))
      .catch((err) => {
        if (cancelled) return;
        logger.auth.warn('getSession failed, continuing offline', err);
        setStatus(isGuestRef.current ? 'guest' : 'unauthenticated');
      });

    // Subscribe once; Supabase SDK emits INITIAL_SESSION too. The queue makes
    // duplicate/rapid events deterministic and prevents interleaved cleanups.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      logger.auth.info('Auth event', { event });
      enqueueSession(event, nextSession ?? null);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  // Listen for auth:session-expired events dispatched by API layers or token
  // refresh failures. Resets auth state to unauthenticated so the login screen
  // is shown, and surfaces a Hebrew message via the global toast system.
  useEffect(() => {
    const handler = () => {
      logger.auth.info('Session expired — signing out');
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

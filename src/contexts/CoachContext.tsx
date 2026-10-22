// ============================================================================
// SPARKOS FITNESS - Coach Context
// ============================================================================
// Exposes ONE signal for "which app is this": role / isCoach — the server-side
// SSOT (profiles.role). Coach status is a property of the ACCOUNT, assigned by
// the app owner; everyone defaults to trainee. There is deliberately NO local
// preference that can put a user into the coach shell — the server role decides
// which shell renders AND what the user is allowed to do (RLS-backed).
//
// Lightweight: it only hits the network once when authenticated, and degrades
// gracefully offline/guest.
//
// Never a wall: `loading` clears after at most READ_WAIT_MS even when the
// server does not answer, leaving the cached role from the last visit in place.
// The reads keep running, and a late answer still updates the role.

import type React from 'react';
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
import { getMyCoachProfile, getMySubscription, leaveCoachMode } from '../services/coach';
import { getMyProfile } from '../services/coach/profileService';
import type { CoachProfile, CoachSubscription, UserRole } from '../types/coach';
import { logger } from '../utils/logger';
import { withTimeout } from '../utils/withTimeout';
import { useAuth } from './AuthContext';

/** First-paint hint so a returning coach doesn't flash the trainee shell while
 * the network resolves. The server (profiles.role) always wins on hydration. */
const CACHED_ROLE_KEY = 'cached_role';

/** How long screens that need the role wait for the server before using the cache. */
export const READ_WAIT_MS = 4_000;

const readCachedRole = (): UserRole | null => {
  try {
    const v = localStorage.getItem(CACHED_ROLE_KEY);
    return v === 'coach' || v === 'trainee' ? v : null;
  } catch {
    return null;
  }
};

const writeCachedRole = (role: UserRole | null): void => {
  try {
    if (role) localStorage.setItem(CACHED_ROLE_KEY, role);
    else localStorage.removeItem(CACHED_ROLE_KEY);
  } catch {
    /* best-effort */
  }
};

interface CoachContextValue {
  /** True when the user's server-side role is 'coach'. Decides which shell
   * renders AND what the user may do. */
  isCoach: boolean;
  /** Server-side role (profiles.role); null until resolved (guest/offline). */
  role: UserRole | null;
  coachProfile: CoachProfile | null;
  subscription: CoachSubscription | null;
  /** True until the first server read settles, READ_WAIT_MS at most. While
   * true, `role` / `isCoach` reflect the role cached on the last visit. */
  loading: boolean;
  refresh: () => Promise<void>;
  /** Leave coach mode entirely (server RPC; refuses with active clients). */
  disable: () => Promise<void>;
}

const CoachContext = createContext<CoachContextValue | null>(null);

export const CoachProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { status } = useAuth();
  const [role, setRole] = useState<UserRole | null>(() => readCachedRole());
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);
  const [subscription, setSubscription] = useState<CoachSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  // Bumped on every refresh, so an answer that lands after a newer refresh (or
  // after sign-out) cannot overwrite the newer state.
  const generationRef = useRef(0);

  const refresh = useCallback(async () => {
    const generation = ++generationRef.current;
    if (status !== 'authenticated') {
      // Guests have no cloud identity → trainee semantics, no coach data.
      setRole(null);
      setCoachProfile(null);
      setSubscription(null);
      setLoading(false);
      return;
    }

    // allSettled, not all: one failed read must not throw away the others.
    const settled = Promise.allSettled([
      getMyProfile(),
      getMyCoachProfile(),
      getMySubscription(),
    ]).then(([profileRes, coachRes, subRes]) => {
      if (generation !== generationRef.current) return;
      const profile = profileRes.status === 'fulfilled' ? profileRes.value : null;
      const coachProf = coachRes.status === 'fulfilled' ? coachRes.value : null;
      if (coachRes.status === 'fulfilled') setCoachProfile(coachRes.value);
      if (subRes.status === 'fulfilled') setSubscription(subRes.value);
      for (const res of [profileRes, coachRes, subRes]) {
        if (res.status === 'rejected') logger.app.warn('CoachContext read failed', res.reason);
      }

      // Role SSOT is profiles.role; fall back to the coach_profiles row for
      // resilience if the profile read failed but coach data exists.
      const resolvedRole: UserRole | null = profile?.role ?? (coachProf ? 'coach' : null);
      // No role at all means the reads failed (they return null on error), not
      // that the account has no role. Keep the cached role in that case —
      // flipping a coach to the trainee shell because the server is struggling
      // would be worse than stale.
      if (resolvedRole) {
        setRole(resolvedRole);
        writeCachedRole(resolvedRole);
      }
    });

    try {
      // Screens gated on the role wait READ_WAIT_MS at most. A slower answer is
      // still applied by `settled` when it lands.
      await withTimeout(settled, READ_WAIT_MS, 'CoachContext.refresh');
    } catch (err) {
      logger.app.warn('CoachContext: server slow, continuing with the cached role', err);
    } finally {
      if (generation === generationRef.current) setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const disable = useCallback(async () => {
    await leaveCoachMode();
    setCoachProfile(null);
    await refresh();
  }, [refresh]);

  const value = useMemo<CoachContextValue>(
    () => ({
      isCoach: role === 'coach',
      role,
      coachProfile,
      subscription,
      loading,
      refresh,
      disable,
    }),
    [role, coachProfile, subscription, loading, refresh, disable]
  );

  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
};

export const useCoach = (): CoachContextValue => {
  const ctx = useContext(CoachContext);
  if (!ctx) {
    throw new Error('useCoach must be used within a CoachProvider');
  }
  return ctx;
};

export default CoachContext;

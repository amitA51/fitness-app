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

import type React from 'react';
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getMyCoachProfile, getMySubscription, leaveCoachMode } from '../services/coach';
import { getMyProfile } from '../services/coach/profileService';
import type { CoachProfile, CoachSubscription, UserRole } from '../types/coach';
import { logger } from '../utils/logger';
import { useAuth } from './AuthContext';

/** First-paint hint so a returning coach doesn't flash the trainee shell while
 * the network resolves. The server (profiles.role) always wins on hydration. */
const CACHED_ROLE_KEY = 'cached_role';

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

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') {
      // Guests have no cloud identity → trainee semantics, no coach data.
      setRole(null);
      setCoachProfile(null);
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      const [profile, coachProf, sub] = await Promise.all([
        getMyProfile(),
        getMyCoachProfile(),
        getMySubscription(),
      ]);

      // Role SSOT is profiles.role; fall back to the coach_profiles row for
      // resilience if the profile read failed but coach data exists.
      const resolvedRole: UserRole | null = profile?.role ?? (coachProf ? 'coach' : null);
      setRole(resolvedRole);
      writeCachedRole(resolvedRole);
      setCoachProfile(coachProf);
      setSubscription(sub);
    } catch (err) {
      logger.app.warn('CoachContext refresh failed', err);
      setCoachProfile(null);
      setSubscription(null);
      // Keep the cached role on transient failures — flipping a coach to the
      // trainee shell because one request failed would be worse than stale.
    } finally {
      setLoading(false);
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

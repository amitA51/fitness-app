// ============================================================================
// SPARKOS FITNESS - Coach Context
// ============================================================================
// Exposes the current user's role (coach/trainee — the server-side SSOT from
// profiles.role) plus coach business data (profile + subscription) and the
// enable action. Lightweight: it only hits the network once when
// authenticated, and degrades gracefully offline/guest.

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
import { enableCoachMode, getMyCoachProfile, getMySubscription } from '../services/coach';
import { getMyProfile } from '../services/coach/profileService';
import type { CoachProfile, CoachSubscription, UserRole } from '../types/coach';
import { logger } from '../utils/logger';
import { useAuth } from './AuthContext';

/** Set during onboarding when a user picks the coach role while unauthenticated
 * (guest). Honored here once a real session exists, since enableCoachMode needs
 * an authenticated user id. */
const PENDING_COACH_INTENT_KEY = 'pending_coach_intent';

/** First-paint hint so a returning coach doesn't flash the trainee shell while
 * the network resolves. The server (profiles.role) always wins on hydration. */
const CACHED_ROLE_KEY = 'cached_role';

const readPendingCoachIntent = (): boolean => {
  try {
    return localStorage.getItem(PENDING_COACH_INTENT_KEY) === 'true';
  } catch {
    return false;
  }
};

const clearPendingCoachIntent = (): void => {
  try {
    localStorage.removeItem(PENDING_COACH_INTENT_KEY);
  } catch {
    /* best-effort */
  }
};

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
  /** True when the user's server-side role is 'coach'. */
  isCoach: boolean;
  /** Server-side role (profiles.role); null until resolved (guest/offline). */
  role: UserRole | null;
  coachProfile: CoachProfile | null;
  subscription: CoachSubscription | null;
  loading: boolean;
  refresh: () => Promise<void>;
  enable: (businessName?: string) => Promise<void>;
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
      let [profile, coachProf, sub] = await Promise.all([
        getMyProfile(),
        getMyCoachProfile(),
        getMySubscription(),
      ]);

      // Honor a coach role chosen during onboarding while unauthenticated:
      // promote now that a session exists (atomic become_coach RPC sets
      // coach_profiles + subscription + profiles.role), then clear the flag
      // so we only try once per intent.
      if (profile?.role !== 'coach' && readPendingCoachIntent()) {
        try {
          coachProf = await enableCoachMode();
          [profile, sub] = await Promise.all([getMyProfile(), getMySubscription()]);
        } catch (err) {
          logger.app.warn('CoachContext: pending coach intent enable failed', err);
        }
        clearPendingCoachIntent();
      }

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

  const enable = useCallback(
    async (businessName?: string) => {
      const profile = await enableCoachMode(businessName);
      setCoachProfile(profile);
      await refresh();
    },
    [refresh]
  );

  const value = useMemo<CoachContextValue>(
    () => ({
      isCoach: role === 'coach',
      role,
      coachProfile,
      subscription,
      loading,
      refresh,
      enable,
    }),
    [role, coachProfile, subscription, loading, refresh, enable]
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

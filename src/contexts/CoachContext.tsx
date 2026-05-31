// ============================================================================
// SPARKOS FITNESS - Coach Context
// ============================================================================
// Exposes the current user's coach-mode state (whether enabled, their coach
// profile + subscription) and the enable action. Lightweight: it only hits the
// network once when authenticated, and degrades gracefully offline/guest.

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
import type { CoachProfile, CoachSubscription } from '../types/coach';
import { logger } from '../utils/logger';
import { useAuth } from './AuthContext';

/** Set during onboarding when a user picks the coach role while unauthenticated
 * (guest). Honored here once a real session exists, since enableCoachMode needs
 * an authenticated user id. */
const PENDING_COACH_INTENT_KEY = 'pending_coach_intent';

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

interface CoachContextValue {
  /** True when the user has enabled coach mode (has a coach profile). */
  isCoach: boolean;
  coachProfile: CoachProfile | null;
  subscription: CoachSubscription | null;
  loading: boolean;
  refresh: () => Promise<void>;
  enable: (businessName?: string) => Promise<void>;
}

const CoachContext = createContext<CoachContextValue | null>(null);

export const CoachProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { status } = useAuth();
  const [coachProfile, setCoachProfile] = useState<CoachProfile | null>(null);
  const [subscription, setSubscription] = useState<CoachSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (status !== 'authenticated') {
      setCoachProfile(null);
      setSubscription(null);
      setLoading(false);
      return;
    }
    try {
      let [profile, sub] = await Promise.all([getMyCoachProfile(), getMySubscription()]);

      // Honor a coach role chosen during onboarding while unauthenticated:
      // create the coach_profiles row now that a session exists, then clear the
      // flag so we only try once per intent.
      if (!profile && readPendingCoachIntent()) {
        try {
          profile = await enableCoachMode();
          sub = await getMySubscription();
        } catch (err) {
          logger.app.warn('CoachContext: pending coach intent enable failed', err);
        }
        clearPendingCoachIntent();
      }

      setCoachProfile(profile);
      setSubscription(sub);
    } catch (err) {
      logger.app.warn('CoachContext refresh failed', err);
      setCoachProfile(null);
      setSubscription(null);
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
      isCoach: coachProfile !== null,
      coachProfile,
      subscription,
      loading,
      refresh,
      enable,
    }),
    [coachProfile, subscription, loading, refresh, enable]
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

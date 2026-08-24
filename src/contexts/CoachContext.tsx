// ============================================================================
// SPARKOS FITNESS - Coach Context
// ============================================================================
// Exposes two layered signals:
//   • role / isCoach   — the server-side SSOT (profiles.role). Governs what a
//                        user is ALLOWED to do (RLS-backed permissions).
//   • viewMode / isCoachView — the client-side ACTIVE VIEW. Governs which shell
//                        renders (coach command-center vs. personal trainee app).
// One account can flip between the two views via the top mode bar. The server
// role always backs permissions; the view is a local, persisted preference.
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
import {
  enableCoachMode,
  getMyCoachProfile,
  getMySubscription,
  leaveCoachMode,
} from '../services/coach';
import { getMyProfile } from '../services/coach/profileService';
import type { CoachProfile, CoachSubscription, UserRole, ViewMode } from '../types/coach';
import { logger } from '../utils/logger';
import { useAuth } from './AuthContext';

/**
 * DEMO SWITCH — when true, ANY authenticated user (regardless of server role)
 * can flip into the coach view to preview the coaching shell, and the first
 * flip lazily promotes them via the idempotent become_coach RPC so the coach
 * data path actually works. When false, only real coaches (server role ===
 * 'coach') may toggle — a coach still keeps access to their own personal
 * trainee side.
 *
 * SECURE BY DEFAULT. This used to be `!== 'false'`, i.e. open unless explicitly
 * disabled — so a production deploy that simply forgot the variable silently let
 * every signed-in user promote themselves to coach, outside any commercial funnel.
 * A missing variable must never be the permissive case.
 *
 * Now: development is open (the demo convenience is kept) unless explicitly
 * disabled, while a production build requires an explicit
 * `VITE_DEMO_VIEW_SWITCH='true'` to open it.
 */
const DEMO_OPEN_VIEW_SWITCH =
  import.meta.env.VITE_DEMO_VIEW_SWITCH === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_DEMO_VIEW_SWITCH !== 'false');

/** Set during onboarding when a user picks the coach role while unauthenticated
 * (guest). Honored here once a real session exists, since enableCoachMode needs
 * an authenticated user id. */
const PENDING_COACH_INTENT_KEY = 'pending_coach_intent';

/** First-paint hint so a returning coach doesn't flash the trainee shell while
 * the network resolves. The server (profiles.role) always wins on hydration. */
const CACHED_ROLE_KEY = 'cached_role';

/** The user's explicit active-view choice, persisted across reloads. Absent
 * until the user toggles — until then the view follows the resolved role. */
const VIEW_MODE_KEY = 'view_mode';

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

const readStoredViewMode = (): ViewMode | null => {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    return v === 'coach' || v === 'trainee' ? v : null;
  } catch {
    return null;
  }
};

const writeStoredViewMode = (mode: ViewMode): void => {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* best-effort */
  }
};

interface CoachContextValue {
  /** True when the user's server-side role is 'coach' (permission SSOT). */
  isCoach: boolean;
  /** Server-side role (profiles.role); null until resolved (guest/offline). */
  role: UserRole | null;
  /** The active view shell the user is currently looking at. */
  viewMode: ViewMode;
  /** True when the active view is the coach command-center. Drives routing/nav. */
  isCoachView: boolean;
  /** Whether the user is allowed to flip the active view (demo: anyone). */
  canSwitchView: boolean;
  coachProfile: CoachProfile | null;
  subscription: CoachSubscription | null;
  loading: boolean;
  refresh: () => Promise<void>;
  enable: (businessName?: string) => Promise<void>;
  /** Leave coach mode entirely (server RPC; refuses with active clients). */
  disable: () => Promise<void>;
  /** Switch the active view. Flipping to coach lazily enables coach mode. */
  setViewMode: (mode: ViewMode) => Promise<void>;
  /** Convenience: flip between the two views. */
  toggleView: () => Promise<void>;
}

const CoachContext = createContext<CoachContextValue | null>(null);

export const CoachProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { status } = useAuth();
  const [role, setRole] = useState<UserRole | null>(() => readCachedRole());
  const [viewMode, setViewModeState] = useState<ViewMode>(
    () => readStoredViewMode() ?? (readCachedRole() === 'coach' ? 'coach' : 'trainee')
  );
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

      // Keep the active view aligned to the role for users who never explicitly
      // chose one; an explicit choice (stored) always wins so a coach who
      // stepped into their personal side stays there across reloads.
      if (!readStoredViewMode() && resolvedRole) {
        setViewModeState(resolvedRole === 'coach' ? 'coach' : 'trainee');
      }
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

  const disable = useCallback(async () => {
    await leaveCoachMode();
    // Back to the trainee shell immediately, then re-pull the server role.
    setViewModeState('trainee');
    writeStoredViewMode('trainee');
    setCoachProfile(null);
    await refresh();
  }, [refresh]);

  const setViewMode = useCallback(
    async (mode: ViewMode) => {
      // Reflect the choice immediately (optimistic) + persist it.
      setViewModeState(mode);
      writeStoredViewMode(mode);

      // Flipping into the coach view as a not-yet-coach: lazily promote so the
      // coach data path (RLS) works. Idempotent + best-effort — if it fails
      // (offline / guest), the coach screens simply render their empty states.
      if (mode === 'coach' && role !== 'coach' && status === 'authenticated') {
        try {
          const profile = await enableCoachMode();
          setCoachProfile(profile);
          await refresh();
        } catch (err) {
          logger.app.warn('CoachContext: lazy enableCoachMode on view switch failed', err);
        }
      }
    },
    [role, status, refresh]
  );

  const toggleView = useCallback(
    () => setViewMode(viewMode === 'coach' ? 'trainee' : 'coach'),
    [viewMode, setViewMode]
  );

  const value = useMemo<CoachContextValue>(() => {
    const authed = status === 'authenticated' || status === 'guest';
    // Demo: anyone may preview the coach view. Production: only real coaches
    // (who still keep their personal trainee side) may toggle.
    const canSwitchView = authed && (DEMO_OPEN_VIEW_SWITCH || role === 'coach');
    // In production a stale stored 'coach' from a different account can't leak a
    // trainee into the coach shell — it requires a real coach role there.
    const isCoachView = viewMode === 'coach' && (DEMO_OPEN_VIEW_SWITCH || role === 'coach');
    return {
      isCoach: role === 'coach',
      role,
      viewMode,
      isCoachView,
      canSwitchView,
      coachProfile,
      subscription,
      loading,
      refresh,
      enable,
      disable,
      setViewMode,
      toggleView,
    };
  }, [
    role,
    viewMode,
    status,
    coachProfile,
    subscription,
    loading,
    refresh,
    enable,
    disable,
    setViewMode,
    toggleView,
  ]);

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

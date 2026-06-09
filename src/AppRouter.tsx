import { AnimatePresence, m, useReducedMotion } from 'framer-motion';
import {
  type ReactNode,
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { AgeGate } from './components/consent/AgeGate';
import { ConsentGate } from './components/consent/ConsentGate';
import { WelcomeGuideSheet } from './components/guidance/WelcomeGuideSheet';
import BottomNav from './components/ui/BottomNav';
import { ToastContainer } from './components/ui/GlobalToast';
import { OfflineIndicator } from './components/ui/OfflineIndicator';
import { WorkoutProvider } from './components/workout/core';
import { AgeGateProvider } from './contexts/AgeGateContext';
import { useAuth } from './contexts/AuthContext';
import { CoachProvider, useCoach } from './contexts/CoachContext';
import { ConsentProvider } from './contexts/ConsentContext';
import { DataProvider } from './contexts/DataContext';
import { GuidanceProvider } from './contexts/GuidanceContext';
import { PageThemeProvider } from './contexts/PageThemeContext';
import { PageErrorBoundary } from './errors/PageErrorBoundary';
import { useCloudDataReflection } from './hooks/useCloudDataReflection';
import {
  getActivityLevelFromOnboarding,
  getWeightGoalFromOnboarding,
  saveOnboardingData,
  savePartialOnboardingData,
} from './appOnboarding';
import { PageLoader } from './AppPageLoader';
import { getPageAccent, getPageLabel } from './appPathMeta';
import type { OnboardingData } from './pages/OnboardingFlow';
import { enableCoachMode } from './services/coach';
import { trackPageView } from './services/eventTracker';

import type { PersonalItem } from './types';
import { logger } from './utils/logger';
import { safeJsonParse } from './utils/safeJson';
import { cn } from './utils/styles';

// ============================================================================
// Lazy-loaded pages (code-splitting for better initial bundle size)
// ============================================================================

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Login = lazy(() => import('./pages/Login'));
const Nutrition = lazy(() => import('./pages/Nutrition'));
const OnboardingFlow = lazy(() => import('./pages/OnboardingFlow'));
const Progress = lazy(() => import('./pages/Progress'));
const Settings = lazy(() => import('./pages/Settings'));
const Templates = lazy(() => import('./pages/Templates'));
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail'));

// Coach platform pages
const CoachHome = lazy(() => import('./pages/coach/CoachHome'));
const CoachClients = lazy(() => import('./pages/coach/CoachClients'));
const CoachPrograms = lazy(() => import('./pages/coach/CoachPrograms'));
const CoachInvites = lazy(() => import('./pages/coach/CoachInvites'));
const CoachGroups = lazy(() => import('./pages/coach/CoachGroups'));
const CoachMessages = lazy(() => import('./pages/coach/CoachMessages'));
const MessageThread = lazy(() => import('./pages/coach/MessageThread'));
const ClientDetail = lazy(() => import('./pages/coach/ClientDetail'));
const GroupThread = lazy(() => import('./pages/coach/GroupThread'));
const MyCoach = lazy(() => import('./pages/MyCoach'));
const JoinPage = lazy(() => import('./pages/JoinPage'));
const AccessibilityStatement = lazy(() => import('./pages/AccessibilityStatement'));
const TermsPage = lazy(() => import('./pages/legal/TermsPage'));
const PrivacyPage = lazy(() => import('./pages/legal/PrivacyPage'));

// Wave 2 — community feed, public profile, billing paywall
const CommunityFeed = lazy(() => import('./pages/community/CommunityFeed'));
const PublicProfilePage = lazy(() => import('./pages/profile/PublicProfilePage'));
const PaywallScreen = lazy(() => import('./pages/billing/PaywallScreen'));

const WorkoutContent = lazy(async () => {
  const mod = await import('./components/workout/ActiveWorkoutNew');
  return { default: mod.WorkoutContent };
});

// ============================================================================
// Shared loading fallback with skeleton
// ============================================================================

// Placeholder item for WorkoutProvider
const placeholderItem: PersonalItem = {
  id: 'temp-workout',
  title: 'אימון חדש',
  exercises: [],
  createdAt: '',
};

// Opt into React Router v7 behavior now to silence the future-flag warnings and
// keep the v6→v7 upgrade a no-op.
const ROUTER_FUTURE = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

// ----------------------------------------------------------------------------
// AppRouter — consumes auth context to decide which top-level screen to show.
// ----------------------------------------------------------------------------

export function AppRouter() {
  const { status, isGuest, clearGuest } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean>(
    () => localStorage.getItem('onboarding_completed') === 'true'
  );

  // When the user becomes authenticated or enters guest mode, hydrate profile
  // defaults from any previously saved onboarding data. Mirrors the old
  // checkAuth() hydration so returning users keep their profile.
  useEffect(() => {
    if (status !== 'authenticated' && status !== 'guest') return;
    if (!onboardingDone) return;

    const data = safeJsonParse<OnboardingData>(localStorage.getItem('onboarding_data'));
    if (!data) return;

    // Seed profile/prefs from the onboarding snapshot ONLY when they don't exist
    // yet. The previous unconditional write clobbered edits the user later made
    // in Settings — the stale onboarding values won on every authenticated mount
    // (i.e. every reload). Deliberate profile changes go through Settings /
    // saveOnboardingData; this effect is purely a first-run seed + recovery path
    // for the rare case where the profile keys were cleared but onboarding_data
    // survived.
    if (localStorage.getItem('user_profile') === null) {
      localStorage.setItem(
        'user_profile',
        JSON.stringify({
          name: data.name,
          age: data.age,
          height: data.height,
          weight: data.weight,
          gender: data.gender,
          weightGoal: getWeightGoalFromOnboarding(data.primaryGoal),
          activityLevel: getActivityLevelFromOnboarding(data.experienceLevel),
        })
      );
    }
    if (localStorage.getItem('workout_prefs') === null) {
      localStorage.setItem(
        'workout_prefs',
        JSON.stringify({
          defaultRestTime: data.restBetweenSets,
          autoStartRest: true,
          hapticsEnabled: true,
        })
      );
    }
  }, [status, onboardingDone]);

  const handleOnboardingComplete = useCallback(
    (data: OnboardingData) => {
      saveOnboardingData(data);

      if (data.role === 'coach') {
        // Coach mode creates a coach_profiles row, which needs an authenticated
        // user id. Record the intent so it's honored even across the
        // guest -> sign-up -> sign-in gap; CoachContext reconciles it on mount.
        try {
          localStorage.setItem('pending_coach_intent', 'true');
        } catch (err) {
          logger.app.warn('Failed to persist coach intent', err);
        }

        if (status === 'authenticated') {
          // Already authenticated — enable immediately. CoachContext also
          // reconciles from the flag on mount, so a failure here is recoverable.
          enableCoachMode()
            .then(() => {
              try {
                localStorage.removeItem('pending_coach_intent');
              } catch {
                /* best-effort */
              }
            })
            .catch((err) => logger.app.warn('enableCoachMode on onboarding failed', err));
        } else if (isGuest) {
          // Guests have no user id — coach mode can't be created yet. Send them
          // to the auth screen (onboarding itself is already saved). The stored
          // intent is honored by CoachContext after they sign in.
          clearGuest();
        }
      }

      setOnboardingDone(true);
    },
    [status, isGuest, clearGuest]
  );

  const handleOnboardingSkip = useCallback((data: OnboardingData) => {
    // The skip dialog promises "you can complete this in settings later", so we
    // must not throw away what the user already typed. Persist only the valid,
    // non-empty fields (mirroring the complete path), then mark onboarding done.
    savePartialOnboardingData(data);
    localStorage.setItem('onboarding_completed', 'true');
    setOnboardingDone(true);
  }, []);

  if (status === 'loading') {
    return <PageLoader />;
  }

  if (status === 'unauthenticated') {
    // Legal + accessibility pages must be reachable WITHOUT auth (App Store /
    // Play require Terms + Privacy links outside the login wall). Everything
    // else falls through to the Login screen.
    return (
      <BrowserRouter future={ROUTER_FUTURE}>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/legal/terms" element={<TermsPage />} />
            <Route path="/legal/privacy" element={<PrivacyPage />} />
            <Route path="/accessibility" element={<AccessibilityStatement />} />
            <Route path="*" element={<Login />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  // authenticated or guest — either go through onboarding or into the app.
  if (!onboardingDone) {
    return (
      <Suspense fallback={<PageLoader />}>
        <OnboardingFlow onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />
      </Suspense>
    );
  }

  return (
    <BrowserRouter future={ROUTER_FUTURE}>
      <AgeGateProvider>
        <AgeGate>
          <ConsentProvider>
            <ConsentGate>
              <AppShell />
            </ConsentGate>
          </ConsentProvider>
        </AgeGate>
      </AgeGateProvider>
    </BrowserRouter>
  );
}

// ============================================================================
// Role guards (UX-only — Supabase RLS is the real authorization boundary).
// Every user is classified server-side (profiles.role) as a coach OR a
// trainee. CoachGuard keeps non-coaches out of /coach/*; TraineeGuard keeps
// coaches out of trainee-only surfaces (/my-coach*, /join) — a coach has no
// coach of their own. Guests (local-only, no cloud identity) are trainees.
// RoleHome makes "/" land each role on its own home: coach → /coach command
// center, trainee → personal Dashboard. Coaches reach their own personal
// training surfaces via /me ("האימונים שלי"), which never redirects.
// ============================================================================

function CoachGuard({ children }: { children: ReactNode }) {
  const { isCoach, loading } = useCoach();
  if (loading) return <PageLoader />;
  if (!isCoach) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function TraineeGuard({ children }: { children: ReactNode }) {
  const { isCoach, loading } = useCoach();
  if (loading) return <PageLoader />;
  if (isCoach) return <Navigate to="/coach" replace />;
  return <>{children}</>;
}

function RoleHome() {
  const { isCoach, loading } = useCoach();
  if (loading) return <PageLoader />;
  if (isCoach) return <Navigate to="/coach" replace />;
  return (
    <PageErrorBoundary pageLabel="הדשבורד">
      <Dashboard />
    </PageErrorBoundary>
  );
}

// ============================================================================
// AppRoutes — single source of truth for the route tree.
// Accepts the current location so AnimatePresence can key on pathname changes.
// ============================================================================

function AppRoutes({ location }: { location: ReturnType<typeof useLocation> }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<RoleHome />} />
      {/* Coach personal-training mode ("האימונים שלי") — same Dashboard, but
          never role-redirects, so coaches can reach their own training data. */}
      <Route
        path="/me"
        element={
          <PageErrorBoundary pageLabel="האימונים שלי">
            <Dashboard />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/workout"
        element={
          <PageErrorBoundary pageLabel="אימון">
            <WorkoutPlaceholder />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/workout/:templateId"
        element={
          <PageErrorBoundary pageLabel="אימון">
            <WorkoutPlaceholder />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/nutrition"
        element={
          <PageErrorBoundary pageLabel="עמוד התזונה">
            <Nutrition />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/progress"
        element={
          <PageErrorBoundary pageLabel="עמוד ההתקדמות">
            <Progress />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/templates"
        element={
          <PageErrorBoundary pageLabel="התבניות">
            <Templates />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/detail/:id"
        element={
          <PageErrorBoundary pageLabel="פרטי האימון">
            <WorkoutDetail />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/settings"
        element={
          <PageErrorBoundary pageLabel="ההגדרות">
            <Settings />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/coach"
        element={
          <CoachGuard>
            <PageErrorBoundary pageLabel="מאמן">
              <CoachHome />
            </PageErrorBoundary>
          </CoachGuard>
        }
      />
      <Route
        path="/coach/clients"
        element={
          <CoachGuard>
            <PageErrorBoundary pageLabel="מתאמנים">
              <CoachClients />
            </PageErrorBoundary>
          </CoachGuard>
        }
      />
      <Route
        path="/coach/programs"
        element={
          <CoachGuard>
            <PageErrorBoundary pageLabel="תוכניות">
              <CoachPrograms />
            </PageErrorBoundary>
          </CoachGuard>
        }
      />
      <Route
        path="/coach/invites"
        element={
          <CoachGuard>
            <PageErrorBoundary pageLabel="הזמנות">
              <CoachInvites />
            </PageErrorBoundary>
          </CoachGuard>
        }
      />
      <Route
        path="/coach/groups"
        element={
          <CoachGuard>
            <PageErrorBoundary pageLabel="קבוצות">
              <CoachGroups />
            </PageErrorBoundary>
          </CoachGuard>
        }
      />
      <Route
        path="/coach/messages"
        element={
          <CoachGuard>
            <PageErrorBoundary pageLabel="הודעות">
              <CoachMessages />
            </PageErrorBoundary>
          </CoachGuard>
        }
      />
      <Route
        path="/coach/messages/:otherId"
        element={
          <CoachGuard>
            <PageErrorBoundary pageLabel="שיחה">
              <MessageThread viewer="coach" />
            </PageErrorBoundary>
          </CoachGuard>
        }
      />
      <Route
        path="/coach/clients/:id"
        element={
          <CoachGuard>
            <PageErrorBoundary pageLabel="מתאמן">
              <ClientDetail />
            </PageErrorBoundary>
          </CoachGuard>
        }
      />
      <Route
        path="/coach/groups/:groupId/chat"
        element={
          <CoachGuard>
            <PageErrorBoundary pageLabel="צ׳אט קבוצתי">
              <GroupThread viewer="coach" />
            </PageErrorBoundary>
          </CoachGuard>
        }
      />
      <Route
        path="/my-coach"
        element={
          <TraineeGuard>
            <PageErrorBoundary pageLabel="המאמן שלי">
              <MyCoach />
            </PageErrorBoundary>
          </TraineeGuard>
        }
      />
      <Route
        path="/my-coach/messages/:otherId"
        element={
          <TraineeGuard>
            <PageErrorBoundary pageLabel="שיחה">
              <MessageThread viewer="trainee" />
            </PageErrorBoundary>
          </TraineeGuard>
        }
      />
      <Route
        path="/my-coach/groups/:groupId/chat"
        element={
          <TraineeGuard>
            <PageErrorBoundary pageLabel="צ׳אט קבוצתי">
              <GroupThread viewer="member" />
            </PageErrorBoundary>
          </TraineeGuard>
        }
      />
      {/* /join stays reachable for coaches too — JoinPage itself explains that
          coaches cannot link to another coach (clearer than a silent bounce
          when someone opens an invite deep link). */}
      <Route
        path="/join"
        element={
          <PageErrorBoundary pageLabel="חיבור למאמן">
            <JoinPage />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/accessibility"
        element={
          <PageErrorBoundary pageLabel="הצהרת נגישות">
            <AccessibilityStatement />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/legal/terms"
        element={
          <PageErrorBoundary pageLabel="תנאי שימוש">
            <TermsPage />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/legal/privacy"
        element={
          <PageErrorBoundary pageLabel="מדיניות פרטיות">
            <PrivacyPage />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/community"
        element={
          <PageErrorBoundary pageLabel="קהילה">
            <CommunityFeed />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/u/:userId"
        element={
          <PageErrorBoundary pageLabel="פרופיל ציבורי">
            <PublicProfilePage />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/paywall"
        element={
          <PageErrorBoundary pageLabel="מנוי פרימיום">
            <PaywallScreen />
          </PageErrorBoundary>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Memoized BottomNav to prevent re-renders on location changes within same accent
const MemoizedBottomNav = memo(BottomNav);

// Separate component to render the main app content
function AppShell() {
  const location = useLocation();
  const reduceMotion = useReducedMotion() ?? false;
  // Reflect coach edits to trainee-owned data live (pull-on-mount + realtime
  // merge). Self-guards for guests / unconfigured Supabase.
  useCloudDataReflection();
  const mainRef = useRef<HTMLElement | null>(null);
  const prevPathRef = useRef<string | null>(null);

  const isWorkoutActive = location.pathname.startsWith('/workout');

  const pageAccent = useMemo(() => getPageAccent(location.pathname), [location.pathname]);

  // Live-region text is kept in state so React flushes the DOM update before
  // the rAF fires — guaranteeing screen readers see the new text on the same
  // frame as the focus move (WCAG 2.4.2 / live-region timing fix).
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  useLayoutEffect(() => {
    if (prevPathRef.current) {
      try {
        sessionStorage.setItem(`scroll:${prevPathRef.current}`, String(window.scrollY));
      } catch (error) {
        logger.app.warn('Failed to persist scroll position', error);
      }
    }

    // Resolve the restore target up front (sessionStorage reads only, no layout
    // reads): a stored finite value restores that position, otherwise top.
    let targetY = 0;
    try {
      const raw = sessionStorage.getItem(`scroll:${location.pathname}`);
      if (raw) {
        const y = Number(raw);
        if (Number.isFinite(y)) targetY = y;
      }
    } catch (error) {
      logger.app.warn('Failed to restore scroll position', error);
    }

    // Set document title (WCAG 2.4.2) — one call site, driven by PATH_LABEL_MAP.
    const label = getPageLabel(location.pathname);
    document.title = `${label} — SparkOS Fitness`;

    // Single rAF: scroll + focus + live-region update after the new route paints.
    requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: 'auto' });
      const el = mainRef.current ?? (document.getElementById('main-content') as HTMLElement | null);
      el?.focus({ preventScroll: true });
      // Announce navigation AFTER paint so the live region fires in the same
      // frame as the focus move (avoids the race where the old page is still
      // in the DOM when the region updates).
      setLiveAnnouncement(`ניווט: ${label}`);
    });

    prevPathRef.current = location.pathname;
    trackPageView(location.pathname);
  }, [location.pathname]);

  // Surface any coach-set reminders that are due, as local notifications, while
  // the app is open. (Delivery when the app is closed is handled by Web Push.)
  // The 60s poll is paused while the tab is hidden and resumed on focus, so we
  // don't run timers/IndexedDB work in the background.
  useEffect(() => {
    let active = true;
    let interval: number | null = null;

    const run = () => {
      import('./services/coach/reminderService')
        .then(({ materializeDueReminders }) => {
          if (active) void materializeDueReminders();
        })
        .catch(() => {});
    };

    const start = () => {
      if (interval !== null) return;
      run();
      interval = window.setInterval(run, 60_000);
    };

    const stop = () => {
      if (interval === null) return;
      window.clearInterval(interval);
      interval = null;
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      stop();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return (
    <DataProvider>
      <CoachProvider>
        <GuidanceProvider>
          <PageThemeProvider page={pageAccent}>
            <a href="#main-content" className="skip-link">
              דלג לתוכן הראשי
            </a>
            <div
              className="app-shell min-h-screen min-h-[100dvh] flex flex-col"
              style={{ background: 'var(--fs-bg)', color: 'var(--fs-ink)' }}
            >
              <OfflineIndicator />
              <ToastContainer />
              {/* First-use guidance — auto-opens once, re-launchable from Settings. */}
              <WelcomeGuideSheet />
              <div className="sr-only" aria-live="polite" aria-atomic="true">
                {liveAnnouncement}
              </div>
              {/* Scroll/focus container — IS the <main> landmark. Pages that
                previously rendered their own <main> now use <div> to avoid
                nested-main invalid HTML (Dashboard, coach/_shared). */}
              <main
                ref={mainRef}
                id="main-content"
                className={cn('flex-1 overflow-y-auto')}
                tabIndex={-1}
                style={{
                  contain: 'layout style',
                  ...(!isWorkoutActive && {
                    paddingBottom:
                      'calc(var(--nav-height) + env(safe-area-inset-bottom, 0px) + var(--space-4))',
                  }),
                }}
              >
                <Suspense fallback={<PageLoader />}>
                  {reduceMotion ? (
                    <AppRoutes location={location} />
                  ) : (
                    <AnimatePresence mode="wait" initial={false}>
                      <m.div
                        key={location.pathname}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        // Instant exit (mode="wait" proceeds immediately) so the
                        // outgoing route doesn't fade to a blank gap before the new
                        // one mounts — the incoming page just fades in.
                        exit={{ opacity: 0, transition: { duration: 0 } }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                      >
                        <AppRoutes location={location} />
                      </m.div>
                    </AnimatePresence>
                  )}
                </Suspense>
              </main>
              {!isWorkoutActive && <MemoizedBottomNav />}
            </div>
          </PageThemeProvider>
        </GuidanceProvider>
      </CoachProvider>
    </DataProvider>
  );
}

// ============================================================================
// Workout Placeholder - wraps the actual workout component
// ============================================================================

const noop = () => {};

function WorkoutPlaceholder() {
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId?: string }>();
  const handleExit = useCallback(() => navigate('/'), [navigate]);

  return (
    <WorkoutProvider item={placeholderItem} onUpdate={noop} onExit={handleExit}>
      <Suspense
        fallback={
          <div
            className="flex-center h-64"
            role="status"
            aria-live="polite"
            aria-label="טוען את מסך האימון"
          >
            <div
              className="w-8 h-8 animate-spin"
              style={{
                border: '2px solid var(--fs-primary)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
              }}
            />
          </div>
        }
      >
        <WorkoutContent
          item={placeholderItem}
          onUpdate={noop}
          onExit={handleExit}
          initialTemplateId={templateId}
        />
      </Suspense>
    </WorkoutProvider>
  );
}

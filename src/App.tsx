import { AnimatePresence, MotionConfig, m, useReducedMotion } from 'framer-motion';
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
import BottomNav from './components/ui/BottomNav';
import { ToastContainer } from './components/ui/GlobalToast';
import { OfflineIndicator } from './components/ui/OfflineIndicator';
import { WorkoutProvider } from './components/workout/core';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CoachProvider, useCoach } from './contexts/CoachContext';
import { DataProvider } from './contexts/DataContext';
import { type PageAccent, PageThemeProvider } from './contexts/PageThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { PageErrorBoundary } from './errors/PageErrorBoundary';
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
const CoachInvites = lazy(() => import('./pages/coach/CoachInvites'));
const CoachGroups = lazy(() => import('./pages/coach/CoachGroups'));
const CoachMessages = lazy(() => import('./pages/coach/CoachMessages'));
const MessageThread = lazy(() => import('./pages/coach/MessageThread'));
const ClientDetail = lazy(() => import('./pages/coach/ClientDetail'));
const MyCoach = lazy(() => import('./pages/MyCoach'));
const JoinPage = lazy(() => import('./pages/JoinPage'));

const WorkoutContent = lazy(async () => {
  const mod = await import('./components/workout/ActiveWorkoutNew');
  return { default: mod.WorkoutContent };
});

// ============================================================================
// Shared loading fallback with skeleton
// ============================================================================

function PageLoader() {
  return (
    <div
      className="min-h-screen min-h-[100dvh]"
      role="status"
      aria-live="polite"
      aria-label="טוען"
      style={{ background: 'var(--fs-bg)' }}
    >
      <div style={{ padding: '24px 20px' }}>
        <div
          className="animate-shimmer"
          style={{
            height: 120,
            background:
              'linear-gradient(90deg, var(--fs-surface-2) 25%, var(--fs-surface) 50%, var(--fs-surface-2) 75%)',
            backgroundSize: '200% 100%',
            marginBottom: 16,
          }}
        />
        <div
          className="animate-shimmer"
          style={{
            height: 80,
            background:
              'linear-gradient(90deg, var(--fs-surface-2) 25%, var(--fs-surface) 50%, var(--fs-surface-2) 75%)',
            backgroundSize: '200% 100%',
            marginBottom: 16,
          }}
        />
        <div
          className="animate-shimmer"
          style={{
            height: 200,
            background:
              'linear-gradient(90deg, var(--fs-surface-2) 25%, var(--fs-surface) 50%, var(--fs-surface-2) 75%)',
            backgroundSize: '200% 100%',
          }}
        />
      </div>
    </div>
  );
}

// Placeholder item for WorkoutProvider
const placeholderItem: PersonalItem = {
  id: 'temp-workout',
  title: 'אימון חדש',
  exercises: [],
  createdAt: '',
};

// ============================================================================
// Path-to-accent mapping (constant, no re-creation)
// ============================================================================

const PATH_ACCENT_MAP: Array<[RegExp, PageAccent]> = [
  [/^\/$/, 'dashboard'],
  [/^\/workout/, 'workout'],
  [/^\/nutrition/, 'nutrition'],
  [/^\/progress/, 'progress'],
  [/^\/templates/, 'templates'],
  [/^\/detail/, 'history'],
  [/^\/settings/, 'settings'],
];

const PATH_LABEL_MAP: Array<[RegExp, string]> = [
  [/^\/$/, 'דשבורד'],
  [/^\/workout/, 'אימון'],
  [/^\/nutrition/, 'תזונה'],
  [/^\/progress/, 'התקדמות'],
  [/^\/templates/, 'תבניות'],
  [/^\/detail/, 'פרטי אימון'],
  [/^\/settings/, 'הגדרות'],
];

function getPageAccent(path: string): PageAccent {
  for (const [regex, accent] of PATH_ACCENT_MAP) {
    if (regex.test(path)) return accent;
  }
  return 'dashboard';
}

function getPageLabel(path: string): string {
  for (const [regex, label] of PATH_LABEL_MAP) {
    if (regex.test(path)) return label;
  }
  return 'מסך';
}

// ============================================================================
// App Component
// ============================================================================

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <SettingsProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </SettingsProvider>
    </MotionConfig>
  );
}

// ----------------------------------------------------------------------------
// AppRouter — consumes auth context to decide which top-level screen to show.
// ----------------------------------------------------------------------------

function AppRouter() {
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
    localStorage.setItem(
      'workout_prefs',
      JSON.stringify({
        defaultRestTime: data.restBetweenSets,
        autoStartRest: true,
        hapticsEnabled: true,
      })
    );
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
    return (
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Login />
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
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

// ============================================================================
// Role guards (UX-only — Supabase RLS is the real authorization boundary).
// CoachGuard keeps non-coaches out of /coach/*. There is intentionally no
// trainee guard: a trainee is the DEFAULT role, and a guest (local-only, no
// cloud identity) is treated as a trainee. /my-coach renders for everyone —
// without a session the coach services simply return an empty state (the
// "connect with a coach via invite code" entry point), never an auth bounce.
// ============================================================================

function CoachGuard({ children }: { children: ReactNode }) {
  const { isCoach, loading } = useCoach();
  if (loading) return <PageLoader />;
  if (!isCoach) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// ============================================================================
// AppRoutes — single source of truth for the route tree.
// Accepts the current location so AnimatePresence can key on pathname changes.
// ============================================================================

function AppRoutes({ location }: { location: ReturnType<typeof useLocation> }) {
  return (
    <Routes location={location}>
      <Route
        path="/"
        element={
          <PageErrorBoundary pageLabel="הדשבורד">
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
        path="/my-coach"
        element={
          <PageErrorBoundary pageLabel="המאמן שלי">
            <MyCoach />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/my-coach/messages/:otherId"
        element={
          <PageErrorBoundary pageLabel="שיחה">
            <MessageThread viewer="trainee" />
          </PageErrorBoundary>
        }
      />
      <Route
        path="/join"
        element={
          <PageErrorBoundary pageLabel="חיבור למאמן">
            <JoinPage />
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
  const mainRef = useRef<HTMLElement | null>(null);
  const prevPathRef = useRef<string | null>(null);

  const isWorkoutActive = location.pathname.startsWith('/workout');

  const pageAccent = useMemo(() => getPageAccent(location.pathname), [location.pathname]);
  const pageLabel = useMemo(() => getPageLabel(location.pathname), [location.pathname]);

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

    // Single rAF: scroll + focus together after the new route paints.
    requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, behavior: 'auto' });
      const el = mainRef.current ?? (document.getElementById('main-content') as HTMLElement | null);
      el?.focus({ preventScroll: true });
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
            <div className="sr-only" aria-live="polite">
              {pageLabel}
            </div>
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
                      exit={{ opacity: 0 }}
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

// ============================================================================
// HELPER FUNCTIONS (defined outside App — no hooks)
// ============================================================================

function getWeightGoalFromOnboarding(goal: string): string {
  switch (goal) {
    case 'strength':
    case 'muscle':
      return 'עלייה במסה';
    case 'weight_loss':
      return 'ירידה במשקל';
    default:
      return 'שמירה על משקל';
  }
}

function getActivityLevelFromOnboarding(level: string): string {
  switch (level) {
    case 'beginner':
      return 'פעיל מעט';
    case 'intermediate':
      return 'פעיל מתון';
    case 'advanced':
      return 'פעיל מאוד';
    default:
      return 'פעיל מתון';
  }
}

function saveOnboardingData(data: OnboardingData) {
  localStorage.setItem('onboarding_data', JSON.stringify(data));
  localStorage.setItem('onboarding_completed', 'true');
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
  localStorage.setItem(
    'workout_prefs',
    JSON.stringify({
      defaultRestTime: data.restBetweenSets,
      autoStartRest: true,
      hapticsEnabled: true,
    })
  );
}

// A wizard field counts as "filled" when it's neither the empty-string sentinel
// (the OnboardingData default for unset text/number/select fields) nor null.
function isFilled(value: unknown): boolean {
  return value !== '' && value !== null && value !== undefined;
}

// Persist only the fields the user actually filled in before skipping. Unlike
// saveOnboardingData this never writes empty sentinels into the saved profile,
// so a half-completed wizard yields a partial — but truthful — profile that the
// user can finish in Settings later (the skip dialog's promise).
function savePartialOnboardingData(data: OnboardingData) {
  // Keep the raw draft so re-entering onboarding / hydration can resume it.
  localStorage.setItem('onboarding_data', JSON.stringify(data));

  const profile: Record<string, unknown> = {};
  if (isFilled(data.name)) profile.name = data.name;
  if (isFilled(data.age)) profile.age = data.age;
  if (isFilled(data.height)) profile.height = data.height;
  if (isFilled(data.weight)) profile.weight = data.weight;
  if (isFilled(data.gender)) profile.gender = data.gender;
  if (isFilled(data.primaryGoal)) {
    profile.weightGoal = getWeightGoalFromOnboarding(data.primaryGoal);
  }
  if (isFilled(data.experienceLevel)) {
    profile.activityLevel = getActivityLevelFromOnboarding(data.experienceLevel);
  }

  // Merge onto any existing profile so we never clobber previously saved values
  // with nothing — immutable build, single write.
  if (Object.keys(profile).length > 0) {
    const existing = safeJsonParse<Record<string, unknown>>(localStorage.getItem('user_profile'));
    localStorage.setItem('user_profile', JSON.stringify({ ...(existing ?? {}), ...profile }));
  }

  // restBetweenSets always has a sensible default in the wizard, so the workout
  // prefs are worth persisting even on skip.
  if (isFilled(data.restBetweenSets)) {
    localStorage.setItem(
      'workout_prefs',
      JSON.stringify({
        defaultRestTime: data.restBetweenSets,
        autoStartRest: true,
        hapticsEnabled: true,
      })
    );
  }
}

export default App;

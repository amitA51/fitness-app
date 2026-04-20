// ============================================================================
// SPARKOS FITNESS - Root App Component
// ============================================================================

import { memo, Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
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
import { WorkoutProvider } from './components/workout/core';
import { DataProvider } from './contexts/DataContext';
import { type PageAccent, PageThemeProvider } from './contexts/PageThemeContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { PageErrorBoundary } from './errors/PageErrorBoundary';
import type { OnboardingData } from './pages/OnboardingFlow';
import type { WorkoutExercise } from './types';
import { logger } from './utils/logger';
import { safeJsonParse } from './utils/safeJson';
import { cn } from './utils/styles';
import { getSession } from './services/supabaseAuth';
import { initOfflineSync } from './services/offlineQueue';

// ============================================================================
// Lazy-loaded pages (code-splitting for better initial bundle size)
// ============================================================================

const Dashboard = lazy(() => import('./pages/Dashboard'));
const History = lazy(() => import('./pages/History'));
const Login = lazy(() => import('./pages/Login'));
const Nutrition = lazy(() => import('./pages/Nutrition'));
const OnboardingFlow = lazy(() => import('./pages/OnboardingFlow'));
const Progress = lazy(() => import('./pages/Progress'));
const Settings = lazy(() => import('./pages/Settings'));
const Templates = lazy(() => import('./pages/Templates'));
const WorkoutDetail = lazy(() => import('./pages/WorkoutDetail'));

const WorkoutContent = lazy(async () => {
  const mod = await import('./components/workout/ActiveWorkoutNew');
  return { default: mod.WorkoutContent };
});

// ============================================================================
// Route prefetch map - prefetch on hover/focus for instant navigation
// ============================================================================

const routePrefetchMap: Record<string, () => Promise<unknown>> = {
  '/': () => import('./pages/Dashboard'),
  '/history': () => import('./pages/History'),
  '/nutrition': () => import('./pages/Nutrition'),
  '/progress': () => import('./pages/Progress'),
  '/settings': () => import('./pages/Settings'),
  '/templates': () => import('./pages/Templates'),
  '/workout': () => import('./components/workout/ActiveWorkoutNew'),
};

const prefetchedRoutes = new Set<string>();

export function prefetchRoute(path: string) {
  const base = path.split('/')[1] ? `/${path.split('/')[1]}` : '/';
  const key = base === '/history' || base === '/workout' ? path.replace(/\/[^/]+$/, '') : base;
  const loader = routePrefetchMap[key];
  if (loader && !prefetchedRoutes.has(key)) {
    prefetchedRoutes.add(key);
    loader();
  }
}

// ============================================================================
// Shared loading fallback with skeleton
// ============================================================================

function PageLoader() {
  return (
    <div
      className="min-h-screen bg-bone"
      role="status"
      aria-live="polite"
      aria-label="טוען"
    >
      <div style={{ padding: '24px 20px' }}>
        <div className="animate-shimmer" style={{
          height: 120,
          background: 'linear-gradient(90deg, var(--bone-deep) 25%, var(--bone-faint) 50%, var(--bone-deep) 75%)',
          backgroundSize: '200% 100%',
          marginBottom: 16,
        }} />
        <div className="animate-shimmer" style={{
          height: 80,
          background: 'linear-gradient(90deg, var(--bone-deep) 25%, var(--bone-faint) 50%, var(--bone-deep) 75%)',
          backgroundSize: '200% 100%',
          marginBottom: 16,
        }} />
        <div className="animate-shimmer" style={{
          height: 200,
          background: 'linear-gradient(90deg, var(--bone-deep) 25%, var(--bone-faint) 50%, var(--bone-deep) 75%)',
          backgroundSize: '200% 100%',
        }} />
      </div>
    </div>
  );
}

// Placeholder item for WorkoutProvider
const placeholderItem: {
  id: string;
  title: string;
  exercises: WorkoutExercise[];
} = {
  id: 'temp-workout',
  title: 'אימון חדש',
  exercises: [],
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
  [/^\/history/, 'history'],
  [/^\/settings/, 'settings'],
];

const PATH_LABEL_MAP: Array<[RegExp, string]> = [
  [/^\/$/, 'דשבורד'],
  [/^\/workout/, 'אימון'],
  [/^\/nutrition/, 'תזונה'],
  [/^\/progress/, 'התקדמות'],
  [/^\/templates/, 'תבניות'],
  [/^\/history/, 'היסטוריה'],
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
  const [appState, setAppState] = useState<'loading' | 'login' | 'onboarding' | 'app'>('loading');

  useEffect(() => {
    initOfflineSync();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const session = await getSession();
      const onboardingDone = localStorage.getItem('onboarding_completed') === 'true';

      if (!session) {
        setAppState('login');
        return;
      }

      if (!onboardingDone) {
        setAppState('onboarding');
        return;
      }

      const data = safeJsonParse<OnboardingData>(localStorage.getItem('onboarding_data'));
      if (data) {
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
      setAppState('app');
    };

    checkAuth();
  }, []);

  useEffect(() => {
    const handleAuthChange = () => {
      const check = async () => {
        const session = await getSession();
        const onboardingDone = localStorage.getItem('onboarding_completed') === 'true';
        if (!session) { setAppState('login'); return; }
        if (!onboardingDone) { setAppState('onboarding'); return; }
        setAppState('app');
      };
      check();
    };

    const handleSkipAuth = () => {
      localStorage.setItem('onboarding_completed', 'true');
      setAppState('app');
    };

    window.addEventListener('supabase_auth_change', handleAuthChange);
    window.addEventListener('skip_auth', handleSkipAuth);
    return () => {
      window.removeEventListener('supabase_auth_change', handleAuthChange);
      window.removeEventListener('skip_auth', handleSkipAuth);
    };
  }, []);

  const handleOnboardingComplete = useCallback((data: OnboardingData) => {
    saveOnboardingData(data);
    setAppState('app');
  }, []);

  const handleOnboardingSkip = useCallback(() => {
    localStorage.setItem('onboarding_completed', 'true');
    setAppState('app');
  }, []);

  if (appState === 'loading') {
    return <PageLoader />;
  }

  if (appState === 'login') {
    return (
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Login />
        </Suspense>
      </BrowserRouter>
    );
  }

  if (appState === 'onboarding') {
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

// Memoized BottomNav to prevent re-renders on location changes within same accent
const MemoizedBottomNav = memo(BottomNav);

// Separate component to render the main app content
function AppShell() {
  const location = useLocation();
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

    const key = `scroll:${location.pathname}`;
    let restored = false;
    try {
      const raw = sessionStorage.getItem(key);
      if (raw) {
        const y = Number(raw);
        if (Number.isFinite(y)) {
          requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'auto' }));
          restored = true;
        }
      }
    } catch (error) {
      logger.app.warn('Failed to restore scroll position', error);
    }

    if (!restored) {
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    }

    requestAnimationFrame(() => {
      const el = mainRef.current ?? (document.getElementById('main-content') as HTMLElement | null);
      el?.focus({ preventScroll: true });
    });

    prevPathRef.current = location.pathname;
  }, [location.pathname]);

  return (
    <SettingsProvider>
      <DataProvider>
        <PageThemeProvider page={pageAccent}>
          <a href="#main-content" className="skip-link">
            דלג לתוכן הראשי
          </a>
          <div className="app-shell min-h-screen flex flex-col bg-bone text-ink">
            <div className="sr-only" aria-live="polite">
              {pageLabel}
            </div>
            <main
              ref={(el) => {
                mainRef.current = el;
              }}
              id="main-content"
              className={cn('flex-1', !isWorkoutActive && 'pb-24')}
              tabIndex={-1}
              style={{ contain: 'layout style' }}
            >
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route
                    path="/"
                    element={
                      <PageErrorBoundary pageLabel="הדשבורד">
                        <Dashboard />
                      </PageErrorBoundary>
                    }
                  />
                  <Route path="/workout" element={<WorkoutPlaceholder />} />
                  <Route path="/workout/:templateId" element={<WorkoutPlaceholder />} />
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
                    path="/history"
                    element={
                      <PageErrorBoundary pageLabel="היסטוריית האימונים">
                        <History />
                      </PageErrorBoundary>
                    }
                  />
                  <Route
                    path="/history/:id"
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
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </main>
            {!isWorkoutActive && <MemoizedBottomNav />}
          </div>
        </PageThemeProvider>
      </DataProvider>
    </SettingsProvider>
  );
}

// ============================================================================
// Workout Placeholder - wraps the actual workout component
// ============================================================================

function WorkoutPlaceholder() {
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId?: string }>();

  return (
    <WorkoutProvider item={placeholderItem} onUpdate={() => {}} onExit={() => navigate('/')}>
      <Suspense
        fallback={
          <div
            className="flex-center h-64"
            role="status"
            aria-live="polite"
            aria-label="טוען את מסך האימון"
          >
            <div className="w-8 h-8 border-2 border-navy border-t-transparent animate-spin" />
          </div>
        }
      >
        <WorkoutContent
          item={placeholderItem}
          onUpdate={() => {}}
          onExit={() => navigate('/')}
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
    case 'endurance':
    case 'general':
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

export default App;

// ============================================================================
// Route Prefetch Utility - prefetch lazy-loaded routes on hover/focus
// ============================================================================

const routePrefetchMap: Record<string, () => Promise<unknown>> = {
  '/': () => import('../pages/Dashboard'),
  '/me': () => import('../pages/Dashboard'),
  '/nutrition': () => import('../pages/Nutrition'),
  '/progress': () => import('../pages/Progress'),
  '/settings': () => import('../pages/Settings'),
  '/templates': () => import('../pages/Templates'),
  '/workout': () => import('../components/workout/ActiveWorkoutNew'),
  '/coach': () => import('../pages/coach/CoachHome'),
  '/my-coach': () => import('../pages/MyCoach'),
};

const prefetchedRoutes = new Set<string>();

export function prefetchRoute(path: string) {
  const base = path.split('/')[1] ? `/${path.split('/')[1]}` : '/';
  const key = base === '/detail' || base === '/workout' ? path.replace(/\/[^/]+$/, '') : base;
  const loader = routePrefetchMap[key];
  if (loader && !prefetchedRoutes.has(key)) {
    prefetchedRoutes.add(key);
    loader().catch(() => {});
  }
}

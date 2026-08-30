// ============================================================================
// Dashboard → the PAGE CONTAINER. Pins the cap AND the single-payment bottom
// clearance.
//
// Dashboard already had `.page-shell` on its content column (it is the pattern
// the other pages were fixed toward). Its own defect was different and smaller:
// it paid the fixed-nav bottom clearance TWICE — an inline
// `paddingBottom: max(7rem, calc(4rem + env(safe-area-inset-bottom)))` on the
// outer wash AND `.page-shell`'s own `calc(var(--nav-height) + 28px + env(…))`
// on the inner column. At safe-area inset 0 that stacked 112px + 92px = ~204px
// of dead space under the last card. The inline one is gone; `.page-shell` owns
// the clearance.
//
// The inline-style assertion here is a REAL measurement, not a CSS-resolution
// guess: an inline `style` attribute is readable in jsdom without a stylesheet.
// The `.page-shell` half of the pair is a structural contract, for the reason
// below.
//
// WHY THE CAP IS ASSERTED ON STRUCTURE AND NOT ON PIXELS
// jsdom has no layout engine, and this project runs Vitest with `css: false`
// (vitest.config.ts), so no stylesheet is loaded into the test document at all.
// `getComputedStyle(el).maxWidth` cannot resolve `var(--max-width)` here and any
// width number would be fiction.
// ============================================================================

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/DataContext', () => ({
  useData: () => ({ sessions: [], refreshData: vi.fn(), loading: false }),
}));

vi.mock('../../hooks/fitness/useFitnessInsights', () => ({
  useFitnessInsights: () => ({
    workoutSessions: [],
    weekOverWeekDeltas: [],
    muscleGroups: [],
    error: null,
  }),
}));

vi.mock('../../hooks/usePullToRefresh', () => ({
  usePullToRefresh: () => ({
    isPulling: false,
    isRefreshing: false,
    pullDistance: 0,
    threshold: 80,
    handlers: {},
  }),
}));

vi.mock('../../contexts/CoachContext', () => ({
  useCoach: () => ({ isCoach: false, activeClientId: null, loading: false }),
}));

// ── Services Dashboard reaches at mount (Supabase / IndexedDB). They return a
//    promise that never settles, so no state update lands after the assertions
//    and there is no act() warning to paper over. ─────────────────────────────
const pending = () => new Promise<never>(() => undefined);

vi.mock('../../services/workoutDb', () => ({ getWorkoutTemplates: () => pending() }));
vi.mock('../../services/dataEvents', () => ({ onWorkoutSaved: () => () => undefined }));
vi.mock('../../services/supabaseAuth', () => ({ getCurrentUser: () => pending() }));
vi.mock('../../services/coach/relationshipService', () => ({
  listMyCoaches: () => pending(),
}));

// ── Child components, stubbed to keep the render surface to Dashboard's own
//    container JSX. DashboardHeader is a SIBLING of the capped column. ───────
vi.mock('../../components/dashboard/DashboardHeader', () => ({ DashboardHeader: () => null }));
vi.mock('../../components/dashboard/InsightCard', () => ({ InsightCard: () => null }));
vi.mock('../../components/dashboard/ProgramCard', () => ({ ProgramCard: () => null }));
vi.mock('../../components/dashboard/StartWorkoutSheet', () => ({ StartWorkoutSheet: () => null }));
vi.mock('../../components/dashboard/TemplateQuickStart', () => ({ TemplateStrip: () => null }));
vi.mock('../../components/dashboard/TodaysWorkoutCard', () => ({ TodaysWorkoutCard: () => null }));
vi.mock('../../components/dashboard/WeeklyGrid', () => ({ WeeklyGrid: () => null }));
vi.mock('../../components/dashboard/WorkoutStreak', () => ({ WorkoutStreak: () => null }));
vi.mock('../../components/guidance/CoachMark', () => ({ CoachMark: () => null }));

import Dashboard from '../Dashboard';

/**
 * Renders the page and hands back the two layers under test:
 *   wash   — the full-bleed background/ambient-mesh element
 *   column — the capped content container
 */
function renderPage() {
  const { container } = render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

  return {
    container,
    wash: container.querySelector('.ambient-mesh'),
    column: container.querySelector('.page-shell'),
  };
}

describe('Dashboard pays the bottom clearance exactly once', () => {
  it('keeps the content in a .page-shell column', () => {
    // Dashboard is the reference for the other pages — if this class goes, the
    // pattern the rest were fixed toward has no anchor left.
    const { column } = renderPage();

    expect(column).not.toBeNull();
  });

  it('does NOT also set a bottom padding on the outer wash', () => {
    // The duplication bug, pinned. `.page-shell` supplies
    // calc(var(--nav-height) + 28px + env(safe-area-inset-bottom)); an inline
    // paddingBottom here stacks a second ~112px on top of it.
    const { wash } = renderPage();

    expect(wash).not.toBeNull();
    expect((wash as HTMLElement).style.paddingBottom).toBe('');
    expect(wash?.className ?? '').not.toMatch(/\bpb-/);
  });

  it('keeps the wash full-bleed on a separate ancestor layer', () => {
    // Capping the element that carries the ambient mesh would shrink the
    // background to a 480px strip down the middle of a wide page.
    const { wash, column } = renderPage();

    expect(wash).not.toBe(column);
    expect(wash).toContainElement(column as HTMLElement);
    expect(wash?.className ?? '').not.toContain('page-shell');
  });
});

// ============================================================================
// WorkoutDetail → the PAGE CONTAINER. Pins the 480px content cap.
//
// The defect: this page had NO width cap. At a 1280px viewport every stat card
// ran the full viewport, so "שעת התחלה" sat at one end of a row and its time
// value ~1200px away at the other and the pair stopped reading as one row.
// Fixed by adopting `.page-shell`, the house container in components.css,
// exactly as Settings and the warmup screen were.
//
// The sticky glass header is deliberately NOT in the column: it is chrome on the
// same full-bleed layer as the wash, matching Settings / Dashboard where
// PageHeader also sits outside the capped column.
//
// WHY THIS FILE ASSERTS ON STRUCTURE AND NOT ON PIXELS
// jsdom has no layout engine, and this project runs Vitest with `css: false`
// (vitest.config.ts), so no stylesheet is loaded into the test document at all.
// `getComputedStyle(el).maxWidth` cannot resolve `var(--max-width)` here and any
// width number would be fiction. What IS verifiable — and what regressed — is
// the CONTRACT: the content column opts into the house container, does not
// hand-roll a competing rule, and the page wash stays a separate full-bleed
// layer. The 480px value itself lives in tokens.css and is pinned there.
//
// The three failure modes each assertion below catches:
//   1. someone drops `.page-shell` again          → the cap silently vanishes
//   2. someone re-hand-rolls `max-w-*` / `pb-[…]` → two rules fight, drift
//   3. someone caps the WASH instead of the column → the ambient mesh shrinks
//      to a 480px strip down the middle of a wide page
// ============================================================================

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '../../types';

const SESSION: WorkoutSession = {
  id: 'session-1',
  date: '2026-05-20',
  startTime: '2026-05-20T06:30:00.000Z',
  endTime: '2026-05-20T07:15:00.000Z',
  exercises: [],
  duration: 2700,
  status: 'completed',
  templateId: null,
  notes: '',
  rating: 4,
  totalVolume: 4200,
  caloriesBurned: null,
  createdAt: '2026-05-20T07:15:00.000Z',
  updatedAt: '2026-05-20T07:15:00.000Z',
};

vi.mock('../workout-detail/useWorkoutDetail', () => ({
  useWorkoutDetail: () => ({
    session: SESSION,
    previousSession: null,
    loading: false,
    error: null,
  }),
}));

// Leaf presentational pieces, stubbed so the render surface stays this page's
// own container JSX.
vi.mock('../workout-detail/MuscleBreakdown', () => ({ MuscleBreakdown: () => null }));
vi.mock('../../components/fitness/WorkoutComparison', () => ({ WorkoutComparison: () => null }));

import WorkoutDetail from '../WorkoutDetail';

/**
 * Renders the page at /workout/:id and hands back the two layers under test:
 *   wash   — the full-bleed background/ambient-mesh element
 *   column — the capped content container
 */
function renderPage() {
  const { container } = render(
    <MemoryRouter initialEntries={['/workout/session-1']}>
      <Routes>
        <Route path="/workout/:id" element={<WorkoutDetail />} />
      </Routes>
    </MemoryRouter>
  );

  return {
    container,
    wash: container.querySelector('.ambient-mesh'),
    column: container.querySelector('.page-shell'),
  };
}

describe('WorkoutDetail caps its content column with the house .page-shell container', () => {
  it('puts the content in a .page-shell column, which is where the 480px cap comes from', () => {
    // This is the whole fix. `.page-shell` (components.css) carries
    // max-width: var(--max-width) → 480px (tokens.css). Without this class the
    // page has no cap whatsoever and stretches to the full viewport.
    const { column } = renderPage();

    expect(column).not.toBeNull();
  });

  it('wraps the stat cards in that capped column, not an empty wrapper', () => {
    // A cap on a container that does not hold the rows would fix nothing — the
    // ~1200px label/value split was INSIDE the content div.
    const { column } = renderPage();

    expect(column).toContainElement(screen.getByText('שעת התחלה'));
  });

  it('leaves the sticky header outside the column, on the full-bleed layer', () => {
    // The header is chrome, not content. It carries `.glass-surface` and paints
    // edge to edge; capping it would leave a 480px glass island.
    const { container, column } = renderPage();
    const header = container.querySelector('.glass-surface');

    expect(header).not.toBeNull();
    expect(column).not.toContainElement(header as HTMLElement);
  });

  it('does NOT re-implement the cap or the bottom padding on the column', () => {
    // Adopt the house container, do not hand-roll beside it. A `max-w-*`
    // utility or a `pb-[max(100px,…)]` arbitrary value here means two rules are
    // competing and one of them will drift.
    const { column } = renderPage();
    const cls = column?.className ?? '';

    expect(cls).toContain('page-shell');
    expect(cls).not.toMatch(/max-w-/);
    expect(cls).not.toMatch(/\bpb-\[/);
  });

  it('keeps the page wash full-bleed on a separate ancestor layer', () => {
    // The wash and the content column are different concerns. Capping the
    // element that carries the ambient mesh would shrink the background to a
    // 480px strip down the middle of a wide page — a visible regression in the
    // opposite direction.
    const { wash, column } = renderPage();

    expect(wash).not.toBeNull();
    expect(wash).not.toBe(column);
    expect(wash).toContainElement(column as HTMLElement);
    expect(wash?.className ?? '').not.toContain('page-shell');
    // …and the wash must not keep the old hand-rolled bottom padding either;
    // `.page-shell` owns that now, so leaving it here would double it up.
    expect(wash?.className ?? '').not.toMatch(/\bpb-\[/);
  });
});

// ============================================================================
// PublicProfilePage → the PAGE CONTAINER. Pins the 480px content cap.
//
// The defect: this page had NO width cap. At a 1280px viewport the profile card
// and the achievement grid ran the full viewport, so a three-column badge grid
// stretched to ~400px per cell and the avatar/name block floated in the middle
// of an ocean. Fixed by adopting `.page-shell`, the house container in
// components.css, exactly as Settings and the warmup screen were.
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
//
// The page's four states (loading / empty / error / success) all render through
// the same in-file `PageShell`, so the container contract is proven once. The
// profile service is stubbed with a promise that never settles, which parks the
// page in its loading state — deterministic, and no act() warnings from a state
// flip mid-assertion.
// ============================================================================

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

/** A promise that never settles — parks the page in its loading state. */
const pending = () => new Promise<never>(() => undefined);

vi.mock('../../../services/profile/profileService', () => ({
  getPublicProfile: () => pending(),
  getUserAchievements: () => pending(),
  listAchievements: () => pending(),
}));

// PageHeader is a SIBLING of the capped column, not part of it — stub it so the
// only thing in the tree is this page's own container JSX.
vi.mock('../../../components/ui/PageHeader', () => ({ default: () => null }));

import PublicProfilePage from '../PublicProfilePage';

/**
 * Renders the page at /u/:userId and hands back the two layers under test:
 *   wash   — the full-bleed background/ambient-mesh element
 *   column — the capped content container
 */
function renderPage() {
  const { container } = render(
    <MemoryRouter initialEntries={['/u/user-1']}>
      <Routes>
        <Route path="/u/:userId" element={<PublicProfilePage />} />
      </Routes>
    </MemoryRouter>
  );

  return {
    container,
    wash: container.querySelector('.ambient-mesh'),
    column: container.querySelector('.page-shell'),
  };
}

describe('PublicProfilePage caps its content column with the house .page-shell container', () => {
  it('puts the content in a .page-shell column, which is where the 480px cap comes from', () => {
    // This is the whole fix. `.page-shell` (components.css) carries
    // max-width: var(--max-width) → 480px (tokens.css). Without this class the
    // page has no cap whatsoever and stretches to the full viewport.
    const { column } = renderPage();

    expect(column).not.toBeNull();
  });

  it('wraps the page content in that capped column, not an empty wrapper', () => {
    // A cap on a container that does not actually hold the cards would fix
    // nothing — the stretched grid was INSIDE <main>.
    const { column } = renderPage();

    expect(column?.tagName).toBe('MAIN');
    expect(column).toContainElement(screen.getByLabelText('טוען פרופיל'));
  });

  it('does NOT re-implement the cap or the bottom padding on the column', () => {
    // Adopt the house container, do not hand-roll beside it. A `max-w-*`
    // utility or a `pb-[max(7rem,…)]` arbitrary value here means two rules are
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

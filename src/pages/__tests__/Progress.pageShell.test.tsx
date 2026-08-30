// ============================================================================
// Progress → the PAGE CONTAINER. Pins the 480px content cap.
//
// The defect: this page had NO width cap. At a 1280px viewport the four-tab bar
// stretched across the whole viewport (each `flex: 1` tab ~310px wide) and the
// panels below ran the same width, so a stat's label sat hundreds of px from its
// value. Fixed by adopting `.page-shell`, the house container in components.css,
// exactly as Settings and the warmup screen were.
//
// ONE shell, not two: the tab bar and the tab panels are a single content
// column, so they share one `.page-shell`. Putting the class on each would pay
// `.page-shell`'s fixed-nav bottom clearance twice — once as ~92px of dead space
// between the tabs and the panel they control.
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
// The failure modes each assertion below catches:
//   1. someone drops `.page-shell` again          → the cap silently vanishes
//   2. someone re-hand-rolls `max-w-*` / `pb-[…]` → two rules fight, drift
//   3. someone caps the WASH instead of the column → the ambient mesh shrinks
//      to a 480px strip down the middle of a wide page
//   4. the tab bar drifts out of the column        → tabs stretch while the
//      panel they control stays capped
// ============================================================================

import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import ProgressPage from '../Progress';

/**
 * Renders the page and hands back the two layers under test:
 *   wash   — the full-bleed background/ambient-mesh element
 *   column — the capped content container
 */
function renderPage() {
  const { container } = render(
    <MemoryRouter>
      <ProgressPage />
    </MemoryRouter>
  );

  return {
    container,
    wash: container.querySelector('.ambient-mesh'),
    column: container.querySelector('.page-shell'),
  };
}

describe('Progress caps its content column with the house .page-shell container', () => {
  it('puts the content in a .page-shell column, which is where the 480px cap comes from', () => {
    // This is the whole fix. `.page-shell` (components.css) carries
    // max-width: var(--max-width) → 480px (tokens.css). Without this class the
    // page has no cap whatsoever and stretches to the full viewport.
    const { column } = renderPage();

    expect(column).not.toBeNull();
  });

  it('holds the tab bar AND the tab panels in the same single column', () => {
    // Both regions are one content column. If they end up in different
    // containers the tabs and the panel they control stop lining up on a wide
    // screen, which is a worse artefact than the original stretch.
    const { container, column } = renderPage();

    expect(column).toContainElement(screen.getByRole('tablist', { name: 'התקדמות' }));
    expect(container.querySelectorAll('.page-shell')).toHaveLength(1);
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

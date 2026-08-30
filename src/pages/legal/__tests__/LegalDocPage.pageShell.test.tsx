// ============================================================================
// LegalDocPage → the PAGE CONTAINER. Pins the 480px content cap.
//
// The defect: this page had NO width cap. At a 1280px viewport the legal body
// ran the full viewport, so a paragraph measured ~1240px per line — far past a
// readable measure — and the page stopped matching every other screen. Fixed by
// adopting `.page-shell`, the house container in components.css, exactly as
// Settings and the warmup screen were.
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
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { TERMS_DOC } from '../../../content/legal/legalDocs';
import LegalDocPage from '../LegalDocPage';

/** First section of the real doc — asserted on so the test tracks live content. */
const FIRST_SECTION = TERMS_DOC.sections[0];
if (!FIRST_SECTION) throw new Error('TERMS_DOC has no sections to assert on');

/**
 * Renders the page and hands back the two layers under test:
 *   wash   — the full-bleed background/ambient-mesh element
 *   column — the capped content container
 */
function renderPage() {
  const { container } = render(
    <MemoryRouter>
      <LegalDocPage doc={TERMS_DOC} />
    </MemoryRouter>
  );

  return {
    container,
    wash: container.querySelector('.ambient-mesh'),
    column: container.querySelector('.page-shell'),
  };
}

describe('LegalDocPage caps its content column with the house .page-shell container', () => {
  it('puts the content in a .page-shell column, which is where the 480px cap comes from', () => {
    // This is the whole fix. `.page-shell` (components.css) carries
    // max-width: var(--max-width) → 480px (tokens.css). Without this class the
    // page has no cap whatsoever and stretches to the full viewport.
    const { column } = renderPage();

    expect(column).not.toBeNull();
  });

  it('wraps the document body in that capped column, not an empty wrapper', () => {
    // A cap on a container that does not hold the prose would fix nothing —
    // the over-long measure was INSIDE the article.
    const { column } = renderPage();

    expect(column?.tagName).toBe('ARTICLE');
    expect(column).toContainElement(
      screen.getByRole('heading', { level: 2, name: FIRST_SECTION.heading })
    );
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

// ============================================================================
// LegalLinksSection — the privacy card's consent switch IS the shared component
// ============================================================================
// This row used to render a bespoke `role="switch"` (reports/visual-qa-s23.md
// F1 + F2). Two defects came from the copy, not from the design:
//
//   F1  knob colours were INVERTED against the canonical switch. The copy's ON
//       knob was --color-ink-on-accent (#071412) where the shared one is
//       --fs-surface (#ffffff); the shared OFF knob is --fs-ink (#132327).
//       #071412 vs #132327 is 1.16:1 — the same colour to the eye — so on ONE
//       screen a dark knob meant ON in this card and OFF in the card above it.
//   F2  the copy was 52x30 with `border: 'none'` and no padding wrapper. The
//       shared component wraps an identical 52x32 track in an explicit 44x44
//       button, so the copy had also lost the touch floor.
//
// These tests pin the SHARED component's signature at this call site: the 44x44
// box, the 52x32 track inside it, the per-state knob tokens, and a track fill
// that comes from the shared module's own exported `trackBackground`. A
// re-hand-rolled copy fails all four even if its colours were corrected.
// ============================================================================

import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { trackBackground } from '../../../../components/ui/SettingsToggle';
import { CONSENT_VERSION } from '../../../../services/tracking/trackingConsent';
import { LegalLinksSection } from '../LegalLinksSection';

const CONSENT_KEY = 'tracking_consent';

const renderSection = () =>
  render(
    <MemoryRouter>
      <LegalLinksSection />
    </MemoryRouter>
  );

/** The consent switch — the only `role="switch"` in this card. */
const switchOf = (container: HTMLElement): HTMLElement => {
  const el = container.querySelector<HTMLElement>('button[role="switch"]');
  if (!el) throw new Error('consent switch not found');
  return el;
};

/** The shared component's inner visual: [0] = track, [1] = knob. */
const partsOf = (container: HTMLElement): { track: HTMLElement; knob: HTMLElement } => {
  const visual = switchOf(container).querySelector<HTMLElement>('span[aria-hidden="true"]');
  if (!visual) throw new Error('visual track wrapper not found — switch is not SettingsToggle');
  const [track, knob] = Array.from(visual.children) as HTMLElement[];
  if (!track || !knob) throw new Error('track/knob not found');
  return { track, knob };
};

/** jsdom may expose an inline fill as shorthand, longhand, or only on the
 *  style attribute — and normalizes hex to rgb(). Accept any form. */
const fillOf = (el: HTMLElement): string =>
  `${el.style.background} ${el.style.backgroundColor} ${el.getAttribute('style') ?? ''}`;

const setConsent = (analytics: boolean) => {
  localStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({
      necessary: true,
      analytics,
      marketing: false,
      version: CONSENT_VERSION,
      decidedAt: '2026-01-01T00:00:00.000Z',
    })
  );
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('LegalLinksSection consent switch uses the shared SettingsToggle', () => {
  it('renders the shared 44x44 box around a 52x32 track (F2 — the copy was 52x30)', () => {
    const { container } = renderSection();
    const button = switchOf(container);

    // Read from the CSS box, not the painted track: the shared button adds no
    // border width and no padding, so the 44px minima ARE the box. (A copy with
    // `minHeight: 44px` plus a 1px border would box 44 and paint 42.)
    expect(button.style.minWidth).toBe('44px');
    expect(button.style.minHeight).toBe('44px');
    expect(Number.parseFloat(button.style.borderWidth || '0')).toBe(0);
    expect(Number.parseFloat(button.style.padding || '0')).toBe(0);

    const { track } = partsOf(container);
    const visual = button.querySelector<HTMLElement>('span[aria-hidden="true"]');
    expect(visual?.style.width).toBe('52px');
    expect(visual?.style.height).toBe('32px');
    // The copy had no inner track element at all — the button WAS the track.
    expect(track.style.borderRadius).toBe('12px');
  });

  it('uses the canonical OFF knob --fs-ink, not the copy\u2019s --fs-muted (F1)', () => {
    const { container } = renderSection();

    const knob = fillOf(partsOf(container).knob);
    expect(knob).toContain('var(--fs-ink)');
    expect(knob).not.toContain('--fs-muted');
    expect(knob).not.toContain('--color-ink-on-accent');
  });

  it('uses the canonical ON knob --fs-surface, not the near-black copy (F1)', () => {
    setConsent(true);
    const { container } = renderSection();

    const knob = fillOf(partsOf(container).knob);
    expect(knob).toContain('var(--fs-surface)');
    // The inverted copy painted #071412 here — 1.16:1 from the shared OFF knob.
    expect(knob).not.toContain('--color-ink-on-accent');
  });

  it('takes its track fill from the shared module\u2019s trackBackground', () => {
    const { container: off } = renderSection();
    expect(fillOf(partsOf(off).track)).toContain(trackBackground(false, false));

    setConsent(true);
    const { container: on } = renderSection();
    expect(fillOf(partsOf(on).track)).toContain(trackBackground(true, false));
  });

  it('keeps the accessible name and the checked state it had before the swap', () => {
    const { container } = renderSection();
    const button = switchOf(container);

    expect(button.getAttribute('aria-label')).toBe('מעקב אנליטיקה ויציבות');
    expect(button.getAttribute('aria-checked')).toBe('false');

    setConsent(true);
    const { container: onContainer } = renderSection();
    expect(switchOf(onContainer).getAttribute('aria-checked')).toBe('true');
  });
});

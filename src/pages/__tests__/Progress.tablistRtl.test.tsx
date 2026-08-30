// ============================================================================
// Progress page — primary tablist arrow-key ORDER under dir="rtl".
// ============================================================================
// The page used to hand-roll ArrowRight = next / ArrowLeft = previous, which is
// LTR semantics. Under `dir="rtl"` that inverts against the reading direction:
// the tab drawn to the LEFT is the NEXT one, so ArrowLeft must advance.
//
// Which assertions are load-bearing (fail against the pre-fix page):
//   • "ArrowLeft advances" and "ArrowRight goes back / wraps" under dir=rtl —
//     these are the regression guards. Pre-fix they land on the opposite tab.
// Which pass either way (kept deliberately, as no-regression guards):
//   • the dir="ltr" case (ArrowRight advances) — unchanged by the fix.
//   • the "non-arrow key is ignored" case — unchanged by the fix.
// ============================================================================

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import ProgressPage from '../Progress';

/** Visual order of the tablist, right-to-left in Hebrew. */
const TAB_KEYS = ['overview', 'workouts', 'body', 'recovery'] as const;

function tab(key: (typeof TAB_KEYS)[number]): HTMLElement {
  const el = document.getElementById(`progress-tab-${key}`);
  if (!el) throw new Error(`missing tab: ${key}`);
  return el;
}

function selectedKey(): string | undefined {
  return screen
    .getAllByRole('tab')
    .find((t) => t.getAttribute('aria-selected') === 'true')
    ?.id.replace('progress-tab-', '');
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProgressPage />
    </MemoryRouter>
  );
}

describe('Progress tablist — arrow keys follow the writing direction', () => {
  const originalDir = document.dir;

  beforeEach(() => {
    document.dir = 'rtl';
  });

  afterEach(() => {
    document.dir = originalDir;
  });

  it('starts on the overview tab', () => {
    renderPage();
    expect(selectedKey()).toBe('overview');
  });

  it('RTL: ArrowLeft advances to the NEXT tab (the one drawn to the left)', () => {
    renderPage();
    fireEvent.keyDown(tab('overview'), { key: 'ArrowLeft' });

    // Pre-fix this landed on 'recovery' (index -1 wrapped to the end).
    expect(selectedKey()).toBe('workouts');
    expect(document.activeElement).toBe(tab('workouts'));
  });

  it('RTL: ArrowLeft steps forward through the whole list and wraps', () => {
    renderPage();
    let current: string = TAB_KEYS[0];
    for (const expected of ['workouts', 'body', 'recovery', 'overview']) {
      fireEvent.keyDown(tab(current as (typeof TAB_KEYS)[number]), { key: 'ArrowLeft' });
      expect(selectedKey()).toBe(expected);
      current = expected;
    }
  });

  it('RTL: ArrowRight goes BACK, wrapping from the first tab to the last', () => {
    renderPage();
    fireEvent.keyDown(tab('overview'), { key: 'ArrowRight' });

    // Pre-fix this landed on 'workouts' (index +1).
    expect(selectedKey()).toBe('recovery');
    expect(document.activeElement).toBe(tab('recovery'));
  });

  it('RTL: ArrowRight from the second tab returns to the first', () => {
    renderPage();
    fireEvent.keyDown(tab('overview'), { key: 'ArrowLeft' });
    expect(selectedKey()).toBe('workouts');

    fireEvent.keyDown(tab('workouts'), { key: 'ArrowRight' });
    expect(selectedKey()).toBe('overview');
  });

  it('LTR: ArrowRight advances (no regression for a left-to-right document)', () => {
    document.dir = 'ltr';
    renderPage();
    fireEvent.keyDown(tab('overview'), { key: 'ArrowRight' });

    // Passes before AND after the fix — guards the non-Hebrew direction.
    expect(selectedKey()).toBe('workouts');
  });

  it('LTR: ArrowLeft goes back, wrapping to the last tab', () => {
    document.dir = 'ltr';
    renderPage();
    fireEvent.keyDown(tab('overview'), { key: 'ArrowLeft' });

    expect(selectedKey()).toBe('recovery');
  });

  it('leaves non-horizontal keys alone', () => {
    renderPage();
    fireEvent.keyDown(tab('overview'), { key: 'ArrowDown' });
    fireEvent.keyDown(tab('overview'), { key: 'Home' });

    expect(selectedKey()).toBe('overview');
  });

  it('keeps a single tab focusable (roving tabindex) after an arrow step', () => {
    renderPage();
    fireEvent.keyDown(tab('overview'), { key: 'ArrowLeft' });

    const focusable = screen.getAllByRole('tab').filter((t) => t.getAttribute('tabindex') === '0');
    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toBe(tab('workouts'));
  });
});

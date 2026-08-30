// ============================================================================
// Nutrition page — primary tablist arrow-key ORDER under dir="rtl".
// ============================================================================
// Same defect, same shape as Progress: the page hand-rolled ArrowRight = next /
// ArrowLeft = previous, which is inverted in a Hebrew RTL document. The tab drawn
// to the LEFT is the NEXT one, so ArrowLeft must advance.
//
// Which assertions are load-bearing (fail against the pre-fix page):
//   • "ArrowLeft advances" and "ArrowRight goes back / wraps" under dir=rtl.
// Which pass either way (kept as no-regression guards):
//   • the dir="ltr" cases, and the "non-arrow key is ignored" case.
// ============================================================================

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import NutritionPage from '../Nutrition';

/** Visual order of the tablist, right-to-left in Hebrew. */
const TAB_KEYS = ['log', 'library', 'presets'] as const;

function tab(key: (typeof TAB_KEYS)[number]): HTMLElement {
  const el = document.getElementById(`nutrition-tab-${key}`);
  if (!el) throw new Error(`missing tab: ${key}`);
  return el;
}

function selectedKey(): string | undefined {
  return screen
    .getAllByRole('tab')
    .find((t) => t.getAttribute('aria-selected') === 'true')
    ?.id.replace('nutrition-tab-', '');
}

describe('Nutrition tablist — arrow keys follow the writing direction', () => {
  const originalDir = document.dir;

  beforeEach(() => {
    document.dir = 'rtl';
  });

  afterEach(() => {
    document.dir = originalDir;
  });

  it('starts on the food-journal tab', () => {
    render(<NutritionPage />);
    expect(selectedKey()).toBe('log');
  });

  it('RTL: ArrowLeft advances to the NEXT tab (the one drawn to the left)', () => {
    render(<NutritionPage />);
    fireEvent.keyDown(tab('log'), { key: 'ArrowLeft' });

    // Pre-fix this landed on 'presets' (index -1 wrapped to the end).
    expect(selectedKey()).toBe('library');
    expect(document.activeElement).toBe(tab('library'));
  });

  it('RTL: ArrowLeft steps forward through the whole list and wraps', () => {
    render(<NutritionPage />);
    let current: string = TAB_KEYS[0];
    for (const expected of ['library', 'presets', 'log']) {
      fireEvent.keyDown(tab(current as (typeof TAB_KEYS)[number]), { key: 'ArrowLeft' });
      expect(selectedKey()).toBe(expected);
      current = expected;
    }
  });

  it('RTL: ArrowRight goes BACK, wrapping from the first tab to the last', () => {
    render(<NutritionPage />);
    fireEvent.keyDown(tab('log'), { key: 'ArrowRight' });

    // Pre-fix this landed on 'library' (index +1).
    expect(selectedKey()).toBe('presets');
    expect(document.activeElement).toBe(tab('presets'));
  });

  it('RTL: ArrowRight from the second tab returns to the first', () => {
    render(<NutritionPage />);
    fireEvent.keyDown(tab('log'), { key: 'ArrowLeft' });
    expect(selectedKey()).toBe('library');

    fireEvent.keyDown(tab('library'), { key: 'ArrowRight' });
    expect(selectedKey()).toBe('log');
  });

  it('LTR: ArrowRight advances (no regression for a left-to-right document)', () => {
    document.dir = 'ltr';
    render(<NutritionPage />);
    fireEvent.keyDown(tab('log'), { key: 'ArrowRight' });

    // Passes before AND after the fix — guards the non-Hebrew direction.
    expect(selectedKey()).toBe('library');
  });

  it('LTR: ArrowLeft goes back, wrapping to the last tab', () => {
    document.dir = 'ltr';
    render(<NutritionPage />);
    fireEvent.keyDown(tab('log'), { key: 'ArrowLeft' });

    expect(selectedKey()).toBe('presets');
  });

  it('leaves non-horizontal keys alone', () => {
    render(<NutritionPage />);
    fireEvent.keyDown(tab('log'), { key: 'ArrowDown' });
    fireEvent.keyDown(tab('log'), { key: 'Home' });

    expect(selectedKey()).toBe('log');
  });

  it('keeps a single tab focusable (roving tabindex) after an arrow step', () => {
    render(<NutritionPage />);
    fireEvent.keyDown(tab('log'), { key: 'ArrowLeft' });

    const focusable = screen.getAllByRole('tab').filter((t) => t.getAttribute('tabindex') === '0');
    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toBe(tab('library'));
  });
});

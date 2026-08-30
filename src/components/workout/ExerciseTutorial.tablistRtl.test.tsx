// ============================================================================
// ExerciseTutorial — coach tablist arrow-key ORDER under dir="rtl" / dir="ltr".
// ============================================================================
// The panel hand-rolled the direction rule with RTL hardcoded (ArrowLeft was
// always i+1) and CLAMPED at both ends. Right in Hebrew for the middle of the
// list, silently inverted for a left-to-right document. It now steps through the
// shared `arrowKeyTargetIndex`, which also means it wraps at both ends like the
// app's other tablists instead of dead-ending.
//
// With `onSaveNote` supplied the tablist has THREE tabs (ביצוע / שאלה / פתק), so
// forward and back are distinguishable — unlike a 2-item control.
//
// Which assertions are load-bearing (fail if the RTL flag is pinned to false):
//   • every dir="rtl" arrow case — ArrowLeft advances, ArrowRight goes back.
//   • the dir="ltr" case, which fails against the pre-fix file.
// Which pass either way (kept deliberately, as no-regression guards):
//   • Home / End, and "leaves other keys alone" — direction-independent.
// ============================================================================

import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExerciseTutorial from './ExerciseTutorial';

/** Visual order of the tablist, right-to-left in Hebrew. */
const TAB_IDS = ['guide', 'ask', 'note'] as const;

function tab(id: (typeof TAB_IDS)[number]): HTMLElement {
  const el = document.getElementById(`coach-tab-${id}`);
  if (!el) throw new Error(`missing tab: ${id}`);
  return el;
}

function selectedId(): string | undefined {
  return screen
    .getAllByRole('tab')
    .find((t) => t.getAttribute('aria-selected') === 'true')
    ?.id.replace('coach-tab-', '');
}

/** `onSaveNote` is what adds the third tab. */
function renderTutorial() {
  return render(
    <ExerciseTutorial
      isOpen
      exerciseName="משיכת פולי עליון | Lat Pulldown"
      onSaveNote={vi.fn()}
      onClose={vi.fn()}
    />
  );
}

function pressArrow(key: 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End') {
  fireEvent.keyDown(screen.getByRole('tablist', { name: 'מדורי המאמן' }), { key });
}

describe('ExerciseTutorial tablist — arrow keys follow the writing direction', () => {
  const originalDir = document.dir;

  beforeEach(() => {
    document.dir = 'rtl';
  });

  afterEach(() => {
    document.dir = originalDir;
  });

  it('opens on the guide tab with all three tabs present', () => {
    renderTutorial();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(selectedId()).toBe('guide');
  });

  it('RTL: ArrowLeft advances to the NEXT tab (the one drawn to the left)', () => {
    renderTutorial();
    pressArrow('ArrowLeft');

    expect(selectedId()).toBe('ask');
    expect(document.activeElement).toBe(tab('ask'));
  });

  it('RTL: ArrowLeft steps forward through the whole list and wraps', () => {
    renderTutorial();
    for (const expected of ['ask', 'note', 'guide']) {
      pressArrow('ArrowLeft');
      expect(selectedId()).toBe(expected);
    }
  });

  it('RTL: ArrowRight goes BACK, wrapping from the first tab to the last', () => {
    renderTutorial();
    pressArrow('ArrowRight');

    // Pre-fix this clamped and stayed on 'guide'.
    expect(selectedId()).toBe('note');
    expect(document.activeElement).toBe(tab('note'));
  });

  it('RTL: ArrowRight from the second tab returns to the first', () => {
    renderTutorial();
    pressArrow('ArrowLeft');
    expect(selectedId()).toBe('ask');

    pressArrow('ArrowRight');
    expect(selectedId()).toBe('guide');
  });

  it('LTR: ArrowRight advances and ArrowLeft wraps back to the last tab', () => {
    document.dir = 'ltr';
    renderTutorial();

    // Pre-fix ArrowRight went BACKWARD here: the RTL rule was hardcoded.
    pressArrow('ArrowRight');
    expect(selectedId()).toBe('ask');

    pressArrow('ArrowLeft');
    expect(selectedId()).toBe('guide');

    pressArrow('ArrowLeft');
    expect(selectedId()).toBe('note');
  });

  it('keeps Home and End on the ends of the list', () => {
    renderTutorial();
    pressArrow('End');
    expect(selectedId()).toBe('note');

    pressArrow('Home');
    expect(selectedId()).toBe('guide');
  });

  it('leaves other keys alone', () => {
    renderTutorial();
    pressArrow('ArrowLeft');
    fireEvent.keyDown(screen.getByRole('tablist', { name: 'מדורי המאמן' }), { key: 'ArrowDown' });

    expect(selectedId()).toBe('ask');
  });

  it('keeps a single tab focusable (roving tabindex) after an arrow step', () => {
    renderTutorial();
    pressArrow('ArrowLeft');

    const focusable = screen.getAllByRole('tab').filter((t) => t.getAttribute('tabindex') === '0');
    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toBe(tab('ask'));
  });
});

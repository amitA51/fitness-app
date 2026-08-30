// ============================================================================
// CoachMessages — tab bar arrow-key ORDER under dir="rtl" / dir="ltr".
// ============================================================================
// This tab bar hand-rolled the direction rule with RTL hardcoded (ArrowLeft was
// always +1, ArrowRight -1, wrapping). It now steps through the shared
// `arrowKeyTargetIndex` so the rule lives in one place.
//
// HONEST LIMIT OF THIS FILE: the control has exactly TWO tabs, and in a 2-item
// ring (i+1) % 2 === (i-1+2) % 2 — forward and back are the SAME tab. Direction
// is therefore unobservable here, in either writing direction: the pre-fix code
// was not user-visibly wrong for Hebrew OR for LTR, and no test on this site can
// distinguish isRTL true from false. Every assertion below is a regression guard
// (wrap-around, non-arrow keys ignored, roving tabindex), not proof of the rule —
// the direction proof lives on the 3-tab sites (ExerciseTutorial, Progress,
// Nutrition). Kept anyway so a future third tab cannot silently invert this.
// ============================================================================

import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CoachMessages from './CoachMessages';

// The panels fetch threads on mount; the tab bar is what's under test, so the
// data layer is stubbed to a resolved empty inbox.
vi.mock('../../services/coach/messageService', () => ({
  listClientThreads: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../services/coach/groupMessageService', () => ({
  listGroupThreads: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../services/coach/realtime', () => ({
  createThrottledRefresh: (fn: () => void) => ({ run: fn, cancel: () => {} }),
  subscribeToCoachClientMessages: () => () => {},
  subscribeToCoachGroupMessages: () => () => {},
}));
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'coach-1' } }),
}));

/** Visual order of the tab bar, right-to-left in Hebrew. */
const TAB_KEYS = ['personal', 'groups'] as const;

function tab(key: (typeof TAB_KEYS)[number]): HTMLElement {
  const el = document.getElementById(`coach-msgs-tab-${key}`);
  if (!el) throw new Error(`missing tab: ${key}`);
  return el;
}

function selectedKey(): string | undefined {
  return screen
    .getAllByRole('tab')
    .find((t) => t.getAttribute('aria-selected') === 'true')
    ?.id.replace('coach-msgs-tab-', '');
}

function renderPage() {
  return render(
    <MemoryRouter>
      <CoachMessages />
    </MemoryRouter>
  );
}

describe('CoachMessages tab bar — arrow keys follow the writing direction', () => {
  const originalDir = document.dir;

  beforeEach(() => {
    document.dir = 'rtl';
  });

  afterEach(() => {
    document.dir = originalDir;
  });

  it('starts on the personal tab', () => {
    renderPage();
    expect(selectedKey()).toBe('personal');
  });

  it('RTL: ArrowLeft advances to the NEXT tab (the one drawn to the left)', () => {
    renderPage();
    fireEvent.keyDown(tab('personal'), { key: 'ArrowLeft' });

    expect(selectedKey()).toBe('groups');
  });

  it('RTL: ArrowRight goes BACK, wrapping from the first tab to the last', () => {
    renderPage();
    fireEvent.keyDown(tab('personal'), { key: 'ArrowRight' });

    expect(selectedKey()).toBe('groups');
  });

  it('RTL: ArrowRight from the last tab returns to the first', () => {
    renderPage();
    fireEvent.keyDown(tab('personal'), { key: 'ArrowLeft' });
    expect(selectedKey()).toBe('groups');

    fireEvent.keyDown(tab('groups'), { key: 'ArrowRight' });
    expect(selectedKey()).toBe('personal');
  });

  it('RTL: ArrowLeft wraps from the last tab back to the first', () => {
    renderPage();
    fireEvent.keyDown(tab('personal'), { key: 'ArrowLeft' });
    fireEvent.keyDown(tab('groups'), { key: 'ArrowLeft' });

    expect(selectedKey()).toBe('personal');
  });

  it('LTR: ArrowRight advances and ArrowLeft goes back', () => {
    document.dir = 'ltr';
    renderPage();

    // With two tabs this lands on the same tab either way — it guards the day a
    // third tab makes direction observable.
    fireEvent.keyDown(tab('personal'), { key: 'ArrowRight' });
    expect(selectedKey()).toBe('groups');

    fireEvent.keyDown(tab('groups'), { key: 'ArrowLeft' });
    expect(selectedKey()).toBe('personal');
  });

  it('leaves non-horizontal keys alone', () => {
    renderPage();
    fireEvent.keyDown(tab('personal'), { key: 'ArrowDown' });
    fireEvent.keyDown(tab('personal'), { key: 'Enter' });

    expect(selectedKey()).toBe('personal');
  });

  it('keeps a single tab focusable (roving tabindex) after an arrow step', () => {
    renderPage();
    fireEvent.keyDown(tab('personal'), { key: 'ArrowLeft' });

    const focusable = screen.getAllByRole('tab').filter((t) => t.getAttribute('tabindex') === '0');
    expect(focusable).toHaveLength(1);
    expect(focusable[0]).toBe(tab('groups'));
  });
});

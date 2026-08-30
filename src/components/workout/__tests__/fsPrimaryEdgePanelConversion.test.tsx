// --fs-primary -> --fs-edge / --fs-panel conversion, pinned.
//
// WHY THIS FILE EXISTS
// --fs-primary is dual-use: a dark PANEL FILL and the INK on the bright lime
// --fs-signal. It has to stay near-black for the lime, so it cannot lighten in
// dark -- and everywhere it painted a FILL or an EDGE against a dark surround it
// measured ~1.05:1 and disappeared. On the set-logging screen that meant a user
// mid-workout could not tell which control was active. Two tokens exist for
// exactly this and are declared in all three theme blocks (:root, html.dark,
// html.high-contrast): --fs-edge for control edges (floor 3:1) and --fs-panel
// for deliberate dark chrome.
//
// Resolved values, from src/styles/tokens.css:
//   token          light      dark                      HC (light+HC / dark+HC)
//   --fs-primary   #16292d    #0a0a0a                   #16292d / #0a0a0a
//   --fs-edge      #16292d    rgba(255,255,255,0.42)    #ffffff
//   --fs-panel     #16292d    #262626 (--fs-surface-2)  #1c363b
// Light aliases both replacements to --fs-primary, so light is byte-identical.
//
// TWO RULES THIS FILE ENCODES, NOT JUST THE SWAP
// 1. A site whose surrounding fill is the bright mint --fs-accent (or the lime
//    --fs-signal) is CORRECT AS IS: near-black on a bright fill passes all four
//    states, and dark --fs-edge composites to 1.24:1 over the mint. Sweeping one
//    BREAKS working code, so the mint-backed sites are asserted to KEEP
//    --fs-primary.
// 2. --fs-panel is illegal over an elevated --fs-surface-2 backdrop -- in dark
//    that token IS --fs-surface-2 and lands at 1.00:1. So a control edge on
//    --fs-surface-2 takes --fs-edge (StatsGrid), and only fills over a page or
//    card backdrop take --fs-panel (SlideToComplete on --fs-bg, PlanSetRow on
//    the --fs-surface exercise card).
//
// The assertions are counted rather than positional: a count pins BOTH
// directions -- reverting a converted site and sweeping a correct-as-is one both
// move the number and fail.

import { fireEvent, render, screen } from '@testing-library/react';
import { LazyMotion, domAnimation } from 'framer-motion';
import { useEffect } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { WorkoutSet } from '../../../types';

// GSAP, sparks, haptics and reduced-motion are irrelevant to a static inline
// style read, and pull canvas/animation side effects into jsdom. Stub them --
// same shape the SlideToComplete and WorkoutSummary suites already establish.
vi.mock('../../../lib/gsap', () => {
  const tween = { kill: () => {} };
  const makeTimeline = () => {
    const tl: Record<string, unknown> = {};
    const chain = () => tl;
    tl.to = chain;
    tl.fromTo = chain;
    tl.set = chain;
    tl.add = (fn: unknown) => {
      if (typeof fn === 'function') (fn as () => void)();
      return tl;
    };
    return tl;
  };
  return {
    DUR: { fast: 0, micro: 0, base: 0, slow: 0, count: 0 },
    EASE: { pop: 'none', out: 'none', popHard: 'none' },
    gsap: {
      to: () => tween,
      set: vi.fn(),
      delayedCall: () => ({ kill: () => {} }),
      killTweensOf: () => {},
      timeline: () => makeTimeline(),
    },
    useGSAP: (cb: () => void, config?: { dependencies?: unknown[] }) => {
      // biome-ignore lint/correctness/useExhaustiveDependencies: deps mirror the real hook's array.
      useEffect(() => {
        cb();
      }, config?.dependencies ?? []);
    },
  };
});
vi.mock('../../../lib/gsapSparks', () => ({ fireSparks: vi.fn() }));
vi.mock('../../../hooks/useReducedMotion', () => ({ useReducedMotion: () => true }));
vi.mock('../../../utils/haptics', () => ({
  triggerHaptic: vi.fn(),
  triggerHapticEffect: vi.fn(),
  vibratePattern: vi.fn(),
}));
// StatsGrid's hero number rolls via useCountUp (a GSAP tween on a ref). The
// number is not under test; the cell's border token is.
vi.mock('../../../hooks/useCountUp', () => ({ useCountUp: () => {} }));

import PlanSetRow from '../components/PlanSetRow';
import SetEditBottomSheet from '../components/SetEditBottomSheet';
import SlideToComplete from '../components/SlideToComplete';
import { StatsGrid } from '../components/StatsGrid';
import { SetEditRow } from '../reorder/SetEditRow';

beforeAll(() => {
  // jsdom implements neither setPointerCapture (it THROWS) nor a PointerEvent
  // constructor. SlideToComplete's render path does not need either, but its
  // pointer handlers are attached on mount -- keep the environment honest so a
  // future interaction assertion here does not silently test nothing.
  const proto = HTMLElement.prototype as unknown as {
    setPointerCapture?: (pointerId: number) => void;
    releasePointerCapture?: (pointerId: number) => void;
  };
  if (!proto.setPointerCapture) {
    proto.setPointerCapture = () => {};
    proto.releasePointerCapture = () => {};
  }
  if (typeof window.PointerEvent === 'undefined') {
    class TestPointerEvent extends MouseEvent {
      pointerId: number;
      constructor(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
      }
    }
    window.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * The inline style as authored. Read from the style ATTRIBUTE rather than via
 * `el.style.border`, because jsdom's CSS shorthand parser does not round-trip a
 * `var()` inside a `border` shorthand -- reading the property would return ''
 * for every row and make each assertion below pass while testing nothing.
 */
const styleOf = (el: Element | null | undefined): string => el?.getAttribute('style') ?? '';

/** Every element in the tree whose authored inline style matches. */
const countStyled = (root: ParentNode, needle: string): number =>
  Array.from(root.querySelectorAll('[style]')).filter((el) => styleOf(el).includes(needle)).length;

// Object.assign rather than a spread: the project runs
// exactOptionalPropertyTypes, under which spreading a Partial<WorkoutSet> widens
// every optional field to `| undefined` and no longer satisfies the type.
const makeSet = (over: Partial<WorkoutSet> = {}): WorkoutSet =>
  Object.assign(
    {
      id: 'set-1',
      setNumber: 1,
      reps: 10,
      weight: 60,
      rpe: null,
      isWarmup: false,
      isCompleted: false,
      notes: '',
      completedAt: null,
    } as WorkoutSet,
    over
  );

// ============================================================================
// GROUP A -- the eight sites that landed last batch (SetEditRow's edit panel).
// These are REGRESSION GUARDS: they pass both before and after this batch's
// four edits, and fail the moment any of the eight is reverted to --fs-primary.
// ============================================================================

describe('SetEditRow edit panel: the eight landed --fs-edge edges', () => {
  const openEditPanel = () => {
    const { container } = render(
      <SetEditRow
        set={makeSet()}
        setIndex={0}
        exerciseIndex={0}
        canDelete
        onEditSet={vi.fn()}
        onDeleteSet={vi.fn()}
      />
    );
    // The collapsed row is the edit trigger (role="button", onClick=startEdit).
    const row = container.querySelector('[role="button"]');
    expect(row).not.toBeNull();
    fireEvent.click(row as HTMLElement);
    return container;
  };

  it('carries exactly eight 2px --fs-edge control edges', () => {
    const container = openEditPanel();

    // Panel wrapper, weight -/input/+, reps -/input/+, cancel. Each was
    // --fs-primary at 1.05:1 (dark) / 1.06:1 (dark+HC) against the surface
    // behind it; --fs-edge is 4.10:1 / 21:1 there, and 3.89:1 / 18.88:1 on the
    // --fs-surface-2 panel and cancel button.
    expect(countStyled(container, '2px solid var(--fs-edge)')).toBe(8);
  });

  it('keeps --fs-primary on exactly one edge -- the mint-filled save button', () => {
    const container = openEditPanel();

    // The save button's own fill is --fs-accent, bright in all four states, so
    // the near-black ring reads 7.16:1 (light) to 15.85:1 (dark+HC). Dark
    // --fs-edge would composite to 1.24:1 over that mint. Correct as is.
    const primaryEdges = Array.from(container.querySelectorAll('[style]')).filter((el) =>
      styleOf(el).includes('2px solid var(--fs-primary)')
    );
    expect(primaryEdges).toHaveLength(1);
    expect(styleOf(primaryEdges[0])).toContain('background: var(--fs-accent)');
  });

  it('keeps the two --fs-primary stepper fills that carry --fs-accent glyphs', () => {
    const container = openEditPanel();

    // The + buttons: accent ink on --fs-edge is 3.11:1 and 1.00:1 on --fs-panel
    // over their --fs-surface-2 panel, so converting the FILL breaks the label.
    // The 2px --fs-edge ring (counted above) is what restores their boundary.
    const primaryFills = Array.from(container.querySelectorAll('[style]')).filter((el) =>
      styleOf(el).includes('background: var(--fs-primary)')
    );
    expect(primaryFills).toHaveLength(2);
    for (const el of primaryFills) {
      expect(styleOf(el)).toContain('2px solid var(--fs-edge)');
    }
  });
});

// ============================================================================
// GROUP B -- this batch's four sites. These FAIL on pre-fix code.
// ============================================================================

describe('SetEditBottomSheet set rows: the split border branch', () => {
  const renderSheet = (sets: WorkoutSet[]) =>
    render(
      <LazyMotion features={domAnimation}>
        <SetEditBottomSheet
          isOpen
          sets={sets}
          exerciseName="לחיצת חזה"
          onClose={vi.fn()}
          onUpdateSet={vi.fn()}
        />
      </LazyMotion>
    );

  it('gives the PENDING row a visible --fs-edge outline on its --fs-surface fill', () => {
    // One declaration served both states, so a blanket swap was not available.
    // The pending row sits on a plain --fs-surface: --fs-primary measured
    // 1.05:1 in dark and 1.06:1 in dark+HC -- NO visible outline at all.
    // --fs-edge is 4.10:1 / 21:1 there.
    renderSheet([makeSet({ id: 'p', completedAt: null })]);

    const pending = Array.from(document.body.querySelectorAll('[style]')).filter((el) =>
      styleOf(el).includes('background: var(--fs-surface);')
    );
    const outlined = pending.filter((el) => styleOf(el).includes('2px solid var(--fs-edge)'));
    expect(outlined).toHaveLength(1);
  });

  it('leaves the COMPLETED row on --color-check', () => {
    // The other half of the same declaration. It never used --fs-primary and
    // must not have been dragged along by the split.
    renderSheet([makeSet({ id: 'c', isCompleted: true, completedAt: new Date().toISOString() })]);

    expect(countStyled(document.body, '2px solid var(--color-check)')).toBe(1);
    expect(countStyled(document.body, '2px solid var(--fs-edge)')).toBe(0);
  });

  it('keeps --fs-primary on the EDITING row, whose own fill is the mint', () => {
    // The subtle half: converting this one would put dark --fs-edge
    // rgba(255,255,255,0.42) on --fs-accent at 1.24:1 and destroy a passing
    // edge that reads 11.57:1 in dark today.
    renderSheet([makeSet({ id: 'p', completedAt: null })]);

    const trigger = screen.getByRole('button', { name: /סט 1/ });
    fireEvent.click(trigger);

    const editing = Array.from(document.body.querySelectorAll('[style]')).filter(
      (el) =>
        styleOf(el).includes('background: var(--fs-accent);') &&
        styleOf(el).includes('2px solid var(--fs-primary)')
    );
    expect(editing).toHaveLength(1);
  });
});

describe('StatsGrid hero cell', () => {
  const renderGrid = (prsCount: number | null) =>
    render(
      <LazyMotion features={domAnimation}>
        <StatsGrid totalVolume={4200} duration={3600} totalSets={18} prsCount={prsCount} />
      </LazyMotion>
    );

  it('edges the non-PR hero with --fs-edge, not --fs-panel, over --fs-surface-2', () => {
    // The sibling fill IS --fs-surface-2, which dark --fs-panel resolves to --
    // that swap would have landed at exactly 1.00:1. As a control edge
    // --fs-primary gave 1.31:1 (dark) / 1.05:1 (dark+HC); --fs-edge is 3.89:1 /
    // 18.88:1.
    const { container } = renderGrid(0);
    const hero = container.querySelector('.js-hero-cell');

    expect(styleOf(hero)).toContain('background: var(--fs-surface-2)');
    expect(styleOf(hero)).toContain('2px solid var(--fs-edge)');
    expect(styleOf(hero)).not.toContain('var(--fs-panel)');
  });

  it('still hands the PR hero its mint edge', () => {
    const { container } = renderGrid(3);
    expect(styleOf(container.querySelector('.js-hero-cell'))).toContain(
      '2px solid var(--fs-accent)'
    );
  });
});

describe('PlanSetRow set-number badge', () => {
  it('fills with --fs-panel and keeps the --fs-accent numeral', () => {
    // Legal here: the badge sits inside the exercise card, whose fill is
    // --fs-surface (WorkoutPlanScreen.tsx:274), NOT the elevated --fs-surface-2
    // that makes this token 1.00:1. As dark chrome --fs-primary vanished at
    // 1.05:1 (dark) / 1.06:1 (dark+HC); --fs-panel is 1.25:1 / 1.47:1, and the
    // mint numeral on it stays 8.84:1 (dark) / 10.25:1 (both HC).
    const { container } = render(
      <PlanSetRow
        index={0}
        weight={60}
        reps={10}
        weightIncrement={2.5}
        canRemove
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />
    );

    const badge = Array.from(container.querySelectorAll('[style]')).find((el) =>
      styleOf(el).includes('width: 28px')
    );
    expect(styleOf(badge)).toContain('background: var(--fs-panel)');
    expect(styleOf(badge)).toContain('color: var(--fs-accent)');
    expect(styleOf(badge)).not.toContain('var(--fs-primary)');
  });
});

describe('SlideToComplete track', () => {
  it('fills with --fs-panel over the footer page backdrop, keeping the pattern layer', () => {
    // WorkoutBottomBar sets the footer to --fs-bg deliberately (it stays visible
    // behind a sheet, so an opaque surface avoids a second backdrop sample on
    // the same pixels) -- a PAGE backdrop, exactly where --fs-panel is
    // sanctioned. --fs-primary was 1.06:1 there in dark and dark+HC, so the
    // app's hottest control had no edge; --fs-panel is 1.39:1 / 1.64:1.
    render(<SlideToComplete label="החלק להשלמה" onComplete={vi.fn()} />);

    const track = screen.getByRole('button', { name: 'החלק להשלמה' });
    const style = styleOf(track);
    expect(style).toContain('var(--fs-panel)');
    expect(style).not.toContain('var(--fs-primary)');
    // The pattern layer must survive the fill swap -- it is the first background
    // layer and the token is the last.
    expect(style).toContain('repeating-linear-gradient');
  });

  it('keeps the mint thumb and its on-accent ink untouched', () => {
    // Guard: the thumb is a bright --fs-accent fill. Its ink is already the
    // dedicated on-accent token and must not drift into the edge/panel pair.
    const { container } = render(<SlideToComplete label="החלק להשלמה" onComplete={vi.fn()} />);

    const thumb = Array.from(container.querySelectorAll('[style]')).find((el) =>
      styleOf(el).includes('color: var(--color-ink-on-accent)')
    );
    expect(styleOf(thumb)).toContain('background: var(--fs-accent)');
  });
});

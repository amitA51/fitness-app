// ModalOverlay bottom-sheet gesture contract.
//
// These tests exist because five sheets in this app hand-rolled their own
// drag-to-dismiss (or shipped none at all) instead of using this one, and the
// hand-rolled copies all tracked the finger at HALF speed
// (`dragConstraints={{top: 0, bottom: 0}}` + `dragElastic: 0.5` means every
// downward pixel is elastic). The 1:1 assertion below is the whole point: it
// reads the real transform Framer wrote and compares it to the pointer delta.

import { fireEvent, render, screen } from '@testing-library/react';
import { LazyMotion, domMax } from 'framer-motion';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ModalOverlay, projectMomentum } from './ModalOverlay';

// Reduced motion is controllable per-test. The factory only closes over the
// variable — it is read at render time, never at hoist time.
let mockReducedMotion = false;
vi.mock('../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
  useMotionConfigMode: () => (mockReducedMotion ? 'always' : 'user'),
}));

// Spy on the spring so "no spring may run under reduced motion" is a measured
// fact rather than an inference from a transform value. Everything else in
// framer-motion stays real — the drag engine under test must be the real one.
const animateSpy = vi.fn();
vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return {
    ...actual,
    animate: (...args: unknown[]) => {
      animateSpy(...args);
      return undefined;
    },
  };
});

vi.mock('../../utils/haptics', () => ({
  triggerHaptic: vi.fn(),
  triggerHapticEffect: vi.fn(),
}));

beforeAll(() => {
  // jsdom implements neither the Pointer Capture API (setPointerCapture THROWS
  // rather than no-ops) nor the PointerEvent constructor — without which
  // fireEvent.pointerMove silently drops clientY and pointerId, and every
  // assertion below would pass while measuring nothing.
  const proto = HTMLElement.prototype as unknown as {
    setPointerCapture: (id: number) => void;
    releasePointerCapture: (id: number) => void;
    hasPointerCapture: (id: number) => boolean;
  };
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
  proto.hasPointerCapture = () => false;

  if (typeof window.PointerEvent === 'undefined') {
    class TestPointerEvent extends MouseEvent {
      pointerId: number;
      pointerType: string;
      isPrimary: boolean;
      constructor(
        type: string,
        init: MouseEventInit & { pointerId?: number; pointerType?: string } = {}
      ) {
        super(type, init);
        this.pointerId = init.pointerId ?? 1;
        this.pointerType = init.pointerType ?? 'touch';
        this.isPrimary = true;
      }
    }
    window.PointerEvent = TestPointerEvent as unknown as typeof PointerEvent;
  }
});

afterEach(() => {
  mockReducedMotion = false;
  animateSpy.mockClear();
});

/** Framer applies drag updates on its own frame loop — let it run. */
const flushFrames = () => new Promise((resolve) => setTimeout(resolve, 40));

/** The layer ModalOverlay puts the drag on: the dialog's only child. */
const dragLayer = (): HTMLElement => screen.getByRole('dialog').firstElementChild as HTMLElement;

/** Read the px value out of `translateY(Npx)`; NaN when nothing was written. */
const layerY = (): number => Number.parseFloat(dragLayer().style.transform.replace(/[^\d.-]/g, ''));

/** Same, but reads Framer's `transform: none` for a zeroed value as 0. */
const restingY = (): number => {
  const transform = dragLayer().style.transform;
  return transform === 'none' || transform === '' ? 0 : layerY();
};

// A distinct pointerId per gesture. Framer keys its pan session by pointer, and
// a test that leaves a session open would otherwise poison the next one — which
// is exactly what made the dismiss test fail in-suite but pass in isolation.
let nextPointerId = 1;
const gesture = (target: Element | Window, fromY: number) => {
  const pointerId = ++nextPointerId;
  fireEvent.pointerDown(target as Element, {
    clientX: 100,
    clientY: fromY,
    pointerId,
    buttons: 1,
  });
  return {
    async moveTo(y: number) {
      fireEvent.pointerMove(window, { clientX: 100, clientY: y, pointerId, buttons: 1 });
      await flushFrames();
    },
    /** Let the 100ms velocity window lapse so the release reads as a slow let-go. */
    async settle() {
      await new Promise((resolve) => setTimeout(resolve, 200));
    },
    async release(y: number) {
      fireEvent.pointerUp(window, { clientX: 100, clientY: y, pointerId });
      await flushFrames();
    },
  };
};

const renderSheet = (onClose = vi.fn()) => {
  render(
    <LazyMotion features={domMax}>
      <ModalOverlay isOpen onClose={onClose} variant="bottomSheet" ariaLabel="גיליון">
        <div>
          <div data-sheet-drag-handle data-testid="handle" style={{ height: 24 }}>
            <button type="button" data-testid="handle-button" onClick={vi.fn()}>
              סגירה
            </button>
          </div>
          <div data-testid="body">תוכן</div>
        </div>
      </ModalOverlay>
    </LazyMotion>
  );
  return { onClose };
};

describe('projectMomentum', () => {
  // (v / 1000) * d / (1 - d) with d = 0.998 is EXACTLY v * 0.499. The previous
  // 0.995 gave v * 0.199 — every flick under-credited by 2.5x. And the formula
  // must not be read as "v / 1000": that would project this flick to 1.2px.
  it('projects a flick to velocity * 0.499 seconds of travel', () => {
    expect(projectMomentum(2500)).toBeCloseTo(1247.5, 4);
    expect(projectMomentum(1000)).toBeCloseTo(499, 4);
    expect(projectMomentum(0)).toBe(0);
  });

  it('projects an upward flick backwards by the same factor', () => {
    expect(projectMomentum(-2000)).toBeCloseTo(-998, 4);
  });
});

describe('ModalOverlay bottom-sheet drag', () => {
  it('tracks the finger 1:1 downward from the drag handle', async () => {
    renderSheet();
    const drag = gesture(screen.getByTestId('handle'), 300);

    await drag.moveTo(340);
    await drag.moveTo(460);

    // 460 - 300 = 160. Half of it (dragElastic 0.5 with both bounds pinned)
    // would be translateY(80px) — that is the defect this asserts against.
    expect(dragLayer().style.transform).toBe('translateY(160px)');
    await drag.release(460);
  });

  it('does not track an upward drag 1:1 — the boundary resists', async () => {
    renderSheet();
    const drag = gesture(screen.getByTestId('handle'), 300);

    await drag.moveTo(200);

    // `dragConstraints={{ top: 0 }}` + dragElastic 0.08: upward is the
    // constrained direction, so 100px of finger must NOT become 100px of sheet.
    expect(dragLayer().style.transform).not.toBe('translateY(-100px)');
    expect(restingY()).toBeGreaterThan(-100);
    await drag.release(200);
  });

  it('does not drag when the pointer lands on the scrollable body', async () => {
    renderSheet();
    const drag = gesture(screen.getByTestId('body'), 300);

    await drag.moveTo(460);

    expect(dragLayer().style.transform).toBe('none');
    await drag.release(460);
  });

  it('does not drag when the pointer lands on a control inside handle chrome', async () => {
    renderSheet();
    const drag = gesture(screen.getByTestId('handle-button'), 300);

    await drag.moveTo(460);

    // A drag started here would make Framer swallow the click and the button
    // would go dead — the reason a whole header row can be a handle safely.
    expect(dragLayer().style.transform).toBe('none');
    await drag.release(460);
  });

  it('dismisses when the projected resting point clears the threshold', async () => {
    const { onClose } = renderSheet();
    const drag = gesture(screen.getByTestId('handle'), 100);

    await drag.moveTo(300);
    await drag.moveTo(500);
    await drag.release(500);

    expect(onClose).toHaveBeenCalled();
  });

  it('springs home carrying the release velocity when the drag falls short', async () => {
    const { onClose } = renderSheet();
    const drag = gesture(screen.getByTestId('handle'), 100);

    await drag.moveTo(180);
    await drag.settle();
    await drag.release(180);

    expect(onClose).not.toHaveBeenCalled();
    expect(animateSpy).toHaveBeenCalledTimes(1);
    const transition = animateSpy.mock.calls[0]?.[2] as Record<string, unknown>;
    expect(transition).toMatchObject({ type: 'spring', bounce: 0, duration: 0.4 });
    expect(typeof transition.velocity).toBe('number');
  });
});

describe('ModalOverlay bottom-sheet drag under reduced motion', () => {
  it('keeps the gesture and runs no spring on release', async () => {
    mockReducedMotion = true;
    const { onClose } = renderSheet();
    const drag = gesture(screen.getByTestId('handle'), 100);

    await drag.moveTo(190);

    // The gesture still tracks: dragging is direct manipulation, not the
    // vestibular motion the preference is about.
    expect(dragLayer().style.transform).toBe('translateY(90px)');

    await drag.settle();
    await drag.release(190);

    expect(onClose).not.toHaveBeenCalled();
    // No spring ran — the final value was written straight to the motion value.
    expect(animateSpy).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(restingY()).toBe(0);
  });
});

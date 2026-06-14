import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import SlideToComplete from './SlideToComplete';

// SlideToComplete pulls in GSAP, the spark burst, and haptics. None of that is
// relevant to the pointer-down focus behaviour under test, so stub them out to
// keep the test isolated and free of canvas/animation side effects.
// GSAP is stubbed, but the timeline must run its `.add()` callbacks SYNCHRONOUSLY
// so the default-path finish() (which calls onComplete inside the timeline) is
// exercised. useGSAP is dependency-gated via useEffect (like @gsap/react) so it
// runs only when finishTick changes — running it on every render would loop.
vi.mock('../../../lib/gsap', () => {
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
    DUR: { fast: 0, micro: 0, slow: 0 },
    EASE: { pop: 'none', out: 'none', popHard: 'none' },
    gsap: { set: vi.fn(), timeline: () => makeTimeline() },
    useGSAP: (cb: () => void, config?: { dependencies?: unknown[] }) => {
      // biome-ignore lint/correctness/useExhaustiveDependencies: deps mirror the real hook's array.
      useEffect(() => {
        cb();
      }, config?.dependencies ?? []);
    },
  };
});
vi.mock('../../../lib/gsapSparks', () => ({ fireSparks: vi.fn() }));
vi.mock('../../../utils/haptics', () => ({ triggerHaptic: vi.fn() }));
// Reduced-motion is controllable per-test: default true (calm path used by the
// existing suites); the default/animated-path suite flips it to false.
let mockReducedMotion = true;
vi.mock('../../../hooks/useReducedMotion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

// jsdom does not implement the Pointer Capture API; stub it so the pointer-down
// handler can run to completion.
beforeAll(() => {
  const proto = HTMLElement.prototype as unknown as {
    setPointerCapture?: (pointerId: number) => void;
    releasePointerCapture?: (pointerId: number) => void;
  };
  if (!proto.setPointerCapture) {
    proto.setPointerCapture = () => {};
    proto.releasePointerCapture = () => {};
  }
});

describe('SlideToComplete', () => {
  it('focuses the slider on pointer-down so a following Enter activates it', () => {
    // Arrange
    render(<SlideToComplete label="החלק לסימון סט 1/3" onComplete={vi.fn()} />);
    const slider = screen.getByRole('button', { name: 'החלק לסימון סט 1/3' });
    // A previously focused control simulates the real bug: without explicit
    // focus, Enter would activate this other element instead of the slider.
    const other = document.createElement('button');
    document.body.appendChild(other);
    other.focus();
    expect(document.activeElement).toBe(other);

    // Act
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 0 });

    // Assert
    expect(document.activeElement).toBe(slider);

    other.remove();
  });

  it('does not steal focus when disabled', () => {
    // Arrange
    render(<SlideToComplete label="התרגיל הושלם" onComplete={vi.fn()} disabled />);
    const slider = screen.getByRole('button', { name: 'התרגיל הושלם' });
    const other = document.createElement('button');
    document.body.appendChild(other);
    other.focus();

    // Act
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 0 });

    // Assert — disabled slider must not grab focus
    expect(document.activeElement).toBe(other);

    other.remove();
  });
});

describe('SlideToComplete tap-and-hold quick-complete (reduced motion)', () => {
  // jsdom returns width 0 for getBoundingClientRect, which would make the hold
  // ramp bail (maxOffset <= 0). Stub a real track width so the hold can arm.
  const rectSpy = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({
      width: 300,
      height: 68,
      top: 0,
      left: 0,
      right: 300,
      bottom: 68,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('completes after holding for the fill duration without sliding', () => {
    // Arrange — reduced motion path uses a HOLD_FILL_MS timeout (no rAF ramp).
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<SlideToComplete label="החלק לסיום סט 1/3" onComplete={onComplete} />);
    const slider = screen.getByRole('button', { name: 'החלק לסיום סט 1/3' });

    // Act — press and hold, staying put, past the fill duration.
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 0 });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Assert — the set completes from the hold alone (no slide).
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does NOT complete on a brief tap that releases before the fill', () => {
    // Arrange
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<SlideToComplete label="החלק לסיום סט 1/3" onComplete={onComplete} />);
    const slider = screen.getByRole('button', { name: 'החלק לסיום סט 1/3' });

    // Act — quick tap: down then up well before HOLD_FILL_MS, then time passes.
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 0 });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 0 });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Assert — a tap is not a complete; the hold was cancelled on release.
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('cancels the hold on release even after the fill window passes post-release', () => {
    // Arrange — a hold that is released mid-fill must never complete later, even
    // if more than HOLD_FILL_MS elapses after release.
    vi.useFakeTimers();
    const onComplete = vi.fn();
    render(<SlideToComplete label="החלק לסיום סט 1/3" onComplete={onComplete} />);
    const slider = screen.getByRole('button', { name: 'החלק לסיום סט 1/3' });

    // Act
    fireEvent.pointerDown(slider, { pointerId: 1, clientX: 0 });
    act(() => {
      vi.advanceTimersByTime(200); // partway through the fill
    });
    fireEvent.pointerUp(slider, { pointerId: 1, clientX: 0 }); // released early
    act(() => {
      vi.advanceTimersByTime(1000); // well past the original fill window
    });

    // Assert — release cancelled the pending complete.
    expect(onComplete).not.toHaveBeenCalled();
    rectSpy.mockRestore();
  });
});

// The default (animated) path drives the hold fill with requestAnimationFrame +
// performance.now() instead of a setTimeout, and hands the thumb to GSAP without
// resetting offset. A pointer that is STILL DOWN when the ramp auto-completes
// must complete the set exactly once — the later pointerUp from the same gesture
// must not re-fire onComplete (regression: it advanced two sets from one hold).
describe('SlideToComplete tap-and-hold quick-complete (default / animated motion)', () => {
  let rectSpy: { mockRestore: () => void };
  beforeAll(() => {
    mockReducedMotion = false;
  });
  afterAll(() => {
    mockReducedMotion = true;
  });
  beforeEach(() => {
    rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        width: 300,
        height: 68,
        top: 0,
        left: 0,
        right: 300,
        bottom: 68,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
  });
  afterEach(() => {
    rectSpy.mockRestore();
  });

  it('fires onComplete exactly once when the hold ramp auto-completes while still pressed', () => {
    // Arrange — drive a deterministic clock so performance.now() crosses
    // HOLD_FILL_MS, and a synchronous rAF so the ramp runs to ratio>=1 at once.
    let clock = 0;
    const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => clock);
    const rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        // Advance past the fill window so the first step() reaches ratio>=1.
        clock += 500;
        cb(clock);
        return 1;
      });

    const onComplete = vi.fn();
    render(<SlideToComplete label="החלק לסיום סט 1/3" onComplete={onComplete} />);
    const slider = screen.getByRole('button', { name: 'החלק לסיום סט 1/3' });

    // Act — press (arms + auto-completes the ramp), then lift while still down.
    act(() => {
      fireEvent.pointerDown(slider, { pointerId: 1, clientX: 0 });
    });
    act(() => {
      fireEvent.pointerUp(slider, { pointerId: 1, clientX: 0 });
    });

    // Assert — one hold = one completion, never two.
    expect(onComplete).toHaveBeenCalledTimes(1);

    rafSpy.mockRestore();
    nowSpy.mockRestore();
  });
});

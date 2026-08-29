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
vi.mock('../../../utils/haptics', () => ({
  triggerHaptic: vi.fn(),
  triggerHapticEffect: vi.fn(),
}));
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
  // jsdom 23 ships NO PointerEvent constructor, so fireEvent.pointerDown/Move
  // falls back to a bare Event and silently DROPS clientX and pointerId — which
  // would make every position- and velocity-based assertion below pass while
  // testing nothing. Provide the minimum faithful shape: a MouseEvent (which
  // carries clientX) plus pointerId.
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

describe('SlideToComplete', () => {
  it('focuses the slider on pointer-down so a following Enter activates it', () => {
    // Arrange
    render(<SlideToComplete label="החליקו לסיום סט 1" onComplete={vi.fn()} />);
    const slider = screen.getByRole('button', { name: 'החליקו לסיום סט 1' });
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
  const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
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
    render(<SlideToComplete label="החליקו לסיום סט 1" onComplete={onComplete} />);
    const slider = screen.getByRole('button', { name: 'החליקו לסיום סט 1' });

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
    render(<SlideToComplete label="החליקו לסיום סט 1" onComplete={onComplete} />);
    const slider = screen.getByRole('button', { name: 'החליקו לסיום סט 1' });

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
    render(<SlideToComplete label="החליקו לסיום סט 1" onComplete={onComplete} />);
    const slider = screen.getByRole('button', { name: 'החליקו לסיום סט 1' });

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
    rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
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
    render(<SlideToComplete label="החליקו לסיום סט 1" onComplete={onComplete} />);
    const slider = screen.getByRole('button', { name: 'החליקו לסיום סט 1' });

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

// ---------------------------------------------------------------------------
// Release MOMENTUM. The release used to be a pure position test: a fast flick
// let go at 43% of the track was discarded exactly like a crawl abandoned at
// 43%. The release now decides from a PROJECTED resting point
// (offset + velocity * 0.499), so a thrown thumb completes the set and a
// creeping one still does not.
//
// Track width 300 → maxOffset = 300 - 60 (thumb) - 8 (padding) = 232px.
// The position gate is THRESHOLD 0.75 → 174px, so every gesture below stops at
// 100px: under the old position gate ALL of them failed.
// ---------------------------------------------------------------------------
describe('SlideToComplete release momentum', () => {
  const TRACK_RECT = {
    width: 300,
    height: 68,
    top: 0,
    left: 0,
    right: 300,
    bottom: 68,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;

  let rectSpy: { mockRestore: () => void };
  let nowSpy: { mockRestore: () => void };
  let clock = 0;

  beforeEach(() => {
    clock = 0;
    rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(TRACK_RECT);
    // Velocity is derived from performance.now() deltas, so the clock has to be
    // deterministic — the gesture speed IS the thing under test.
    nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => clock);
  });
  afterEach(() => {
    rectSpy.mockRestore();
    nowSpy.mockRestore();
  });

  it('completes on a FAST FLICK released well short of the position threshold', () => {
    // Arrange
    const onComplete = vi.fn();
    render(<SlideToComplete label="החליקו לסיום סט 1" onComplete={onComplete} />);
    const slider = screen.getByRole('button', { name: 'החליקו לסיום סט 1' });

    // Act — 100px in 40ms = 2500px/s. Projected rest:
    // 100 + 2500 * 0.499 = ~1347px, far past the 174px commit point.
    act(() => {
      fireEvent.pointerDown(slider, { pointerId: 1, clientX: 0 });
    });
    clock += 40;
    act(() => {
      fireEvent.pointerMove(slider, { pointerId: 1, clientX: 100 });
    });
    clock += 10; // released while still moving — momentum is real
    act(() => {
      fireEvent.pointerUp(slider, { pointerId: 1, clientX: 100 });
    });

    // Assert — a thrown thumb completes the set from 43% of the track.
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does NOT complete on a slow CRAWL to the same distance', () => {
    // Arrange — the control that proves the gate is momentum, not a lowered
    // distance threshold.
    const onComplete = vi.fn();
    render(<SlideToComplete label="החליקו לסיום סט 1" onComplete={onComplete} />);
    const slider = screen.getByRole('button', { name: 'החליקו לסיום סט 1' });

    // Act — the same 100px, but over 1.2s: ~83px/s, projecting only ~41px more.
    act(() => {
      fireEvent.pointerDown(slider, { pointerId: 1, clientX: 0 });
    });
    for (const x of [25, 50, 75, 100]) {
      clock += 300;
      act(() => {
        fireEvent.pointerMove(slider, { pointerId: 1, clientX: x });
      });
    }
    clock += 10;
    act(() => {
      fireEvent.pointerUp(slider, { pointerId: 1, clientX: 100 });
    });

    // Assert — no momentum, no commit.
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('gives a finger that STOPPED before lifting no momentum credit', () => {
    // Arrange — a fast drag that comes to rest before release is an abandoned
    // gesture, not a throw. Stale samples must not be credited.
    const onComplete = vi.fn();
    render(<SlideToComplete label="החליקו לסיום סט 1" onComplete={onComplete} />);
    const slider = screen.getByRole('button', { name: 'החליקו לסיום סט 1' });

    // Act — 100px in 40ms (fast), then the finger rests 200ms before lifting.
    act(() => {
      fireEvent.pointerDown(slider, { pointerId: 1, clientX: 0 });
    });
    clock += 40;
    act(() => {
      fireEvent.pointerMove(slider, { pointerId: 1, clientX: 100 });
    });
    clock += 200; // held still — the throw was called off
    act(() => {
      fireEvent.pointerUp(slider, { pointerId: 1, clientX: 100 });
    });

    // Assert
    expect(onComplete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Interruptible snap-home, and the presentation-value rule.
//
// The return journey used to be a CSS transition, which cannot be grabbed
// mid-flight, and the re-grab seeded its start offset from `offset` STATE that
// had already been set to 0 — so the thumb teleported to the finger. It is a
// spring now, and the grab is seeded from the live on-screen value.
// ---------------------------------------------------------------------------
describe('SlideToComplete re-grab during the snap-home', () => {
  const TRACK_RECT = {
    width: 300,
    height: 68,
    top: 0,
    left: 0,
    right: 300,
    bottom: 68,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;

  let rectSpy: { mockRestore: () => void };
  let nowSpy: { mockRestore: () => void };
  let clock = 0;

  beforeAll(() => {
    mockReducedMotion = false; // the spring path is the one under test
  });
  afterAll(() => {
    mockReducedMotion = true;
  });
  beforeEach(() => {
    clock = 0;
    rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(TRACK_RECT);
    nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => clock);
  });
  afterEach(() => {
    rectSpy.mockRestore();
    nowSpy.mockRestore();
  });

  /** The thumb is the only element carrying a translateX transform. */
  const thumbOf = (slider: HTMLElement) =>
    Array.from(slider.querySelectorAll('div')).find((d) =>
      d.style.transform.includes('translateX')
    );

  it('continues from the live thumb position instead of jumping to the finger', () => {
    // Arrange
    render(<SlideToComplete label="החליקו לסיום סט 1" onComplete={vi.fn()} />);
    const slider = screen.getByRole('button', { name: 'החליקו לסיום סט 1' });

    // Act 1 — crawl to 100px and release short of the threshold (~83px/s
    // projects only ~41px more, well under the 174px commit point): the
    // snap-home spring takes the thumb, starting from 100px.
    act(() => {
      fireEvent.pointerDown(slider, { pointerId: 1, clientX: 0 });
    });
    for (const x of [25, 50, 75, 100]) {
      clock += 300;
      act(() => {
        fireEvent.pointerMove(slider, { pointerId: 1, clientX: x });
      });
    }
    clock += 10;
    act(() => {
      fireEvent.pointerUp(slider, { pointerId: 1, clientX: 100 });
    });
    expect(thumbOf(slider)?.style.transform).toBe('translateX(100px)');

    // Act 2 — grab again mid-return, at a completely different screen x, and
    // move 10px. The grab must interrupt the spring and continue from the live
    // 100px, NOT restart from 0 (which is what the state-seeded version did).
    act(() => {
      fireEvent.pointerDown(slider, { pointerId: 2, clientX: 200 });
    });
    clock += 16;
    act(() => {
      fireEvent.pointerMove(slider, { pointerId: 2, clientX: 210 });
    });

    // Assert — 100 (live) + 10 (finger), not 10.
    expect(thumbOf(slider)?.style.transform).toBe('translateX(110px)');
  });
});

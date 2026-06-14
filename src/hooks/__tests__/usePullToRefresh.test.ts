// Tests for usePullToRefresh's one-shot "armed" haptic: it must fire exactly
// once when the pull first crosses the threshold, re-arm if the user eases back
// below it, and reset for the next pull.

import { act, renderHook } from '@testing-library/react';
import type { TouchEvent as ReactTouchEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const triggerHapticEffect = vi.fn();
vi.mock('../../utils/haptics', () => ({
  triggerHapticEffect: (...args: unknown[]) => triggerHapticEffect(...args),
}));

import { usePullToRefresh } from '../usePullToRefresh';

// Build a minimal touch event carrying a single clientY.
const touchAt = (clientY: number): ReactTouchEvent<HTMLElement> =>
  ({ touches: [{ clientY }] }) as unknown as ReactTouchEvent<HTMLElement>;

const THRESHOLD = 80;

describe('usePullToRefresh — armed haptic', () => {
  beforeEach(() => {
    triggerHapticEffect.mockClear();
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true, configurable: true });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setup = () =>
    renderHook(() =>
      usePullToRefresh({ onRefresh: () => Promise.resolve(), threshold: THRESHOLD })
    );

  it('fires the tap haptic once when the pull first crosses the threshold', () => {
    const { result } = setup();
    act(() => result.current.handlers.onTouchStart(touchAt(0)));
    act(() => result.current.handlers.onTouchMove(touchAt(THRESHOLD + 1)));

    expect(triggerHapticEffect).toHaveBeenCalledTimes(1);
    expect(triggerHapticEffect).toHaveBeenCalledWith('tap');
  });

  it('does not re-fire on subsequent frames still past the threshold', () => {
    const { result } = setup();
    act(() => result.current.handlers.onTouchStart(touchAt(0)));
    act(() => result.current.handlers.onTouchMove(touchAt(THRESHOLD + 1)));
    act(() => result.current.handlers.onTouchMove(touchAt(THRESHOLD + 50)));
    act(() => result.current.handlers.onTouchMove(touchAt(THRESHOLD + 120)));

    expect(triggerHapticEffect).toHaveBeenCalledTimes(1);
  });

  it('re-arms when the user eases back below the threshold within one pull', () => {
    const { result } = setup();
    act(() => result.current.handlers.onTouchStart(touchAt(0)));
    act(() => result.current.handlers.onTouchMove(touchAt(THRESHOLD + 5))); // cross → 1
    act(() => result.current.handlers.onTouchMove(touchAt(THRESHOLD - 30))); // back below → re-arm
    act(() => result.current.handlers.onTouchMove(touchAt(THRESHOLD + 5))); // cross again → 2

    expect(triggerHapticEffect).toHaveBeenCalledTimes(2);
  });

  it('never fires while the pull stays below the threshold', () => {
    const { result } = setup();
    act(() => result.current.handlers.onTouchStart(touchAt(0)));
    act(() => result.current.handlers.onTouchMove(touchAt(THRESHOLD - 10)));
    act(() => result.current.handlers.onTouchMove(touchAt(THRESHOLD - 1)));

    expect(triggerHapticEffect).not.toHaveBeenCalled();
  });

  it('resets the guard for a fresh pull after touch end', async () => {
    const { result } = setup();
    // First pull crosses.
    act(() => result.current.handlers.onTouchStart(touchAt(0)));
    act(() => result.current.handlers.onTouchMove(touchAt(THRESHOLD + 5)));
    await act(async () => {
      await result.current.handlers.onTouchEnd();
    });
    // Second pull crosses again → fires again.
    act(() => result.current.handlers.onTouchStart(touchAt(0)));
    act(() => result.current.handlers.onTouchMove(touchAt(THRESHOLD + 5)));

    expect(triggerHapticEffect).toHaveBeenCalledTimes(2);
  });
});

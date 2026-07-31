import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OVERLAY_EXIT_MS, useMountWhileOpen } from '../useMountWhileOpen';

describe('useMountWhileOpen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not mount a surface that has never been opened', () => {
    // The whole point: a sheet the user never touches must not construct
    // ModalOverlay, its focus trap, its motion values or its portal.
    const { result } = renderHook(() => useMountWhileOpen(false));
    expect(result.current).toBe(false);
  });

  it('mounts immediately on open', () => {
    const { result, rerender } = renderHook(({ open }) => useMountWhileOpen(open), {
      initialProps: { open: false },
    });
    expect(result.current).toBe(false);

    rerender({ open: true });
    expect(result.current).toBe(true);
  });

  it('keeps the surface mounted through the exit animation, then drops it', () => {
    const { result, rerender } = renderHook(({ open }) => useMountWhileOpen(open), {
      initialProps: { open: true },
    });
    expect(result.current).toBe(true);

    // Close — the subtree must survive so AnimatePresence can play the exit.
    rerender({ open: false });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(OVERLAY_EXIT_MS - 1);
    });
    expect(result.current).toBe(true);

    // Exit finished — now it is safe to stop paying for it.
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current).toBe(false);
  });

  it('cancels the pending unmount when reopened mid-exit', () => {
    const { result, rerender } = renderHook(({ open }) => useMountWhileOpen(open), {
      initialProps: { open: true },
    });

    rerender({ open: false });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    // Reopen before the exit window elapses.
    rerender({ open: true });

    act(() => {
      vi.advanceTimersByTime(OVERLAY_EXIT_MS * 2);
    });

    // Still mounted: the stale unmount must not fire under the reopened sheet.
    expect(result.current).toBe(true);
  });
});

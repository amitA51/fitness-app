import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pendingLiveActivity, useLiveTracker } from '../useLiveTracker';

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-11T07:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('useLiveTracker', () => {
  it('counts moving time from timestamps and stops it while paused', () => {
    const { result } = renderHook(() => useLiveTracker('treadmill'));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    act(() => result.current.pause());
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    act(() => result.current.resume());
    act(() => {
      vi.advanceTimersByTime(15_000);
    });
    expect(result.current.movingSec).toBe(75);
  });

  it('survives a reload: an unfinished session comes back', () => {
    const first = renderHook(() => useLiveTracker('treadmill'));
    act(() => first.result.current.start());
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    first.unmount();

    expect(pendingLiveActivity()).toBe('treadmill');
    const second = renderHook(() => useLiveTracker('run'));
    expect(second.result.current.restored).toBe(true);
    expect(second.result.current.activity).toBe('treadmill');
    expect(second.result.current.phase).toBe('running');
  });

  it('never resurrects a saved session (the unmount flush used to write it back)', () => {
    const { result, unmount } = renderHook(() => useLiveTracker('treadmill'));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    act(() => result.current.finish());
    act(() => result.current.complete());
    unmount();
    expect(pendingLiveActivity()).toBeNull();
  });

  it('never resurrects a discarded session', () => {
    const { result, unmount } = renderHook(() => useLiveTracker('run'));
    act(() => result.current.start());
    act(() => result.current.discard());
    unmount();
    expect(pendingLiveActivity()).toBeNull();
  });
});

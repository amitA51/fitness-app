import { act, renderHook } from '@testing-library/react';
import type React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkoutDispatchProvider, WorkoutStateProvider } from '../../core/WorkoutContext';
import type { WorkoutState } from '../../core/workoutTypes';
import { useRestTimer } from '../useWorkoutTimer';

// Mock the audio module so we can assert whether the rest-end ding fired
// without producing real sound in jsdom.
const playDing = vi.fn();
vi.mock('../../../../utils/audio', () => ({
  playDing: (...args: unknown[]) => playDing(...args),
}));

const dispatch = vi.fn();

// Minimal state — only the fields useRestTimer reads via useWorkoutSettingsRaw.
const makeState = (restTimerSound?: boolean): WorkoutState =>
  ({
    appSettings: {
      workoutSettings: restTimerSound === undefined ? {} : { restTimerSound },
    },
  }) as unknown as WorkoutState;

const makeWrapper =
  (state: WorkoutState) =>
  ({ children }: { children: React.ReactNode }) => (
    <WorkoutDispatchProvider value={dispatch}>
      <WorkoutStateProvider value={state}>{children}</WorkoutStateProvider>
    </WorkoutDispatchProvider>
  );

describe('useRestTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    playDing.mockClear();
    dispatch.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds the frozen remaining time and does NOT ding when endTime is negative (paused)', () => {
    // Arrange — a paused timer encodes 30s remaining as endTime = -30000.
    const wrapper = makeWrapper(makeState());
    const { result } = renderHook(() => useRestTimer(-30000, true), { wrapper });

    // Act — let plenty of ticks elapse.
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Assert — display holds at the frozen 30s (not 00:00) and no ding fired.
    expect(result.current.timeLeft).toBe(30);
    expect(result.current.formatted).toBe('00:30');
    expect(playDing).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('dings and dispatches SYNC_REST_TIMER when an active timer reaches zero', () => {
    // Arrange — a real timer that expires ~200ms from now.
    const endTime = Date.now() + 200;
    const wrapper = makeWrapper(makeState());
    const { result } = renderHook(() => useRestTimer(endTime, true), { wrapper });

    // Act — advance past expiry.
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Assert.
    expect(result.current.timeLeft).toBe(0);
    expect(playDing).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'SYNC_REST_TIMER' });
  });

  it('still dispatches SYNC_REST_TIMER but skips the ding when restTimerSound is disabled', () => {
    // Arrange — user disabled the rest-timer sound but the timer still expires.
    const endTime = Date.now() + 200;
    const wrapper = makeWrapper(makeState(false));
    renderHook(() => useRestTimer(endTime, true), { wrapper });

    // Act.
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Assert — no ding, but the reducer is still synced so the timer clears.
    expect(playDing).not.toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: 'SYNC_REST_TIMER' });
  });
});

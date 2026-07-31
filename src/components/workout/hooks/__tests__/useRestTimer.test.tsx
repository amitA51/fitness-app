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

// Mock the web platform adapter so we can drive visibility transitions and
// assert the screen-off rest-end notification scheduling without a real DOM
// notification surface.
const hasNotificationPermission = vi.fn(() => true);
const requestNotificationPermission = vi.fn(async () => true);
const showRestEndNotification = vi.fn();
const clearRestEndNotification = vi.fn();
// Holds every live visibility callback so a test can simulate hide/return.
// Both the screen-off notification effect AND the countdown resync subscribe,
// so this has to fan out rather than keep only the last registration.
let visibilityCbs: ((hidden: boolean) => void)[] = [];
const emitVisibility = (hidden: boolean) => {
  for (const cb of [...visibilityCbs]) cb(hidden);
};
const onVisibilityChange = vi.fn((cb: (hidden: boolean) => void) => {
  visibilityCbs.push(cb);
  return () => {
    visibilityCbs = visibilityCbs.filter((c) => c !== cb);
  };
});
vi.mock('../../../../platform/web', () => ({
  webPlatform: {
    hasNotificationPermission: () => hasNotificationPermission(),
    requestNotificationPermission: () => requestNotificationPermission(),
    showRestEndNotification: (...args: unknown[]) => showRestEndNotification(...args),
    clearRestEndNotification: () => clearRestEndNotification(),
    onVisibilityChange: (cb: (hidden: boolean) => void) => onVisibilityChange(cb),
  },
}));

// jsdom reports 'visible' by default; this flips document.visibilityState so the
// arm-time initial-visibility probe in useRestTimer sees a backgrounded tab.
const setHidden = (hidden: boolean) => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => (hidden ? 'hidden' : 'visible'),
  });
};

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
    hasNotificationPermission.mockClear();
    hasNotificationPermission.mockReturnValue(true);
    requestNotificationPermission.mockClear();
    showRestEndNotification.mockClear();
    clearRestEndNotification.mockClear();
    onVisibilityChange.mockClear();
    visibilityCbs = [];
    setHidden(false);
  });

  afterEach(() => {
    setHidden(false);
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

  it('schedules the screen-off notification immediately when armed while ALREADY hidden', () => {
    // Arrange — the tab is already backgrounded BEFORE the rest timer arms
    // (e.g. user opened a rest, switched apps, then a +15s landed). onHidden
    // won't fire again until the next visibility change, so the arm-time probe
    // must schedule on its own.
    setHidden(true);
    const endTime = Date.now() + 30000;
    const wrapper = makeWrapper(makeState());
    renderHook(() => useRestTimer(endTime, true, false, '60ק״ג × 8'), { wrapper });

    // Act — let the scheduled timeout fire at endTime.
    act(() => {
      vi.advanceTimersByTime(30001);
    });

    // Assert — the OS notification fired exactly once with the next-set body.
    expect(showRestEndNotification).toHaveBeenCalledTimes(1);
    expect(showRestEndNotification.mock.calls[0]?.[0]).toBe('60ק״ג × 8');
  });

  it('reschedules when endTime changes (+15s) while the tab stays hidden', () => {
    // Arrange — armed while hidden; the first arm schedules a fire at +20s.
    setHidden(true);
    const base = Date.now();
    const wrapper = makeWrapper(makeState());
    const { rerender } = renderHook(
      ({ endTime }: { endTime: number }) => useRestTimer(endTime, true, false),
      { wrapper, initialProps: { endTime: base + 20000 } }
    );

    // Act — user taps +15s while still backgrounded → endTime moves to +35s.
    // The effect cleanup clears the stale fire, then the arm-time probe (still
    // hidden) reschedules to the new endTime.
    rerender({ endTime: base + 35000 });

    // Old fire window passes with no notification (it was cancelled)…
    act(() => {
      vi.advanceTimersByTime(20001);
    });
    expect(showRestEndNotification).not.toHaveBeenCalled();

    // …and the notification fires at the NEW endTime instead.
    act(() => {
      vi.advanceTimersByTime(15000);
    });
    expect(showRestEndNotification).toHaveBeenCalledTimes(1);
    // Re-arm cleanup must have cleared the stale notification before rescheduling.
    expect(clearRestEndNotification).toHaveBeenCalled();
  });

  it('does not double-schedule on a real hide transition that follows the arm-time probe', () => {
    // Arrange — armed while hidden (probe schedules once)…
    setHidden(true);
    const endTime = Date.now() + 30000;
    const wrapper = makeWrapper(makeState());
    renderHook(() => useRestTimer(endTime, true, false), { wrapper });

    // Act — a subsequent real hide transition re-invokes onHidden(true).
    act(() => {
      emitVisibility(true);
    });
    // Let the single fire window elapse.
    act(() => {
      vi.advanceTimersByTime(30001);
    });

    // Assert — onHidden(true) clears the prior pending fire before rescheduling,
    // so exactly one notification fires (idempotent, no duplicate cue).
    expect(showRestEndNotification).toHaveBeenCalledTimes(1);
  });

  it('clears the pending notification when the tab returns to the foreground', () => {
    // Arrange — armed while hidden, fire pending at +30s.
    setHidden(true);
    const endTime = Date.now() + 30000;
    const wrapper = makeWrapper(makeState());
    renderHook(() => useRestTimer(endTime, true, false), { wrapper });

    // Act — user returns to the app before rest ends.
    act(() => {
      setHidden(false);
      emitVisibility(false);
      vi.advanceTimersByTime(30001);
    });

    // Assert — no screen-off notification fires; the foreground path takes over.
    expect(clearRestEndNotification).toHaveBeenCalled();
    expect(showRestEndNotification).not.toHaveBeenCalled();
  });

  it('does not schedule while hidden when notification permission is missing', () => {
    // Arrange — backgrounded but permission not yet granted: the arm-time probe
    // must prompt once and NOT schedule (next rest retries after grant).
    hasNotificationPermission.mockReturnValue(false);
    setHidden(true);
    const endTime = Date.now() + 30000;
    const wrapper = makeWrapper(makeState());
    renderHook(() => useRestTimer(endTime, true, false), { wrapper });

    // Act.
    act(() => {
      vi.advanceTimersByTime(30001);
    });

    // Assert — prompted contextually, but nothing scheduled without permission.
    expect(requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(showRestEndNotification).not.toHaveBeenCalled();
  });

  it('commits once per second, not ten times per second, while counting down', () => {
    // Arrange — the measured regression: a 100ms poll storing a FLOAT re-rendered
    // the consumer ~10x/second for a display that only changes at 1Hz (54 commits
    // across 5 idle seconds of rest). Advance in 100ms steps, each in its own
    // act(), so React can't batch 5 seconds of ticks into one commit and hide the
    // real rate — under the old implementation all 50 steps committed.
    const endTime = Date.now() + 5000;
    const wrapper = makeWrapper(makeState());
    let renders = 0;
    renderHook(
      () => {
        renders += 1;
        return useRestTimer(endTime, true);
      },
      { wrapper }
    );
    const rendersAfterMount = renders;

    // Act — five full seconds of rest with no user interaction.
    for (let step = 0; step < 50; step += 1) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }

    // Assert — one commit per elapsed second (5), plus at most one for the
    // terminal 0 tick. Not ~50.
    const countdownRenders = renders - rendersAfterMount;
    expect(countdownRenders).toBeLessThanOrEqual(6);
    expect(countdownRenders).toBeGreaterThanOrEqual(4);
  });

  it('ticks on the second boundary when rest starts mid-second', () => {
    // Arrange — 2400ms of rest: the first displayed change must happen after
    // 400ms (03 → 02), not after a flat 1000ms, otherwise the countdown drifts
    // and the final second is visibly short.
    const endTime = Date.now() + 2400;
    const wrapper = makeWrapper(makeState());
    const { result } = renderHook(() => useRestTimer(endTime, true), { wrapper });

    expect(result.current.timeLeft).toBe(3);

    // Act / Assert — just before the boundary nothing has changed…
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(result.current.timeLeft).toBe(3);

    // …and crossing it drops exactly one second.
    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current.timeLeft).toBe(2);
  });

  it('resyncs the remaining time when the tab returns after being throttled', () => {
    // Arrange — background tabs throttle timers to as little as once per minute,
    // so a 90s rest could show a stale number on return. The countdown must
    // recompute from the clock on the visibility transition back.
    const start = Date.now();
    const endTime = start + 90000;
    const wrapper = makeWrapper(makeState());
    const { result } = renderHook(() => useRestTimer(endTime, true), { wrapper });
    expect(result.current.timeLeft).toBe(90);

    // Act — simulate a throttled background: move the clock forward WITHOUT
    // letting the pending timeout run, then return to the foreground.
    act(() => {
      vi.setSystemTime(start + 40000);
      emitVisibility(false);
    });

    // Assert — the display caught up instead of holding at 90.
    expect(result.current.timeLeft).toBe(50);
  });
});

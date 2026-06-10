// ============================================================================
// COACH PLATFORM — realtime inbox helpers (messages hub)
// ============================================================================
// Covers the hub-level subscription helpers (channel setup, filter, cleanup
// via removeChannel, unconfigured no-op) and the pure throttle used to cap
// realtime-driven summary refreshes at one per second.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Supabase mock — channel builder + registry ───────────────────────────────
const mockOn = vi.fn();
const mockSubscribe = vi.fn();
const channelObj: Record<string, unknown> = {};
channelObj.on = mockOn;
channelObj.subscribe = mockSubscribe;
mockOn.mockReturnValue(channelObj);
mockSubscribe.mockReturnValue(channelObj);

const mockChannel = vi.fn((..._args: unknown[]) => channelObj);
const mockRemoveChannel = vi.fn((..._args: unknown[]) => undefined);

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

import { isSupabaseConfigured } from '../../../lib/supabase';
import {
  createThrottledRefresh,
  subscribeToCoachClientMessages,
  subscribeToCoachGroupMessages,
} from '../realtime';

const mockIsConfigured = vi.mocked(isSupabaseConfigured);

beforeEach(() => {
  vi.clearAllMocks();
  mockIsConfigured.mockReturnValue(true);
  mockOn.mockReturnValue(channelObj);
  mockSubscribe.mockReturnValue(channelObj);
  mockChannel.mockReturnValue(channelObj);
});

// ── subscribeToCoachClientMessages ───────────────────────────────────────────

describe('subscribeToCoachClientMessages', () => {
  it('subscribes to messages INSERTs filtered on coach_id and fires onActivity', () => {
    const onActivity = vi.fn();
    subscribeToCoachClientMessages('coach-1', onActivity);

    expect(mockChannel).toHaveBeenCalledTimes(1);
    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: 'coach_id=eq.coach-1',
      },
      expect.any(Function)
    );
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    // Simulate an inbound realtime event through the registered callback.
    const callback = mockOn.mock.calls[0][2] as (payload: unknown) => void;
    callback({ new: { id: 'm1' } });
    expect(onActivity).toHaveBeenCalledTimes(1);
  });

  it('cleans up via supabase.removeChannel (not channel.unsubscribe)', () => {
    const unsubscribe = subscribeToCoachClientMessages('coach-1', vi.fn());
    unsubscribe();
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
    expect(mockRemoveChannel).toHaveBeenCalledWith(channelObj);
  });

  it('no-ops when Supabase is unconfigured or coachId is empty', () => {
    mockIsConfigured.mockReturnValue(false);
    expect(subscribeToCoachClientMessages('coach-1', vi.fn())()).toBeUndefined();
    mockIsConfigured.mockReturnValue(true);
    expect(subscribeToCoachClientMessages('', vi.fn())()).toBeUndefined();
    expect(mockChannel).not.toHaveBeenCalled();
  });

  it('returns a no-op unsubscribe when channel setup throws', () => {
    mockChannel.mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const unsubscribe = subscribeToCoachClientMessages('coach-1', vi.fn());
    expect(() => unsubscribe()).not.toThrow();
    expect(mockRemoveChannel).not.toHaveBeenCalled();
  });
});

// ── subscribeToCoachGroupMessages ────────────────────────────────────────────

describe('subscribeToCoachGroupMessages', () => {
  it('subscribes broadly to group_messages INSERTs (RLS-scoped) and fires onActivity', () => {
    const onActivity = vi.fn();
    subscribeToCoachGroupMessages(onActivity);

    expect(mockOn).toHaveBeenCalledWith(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'group_messages' },
      expect.any(Function)
    );

    const callback = mockOn.mock.calls[0][2] as (payload: unknown) => void;
    callback({ new: { id: 'gm1' } });
    expect(onActivity).toHaveBeenCalledTimes(1);
  });

  it('cleans up via supabase.removeChannel', () => {
    const unsubscribe = subscribeToCoachGroupMessages(vi.fn());
    unsubscribe();
    expect(mockRemoveChannel).toHaveBeenCalledWith(channelObj);
  });

  it('no-ops when Supabase is unconfigured', () => {
    mockIsConfigured.mockReturnValue(false);
    expect(subscribeToCoachGroupMessages(vi.fn())()).toBeUndefined();
    expect(mockChannel).not.toHaveBeenCalled();
  });
});

// ── createThrottledRefresh ───────────────────────────────────────────────────

describe('createThrottledRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires immediately on the first call (leading edge)', () => {
    const fn = vi.fn();
    const throttled = createThrottledRefresh(fn, 1000);
    throttled.run();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('collapses a burst into one trailing call after the interval', () => {
    const fn = vi.fn();
    const throttled = createThrottledRefresh(fn, 1000);

    throttled.run(); // leading
    throttled.run();
    throttled.run();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(999);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(2); // trailing call, burst not lost
  });

  it('allows a new immediate call once the interval has elapsed', () => {
    const fn = vi.fn();
    const throttled = createThrottledRefresh(fn, 1000);

    throttled.run();
    vi.advanceTimersByTime(1000);
    throttled.run();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('never fires more than once per interval during a sustained storm', () => {
    const fn = vi.fn();
    const throttled = createThrottledRefresh(fn, 1000);

    // 10 events every 100ms over 5 seconds.
    for (let t = 0; t < 50; t++) {
      throttled.run();
      vi.advanceTimersByTime(100);
    }
    vi.advanceTimersByTime(1000); // flush any pending trailing call
    // 5 seconds of storm → at most 1 leading + 5 spaced calls.
    expect(fn.mock.calls.length).toBeLessThanOrEqual(6);
    expect(fn.mock.calls.length).toBeGreaterThanOrEqual(5);
  });

  it('cancel() drops a pending trailing call', () => {
    const fn = vi.fn();
    const throttled = createThrottledRefresh(fn, 1000);

    throttled.run(); // leading
    throttled.run(); // schedules trailing
    throttled.cancel();
    vi.advanceTimersByTime(2000);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

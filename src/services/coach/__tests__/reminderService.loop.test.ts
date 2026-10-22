// ============================================================================
// Open-app reminder loop — single-flight, visible-only, cached list.
//
// The loop used to re-read the whole reminder list from the server every 60 s,
// with no guard against overlapping runs and no regard for a hidden tab. Under
// an overloaded database that stacked requests from every open device. Now due
// reminders are checked every minute against a cached list, and the list is
// re-read at most every REMINDERS_REFRESH_MS, one request at a time, only while
// the tab is visible.
// ============================================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  USER: 'trainee-1',
  reminders: [] as Record<string, unknown>[],
  /** When set, the reminders read waits on this instead of answering at once. */
  gate: null as Promise<void> | null,
  fail: false,
  readCount: 0,
  showNotification: vi.fn(async () => undefined),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: vi.fn(() => true),
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(async () => {
          h.readCount += 1;
          if (h.gate) await h.gate;
          if (h.fail) return { data: null, error: { message: '503', code: '' } };
          return { data: h.reminders, error: null };
        }),
      })),
    })),
  },
}));

vi.mock('../../supabaseAuth', () => ({
  getCurrentUser: vi.fn(async () => ({ id: h.USER })),
}));

vi.mock('../../notificationService', () => ({
  showNotification: h.showNotification,
}));

type ReminderModule = typeof import('../reminderService');

let hidden = false;
Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });

const setVisibility = (isHidden: boolean): void => {
  hidden = isHidden;
  document.dispatchEvent(new Event('visibilitychange'));
};

/** A reminder due at the given LOCAL hour:minute. */
const dueAt = (id: string, time: string): Record<string, unknown> => ({
  id,
  coach_id: 'coach-1',
  client_id: h.USER,
  group_id: null,
  title: `תזכורת ${id}`,
  body: null,
  schedule: { time },
  created_at: '2026-01-01T00:00:00Z',
});

const flush = async (): Promise<void> => {
  // Let the awaited chain (auth → read → fire) settle without moving the clock.
  await vi.advanceTimersByTimeAsync(0);
};

let mod: ReminderModule;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 0, 5, 9, 0, 30)); // 09:00:30 local
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  h.USER = 'trainee-1';
  h.reminders = [];
  h.gate = null;
  h.fail = false;
  h.readCount = 0;
  hidden = false;
  // Fresh module per test: the cache is module state.
  mod = await import('../reminderService');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('getMyRemindersCached', () => {
  it('shares one server read between concurrent callers (single-flight)', async () => {
    let open: () => void = () => {};
    h.gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    h.reminders = [dueAt('a', '09:01')];

    const first = mod.getMyRemindersCached();
    const second = mod.getMyRemindersCached();
    await flush();
    open();
    const [a, b] = await Promise.all([first, second]);

    expect(h.readCount).toBe(1);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('re-reads the list at most once per refresh interval', async () => {
    await mod.getMyRemindersCached();
    await mod.getMyRemindersCached();
    expect(h.readCount).toBe(1);

    await vi.advanceTimersByTimeAsync(mod.REMINDERS_REFRESH_MS);
    await mod.getMyRemindersCached();
    await flush();

    expect(h.readCount).toBe(2);
  });

  it("keeps each account's list apart: a late answer for one never displaces another's", async () => {
    h.USER = 'user-b';
    h.reminders = [dueAt('b-1', '09:01')];
    expect(await mod.getMyRemindersCached()).toHaveLength(1);

    // Account A's first read hangs, then lands after B is back.
    let open: () => void = () => {};
    h.gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    h.USER = 'user-a';
    const slowA = mod.getMyRemindersCached();
    await flush();
    h.USER = 'user-b';
    h.gate = null;
    open();
    await slowA;

    expect(await mod.getMyRemindersCached()).toHaveLength(1);
  });

  it('keeps the last good list when a re-read fails', async () => {
    h.reminders = [dueAt('a', '09:01')];
    await mod.getMyRemindersCached();

    h.fail = true;
    await vi.advanceTimersByTimeAsync(mod.REMINDERS_REFRESH_MS);
    const list = await mod.getMyRemindersCached();
    await flush();

    expect(h.readCount).toBe(2);
    expect(list).toHaveLength(1);
    expect(await mod.getMyRemindersCached()).toHaveLength(1);
  });
});

describe('startReminderLoop', () => {
  it('fires a due reminder from the cached list without re-reading every minute', async () => {
    h.reminders = [dueAt('a', '09:02')];
    const stop = mod.startReminderLoop();
    await flush();
    expect(h.readCount).toBe(1);

    // 09:01:30 and 09:02:30 — two local checks, still the one server read.
    await vi.advanceTimersByTimeAsync(2 * mod.REMINDERS_TICK_MS);

    expect(h.readCount).toBe(1);
    expect(h.showNotification).toHaveBeenCalledTimes(1);
    stop();
  });

  it('does nothing while the tab is hidden, and catches up when it is shown', async () => {
    hidden = true;
    const stop = mod.startReminderLoop();
    await vi.advanceTimersByTimeAsync(3 * mod.REMINDERS_TICK_MS);
    expect(h.readCount).toBe(0);

    setVisibility(false);
    await flush();
    expect(h.readCount).toBe(1);

    setVisibility(true);
    await vi.advanceTimersByTimeAsync(10 * mod.REMINDERS_TICK_MS);
    expect(h.readCount).toBe(1);

    // Back after more than REMINDERS_REFRESH_MS: the stale list is re-read.
    setVisibility(false);
    await flush();
    expect(h.readCount).toBe(2);
    stop();
  });

  it('skips a tick while the previous run is still waiting on the server', async () => {
    let open: () => void = () => {};
    h.gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const stop = mod.startReminderLoop();

    // The first read hangs for three ticks; no second request is stacked on it.
    await vi.advanceTimersByTimeAsync(3 * mod.REMINDERS_TICK_MS);
    expect(h.readCount).toBe(1);

    open();
    await flush();
    stop();
  });

  it('stops for good when the returned function is called', async () => {
    const stop = mod.startReminderLoop();
    await flush();
    stop();

    await vi.advanceTimersByTimeAsync(mod.REMINDERS_REFRESH_MS * 2);
    setVisibility(false);
    await flush();

    expect(h.readCount).toBe(1);
  });
});

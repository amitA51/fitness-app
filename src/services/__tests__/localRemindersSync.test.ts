// Device-side reminder sync — the plugin is reached through `window.Capacitor`,
// so these tests inject that global instead of importing any @capacitor/* package
// (src must keep importing zero of them; the same bundle ships as a PWA).
//
// The clock is pinned to Monday 2026-09-28 10:00 local, because the rolling
// window's ids are offsets from "today" and would otherwise drift daily.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkoutSession } from '../../types';
import { toRestDayKey } from '../../utils/restDays';
import {
  REMINDER_CHANNEL_ID,
  REMINDER_CHANNEL_NAME,
  RESERVED_REMINDER_IDS,
  type ReminderRequest,
} from '../localReminders';
import { requestReminderPermission, syncReminders } from '../localRemindersSync';
import { getNotificationConfig } from '../notificationService';

const getWorkoutSessions = vi.fn(async (): Promise<WorkoutSession[]> => []);
vi.mock('../sessionDb', () => ({
  getWorkoutSessions: () => getWorkoutSessions(),
}));

const CONFIG_KEY = 'sparkos_notification_config';
const REST_DAYS_KEY = 'workout_rest_days';

/** Monday 2026-09-28, 10:00 local. */
const NOW = new Date(2026, 8, 28, 10, 0, 0);

let calls: string[] = [];
let cancelledIds: number[] = [];
let scheduled: ReminderRequest[] = [];
let channels: { id: string; name: string; importance?: number }[] = [];

const makePlugin = (display: 'granted' | 'denied' | 'prompt') => ({
  checkPermissions: vi.fn(async () => {
    calls.push('checkPermissions');
    return { display };
  }),
  requestPermissions: vi.fn(async () => {
    calls.push('requestPermissions');
    return { display };
  }),
  schedule: vi.fn(async (options: { notifications: ReminderRequest[] }) => {
    calls.push('schedule');
    scheduled = options.notifications;
    return { notifications: [] };
  }),
  cancel: vi.fn(async (options: { notifications: { id: number }[] }) => {
    calls.push('cancel');
    cancelledIds = options.notifications.map((entry) => entry.id);
  }),
  createChannel: vi.fn(async (channel: { id: string; name: string; importance?: number }) => {
    calls.push('createChannel');
    channels.push(channel);
  }),
});

type PluginMock = ReturnType<typeof makePlugin>;

const installNative = (
  display: 'granted' | 'denied' | 'prompt',
  platform: 'android' | 'ios' = 'android'
): PluginMock => {
  const plugin = makePlugin(display);
  (window as Window & { Capacitor?: unknown }).Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => platform,
    Plugins: { LocalNotifications: plugin },
  };
  return plugin;
};

/** A completed session `daysAgo` days before the pinned clock. */
const completedSession = (daysAgo: number, id = 's1'): WorkoutSession => {
  const start = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysAgo, 7, 0, 0);
  return {
    id,
    date: toRestDayKey(start),
    startTime: start.toISOString(),
    endTime: start.toISOString(),
    exercises: [],
    duration: 1800,
    status: 'completed',
    templateId: null,
    notes: '',
    rating: null,
    totalVolume: 0,
    caloriesBurned: null,
    createdAt: start.toISOString(),
    updatedAt: start.toISOString(),
  };
};

const scheduledIds = (): number[] => scheduled.map((request) => request.id);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  calls = [];
  cancelledIds = [];
  scheduled = [];
  channels = [];
  localStorage.clear();
  getWorkoutSessions.mockReset();
  getWorkoutSessions.mockResolvedValue([completedSession(2)]);
  // Sunday + Wednesday. From Monday 2026-09-28 that is offsets 2, 6, 9, 13.
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({ workoutReminderEnabled: true, workoutReminderDays: [0, 3] })
  );
});

afterEach(() => {
  (window as Window & { Capacitor?: unknown }).Capacitor = undefined;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('syncReminders · web', () => {
  it('is a no-op without a Capacitor runtime', async () => {
    await expect(syncReminders()).resolves.toBeUndefined();
    expect(getWorkoutSessions).not.toHaveBeenCalled();
  });
});

describe('syncReminders · native', () => {
  it('cancels our reserved ids BEFORE scheduling the new window', async () => {
    installNative('granted');

    await syncReminders();

    expect(calls.indexOf('cancel')).toBeLessThan(calls.indexOf('schedule'));
    expect(cancelledIds).toEqual([...RESERVED_REMINDER_IDS]);
  });

  it('schedules the chosen weekdays across the window, plus the nudge', async () => {
    installNative('granted');

    await syncReminders();

    expect(scheduledIds()).toEqual([7102, 7106, 7109, 7113, 7200]);
  });

  it('creates the reminder channel before scheduling, once, with Hebrew name', async () => {
    installNative('granted');

    await syncReminders();

    expect(calls.indexOf('createChannel')).toBeLessThan(calls.indexOf('schedule'));
    expect(channels).toEqual([
      { id: REMINDER_CHANNEL_ID, name: REMINDER_CHANNEL_NAME, importance: 3 },
    ]);
  });

  it('does not create a channel on iOS, where channels do not exist', async () => {
    const plugin = installNative('granted', 'ios');

    await syncReminders();

    expect(plugin.createChannel).not.toHaveBeenCalled();
    expect(plugin.schedule).toHaveBeenCalledTimes(1);
  });

  it('skips a declared rest day inside the window', async () => {
    // 2026-09-30 is the Wednesday at offset 2.
    localStorage.setItem(REST_DAYS_KEY, JSON.stringify(['2026-09-30']));
    installNative('granted');

    await syncReminders();

    expect(scheduledIds()).toEqual([7106, 7109, 7113, 7200]);
  });

  it('skips a day that already holds a completed workout', async () => {
    // Monday-only reminders, and today was already trained.
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({ workoutReminderEnabled: true, workoutReminderDays: [1] })
    );
    getWorkoutSessions.mockResolvedValue([completedSession(0)]);
    installNative('granted');

    await syncReminders();

    // Today (7100) is out; next Monday (7107) stays, plus the nudge.
    expect(scheduledIds()).toEqual([7107, 7200]);
  });

  it('records the scheduled nudge so the 7-day cap can be enforced', async () => {
    installNative('granted');

    await syncReminders();

    // Last workout 2026-09-26 + 3 days at 18:00.
    expect(getNotificationConfig().lastNudgeScheduledAt).toBe(
      new Date(2026, 8, 29, 18, 0, 0).toISOString()
    );
  });

  it('drops the nudge when a DELIVERED nudge fired less than 7 days ago', async () => {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        workoutReminderEnabled: true,
        workoutReminderDays: [0, 3],
        // Fired 2026-09-25 18:00 (before NOW); the next would be 2026-09-29.
        lastNudgeScheduledAt: new Date(2026, 8, 25, 18, 0, 0).toISOString(),
      })
    );
    installNative('granted');

    await syncReminders();

    expect(scheduledIds()).toEqual([7102, 7106, 7109, 7113]);
  });

  it('keeps the nudge when the recorded one was replaced before it fired', async () => {
    localStorage.setItem(
      CONFIG_KEY,
      JSON.stringify({
        workoutReminderEnabled: true,
        workoutReminderDays: [0, 3],
        // Recorded for tonight (after NOW): still pending, so a later workout
        // replaced it and the trainee never saw it — it must not count.
        lastNudgeScheduledAt: new Date(2026, 8, 28, 18, 0, 0).toISOString(),
      })
    );
    installNative('granted');

    await syncReminders();

    expect(scheduledIds()).toEqual([7102, 7106, 7109, 7113, 7200]);
  });

  it('cancels but never schedules when permission is not granted', async () => {
    const plugin = installNative('denied');

    await syncReminders();

    expect(plugin.cancel).toHaveBeenCalledTimes(1);
    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(plugin.createChannel).not.toHaveBeenCalled();
  });

  it('cancels and stops before touching the DB when reminders are off', async () => {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ workoutReminderEnabled: false }));
    const plugin = installNative('granted');

    await syncReminders();

    expect(plugin.cancel).toHaveBeenCalledTimes(1);
    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(getWorkoutSessions).not.toHaveBeenCalled();
  });

  it('still schedules the window when the workout history is unreadable', async () => {
    getWorkoutSessions.mockRejectedValue(new Error('idb closed'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    installNative('granted');

    await syncReminders();

    expect(scheduledIds()).toEqual([7102, 7106, 7109, 7113]);
  });

  it('never throws to the caller when the plugin fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plugin = installNative('granted');
    plugin.schedule.mockRejectedValue(new Error('plugin exploded'));

    await expect(syncReminders()).resolves.toBeUndefined();
  });

  it('survives a plugin with no channel support', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const plugin = installNative('granted');
    plugin.createChannel.mockRejectedValue(new Error('unimplemented'));

    await syncReminders();

    expect(plugin.schedule).toHaveBeenCalledTimes(1);
  });
});

describe('requestReminderPermission', () => {
  it('reports unsupported on the web, so the caller still saves the choice', async () => {
    await expect(requestReminderPermission()).resolves.toBe('unsupported');
  });

  it('does not re-prompt when permission is already granted', async () => {
    const plugin = installNative('granted');

    await expect(requestReminderPermission()).resolves.toBe('granted');
    expect(plugin.requestPermissions).not.toHaveBeenCalled();
  });

  it('prompts when permission is undecided and reports the answer', async () => {
    const plugin = installNative('prompt');
    plugin.requestPermissions.mockResolvedValue({ display: 'granted' });

    await expect(requestReminderPermission()).resolves.toBe('granted');
    expect(plugin.requestPermissions).toHaveBeenCalledTimes(1);
  });

  it('reports denied when the OS refuses', async () => {
    installNative('denied');
    await expect(requestReminderPermission()).resolves.toBe('denied');
  });
});

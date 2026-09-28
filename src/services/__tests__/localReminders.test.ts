// Pure reminder-plan tests — no plugin, no clock, no device.
//
// The scheduler is a ROLLING WINDOW of one-shots, so the things that silently
// break it are calendar arithmetic: which of the next 14 days gets a reminder,
// which days are excused (declared rest / already trained / already past), the
// reserved id range a resync cancels, and the 7-day cap on the nudge.

import { describe, expect, it } from 'vitest';
import { toRestDayKey } from '../../utils/restDays';
import {
  INACTIVITY_NUDGE_ID,
  NUDGE_MIN_INTERVAL_DAYS,
  REMINDER_CHANNEL_ID,
  RESERVED_REMINDER_IDS,
  type ReminderPlanContext,
  WINDOW_DAYS,
  WINDOW_REMINDER_ID_BASE,
  buildReminderPlan,
  parseReminderTime,
} from '../localReminders';
import type { NotificationConfig } from '../notificationService';

const config = (overrides: Partial<NotificationConfig> = {}): NotificationConfig => ({
  workoutReminderEnabled: true,
  workoutReminderTime: '18:00',
  workoutReminderDays: [0, 2, 4],
  missedWorkoutAlertDays: 3,
  lastNudgeScheduledAt: null,
  nutritionReminderEnabled: false,
  nutritionReminderTimes: [],
  prNotificationEnabled: true,
  ...overrides,
});

/** Monday 2026-09-28, 10:00 local — before an 18:00 reminder slot. */
const NOW = new Date(2026, 8, 28, 10, 0, 0);

const ctx = (overrides: Partial<ReminderPlanContext> = {}): ReminderPlanContext => ({
  lastCompletedWorkoutAt: null,
  now: NOW,
  restDayKeys: new Set<string>(),
  trainedDayKeys: new Set<string>(),
  ...overrides,
});

/** Ids of the window entries only, nudge excluded. */
const windowIds = (plan: { id: number }[]): number[] =>
  plan.filter((request) => request.id !== INACTIVITY_NUDGE_ID).map((request) => request.id);

describe('parseReminderTime', () => {
  it('parses a valid HH:MM', () => {
    expect(parseReminderTime('19:45')).toEqual({ hour: 19, minute: 45 });
  });

  it('accepts a single-digit hour', () => {
    expect(parseReminderTime('7:05')).toEqual({ hour: 7, minute: 5 });
  });

  it.each(['', 'abc', '25:00', '10:75', '10', '10:5'])(
    'falls back to the 18:00 default for %o instead of throwing',
    (value) => {
      expect(parseReminderTime(value)).toEqual({ hour: 18, minute: 0 });
    }
  );
});

describe('reserved ids', () => {
  it('covers one slot per window day plus the nudge, with no duplicates', () => {
    expect(RESERVED_REMINDER_IDS).toEqual([
      7100, 7101, 7102, 7103, 7104, 7105, 7106, 7107, 7108, 7109, 7110, 7111, 7112, 7113, 7200,
    ]);
    expect(RESERVED_REMINDER_IDS).toHaveLength(WINDOW_DAYS + 1);
    expect(new Set(RESERVED_REMINDER_IDS).size).toBe(RESERVED_REMINDER_IDS.length);
  });
});

describe('buildReminderPlan · rolling window', () => {
  it('schedules a one-shot on every chosen weekday inside the next 14 days', () => {
    // Sun/Tue/Thu from Monday 2026-09-28: Tue+1, Thu+3, Sun+6, Tue+8, Thu+10, Sun+13.
    const plan = buildReminderPlan(config(), ctx());

    expect(windowIds(plan)).toEqual([7101, 7103, 7106, 7108, 7110, 7113]);
    for (const request of plan) {
      expect(request.schedule.allowWhileIdle).toBe(true);
      expect(request.channelId).toBe(REMINDER_CHANNEL_ID);
    }
    expect(plan[0]!.title).toBe('זמן אימון');
    expect(plan[0]!.schedule.at).toEqual(new Date(2026, 8, 29, 18, 0, 0, 0));
  });

  it('honours the chosen time on every day of the window', () => {
    const plan = buildReminderPlan(config({ workoutReminderTime: '06:45' }), ctx());

    for (const request of plan) {
      expect(request.schedule.at.getHours()).toBe(6);
      expect(request.schedule.at.getMinutes()).toBe(45);
    }
  });

  it('never looks past the window', () => {
    const plan = buildReminderPlan(config({ workoutReminderDays: [0, 1, 2, 3, 4, 5, 6] }), ctx());
    const horizon = new Date(2026, 8, 28 + WINDOW_DAYS, 0, 0, 0);

    // Today's 18:00 is still ahead of 10:00, so all 14 days are in.
    expect(windowIds(plan)).toHaveLength(WINDOW_DAYS);
    for (const request of plan) {
      expect(request.schedule.at.getTime()).toBeLessThan(horizon.getTime());
    }
  });

  it("skips today when today's slot already passed", () => {
    const plan = buildReminderPlan(config({ workoutReminderDays: [1] }), {
      ...ctx(),
      now: new Date(2026, 8, 28, 20, 30, 0), // 20:30, after the 18:00 slot
    });

    // Monday only: today is out, next Monday (+7) stays.
    expect(windowIds(plan)).toEqual([7107]);
  });

  it('skips a declared rest day', () => {
    const restDay = new Date(2026, 8, 29); // Tuesday, offset +1
    const plan = buildReminderPlan(
      config(),
      ctx({ restDayKeys: new Set([toRestDayKey(restDay)]) })
    );

    expect(windowIds(plan)).not.toContain(WINDOW_REMINDER_ID_BASE + 1);
    expect(windowIds(plan)).toEqual([7103, 7106, 7108, 7110, 7113]);
  });

  it('skips a day that already holds a completed workout', () => {
    // Trained today at 07:00; today is a chosen day and its 18:00 slot is ahead.
    const plan = buildReminderPlan(config({ workoutReminderDays: [1] }), {
      ...ctx(),
      trainedDayKeys: new Set([toRestDayKey(NOW)]),
    });

    expect(windowIds(plan)).not.toContain(WINDOW_REMINDER_ID_BASE);
    expect(windowIds(plan)).toEqual([7107]);
  });

  it('names the next workout in the body when the caller knows it', () => {
    const plan = buildReminderPlan(
      config({ workoutReminderDays: [1] }),
      ctx({ nextWorkoutName: '  פלג גוף עליון  ' })
    );
    expect(plan[0]!.body).toBe('האימון הבא: פלג גוף עליון');
  });

  it('uses a neutral body when the next workout is unknown', () => {
    const plan = buildReminderPlan(
      config({ workoutReminderDays: [1] }),
      ctx({ nextWorkoutName: '   ' })
    );
    expect(plan[0]!.body).toBe('זה הזמן שבחרת להתאמן בו.');
  });

  it('drops out-of-range day values instead of scheduling nothing', () => {
    const plan = buildReminderPlan(config({ workoutReminderDays: [9, -1, 1.5, 1] }), ctx());
    expect(windowIds(plan)).toEqual([7100, 7107]);
  });

  it('returns nothing at all when reminders are off', () => {
    const plan = buildReminderPlan(
      config({ workoutReminderEnabled: false }),
      ctx({ lastCompletedWorkoutAt: '2026-09-27T20:00:00.000Z' })
    );
    expect(plan).toEqual([]);
  });
});

describe('buildReminderPlan · inactivity nudge', () => {
  const noWindow = { workoutReminderDays: [] as number[] };
  const lastWorkout = new Date(2026, 8, 27, 20, 0, 0).toISOString(); // Sunday

  it('fires N days after the last workout, at the reminder time', () => {
    const plan = buildReminderPlan(
      config({ ...noWindow, missedWorkoutAlertDays: 3, workoutReminderTime: '19:15' }),
      ctx({ lastCompletedWorkoutAt: lastWorkout })
    );

    expect(plan).toHaveLength(1);
    expect(plan[0]!.id).toBe(INACTIVITY_NUDGE_ID);
    expect(plan[0]!.body).toBe('עברו 3 ימים מהאימון האחרון.');
    expect(plan[0]!.channelId).toBe(REMINDER_CHANNEL_ID);
    expect(plan[0]!.schedule.at).toEqual(new Date(2026, 8, 30, 19, 15, 0, 0));
  });

  it('is skipped when that moment already passed', () => {
    const plan = buildReminderPlan(
      config(noWindow),
      ctx({ lastCompletedWorkoutAt: new Date(2026, 8, 18, 20, 0, 0).toISOString() })
    );
    expect(plan).toEqual([]);
  });

  it('is skipped when there is no workout history', () => {
    expect(buildReminderPlan(config(noWindow), ctx())).toEqual([]);
  });

  it('is skipped when the stored timestamp is unparseable', () => {
    const plan = buildReminderPlan(config(noWindow), ctx({ lastCompletedWorkoutAt: 'not-a-date' }));
    expect(plan).toEqual([]);
  });

  it('is suppressed within 7 days of a nudge that already FIRED', () => {
    // Delivered nudge: 2026-09-25 18:00 (before NOW). The new one would be
    // 2026-09-30 18:00, five days later — inside the cap.
    const plan = buildReminderPlan(
      config({ ...noWindow, lastNudgeScheduledAt: new Date(2026, 8, 25, 18, 0, 0).toISOString() }),
      ctx({ lastCompletedWorkoutAt: lastWorkout })
    );
    expect(plan).toEqual([]);
  });

  it('does not count a pending nudge that a later workout replaced before it fired', () => {
    // Recorded 2026-09-29 18:00 is still in the future: it never reached the
    // trainee, so it must not silence the replacement at 2026-09-30 18:00.
    const plan = buildReminderPlan(
      config({ ...noWindow, lastNudgeScheduledAt: new Date(2026, 8, 29, 18, 0, 0).toISOString() }),
      ctx({ lastCompletedWorkoutAt: lastWorkout })
    );
    expect(plan.map((request) => request.id)).toEqual([INACTIVITY_NUDGE_ID]);
  });

  it('is allowed again once 7 days have passed since the recorded one', () => {
    const recorded = new Date(2026, 8, 30, 18, 0, 0);
    recorded.setDate(recorded.getDate() - NUDGE_MIN_INTERVAL_DAYS);
    const plan = buildReminderPlan(
      config({ ...noWindow, lastNudgeScheduledAt: recorded.toISOString() }),
      ctx({ lastCompletedWorkoutAt: lastWorkout })
    );
    expect(plan.map((request) => request.id)).toEqual([INACTIVITY_NUDGE_ID]);
  });

  it('re-hands the IDENTICAL nudge instant, so a resync is not a second nudge', () => {
    const plan = buildReminderPlan(
      config({ ...noWindow, lastNudgeScheduledAt: new Date(2026, 8, 30, 18, 0, 0).toISOString() }),
      ctx({ lastCompletedWorkoutAt: lastWorkout })
    );
    expect(plan.map((request) => request.id)).toEqual([INACTIVITY_NUDGE_ID]);
  });

  it('ignores an unparseable recorded nudge date rather than blocking forever', () => {
    const plan = buildReminderPlan(
      config({ ...noWindow, lastNudgeScheduledAt: 'garbage' }),
      ctx({ lastCompletedWorkoutAt: lastWorkout })
    );
    expect(plan.map((request) => request.id)).toEqual([INACTIVITY_NUDGE_ID]);
  });

  it('writes Hebrew that is actually Hebrew for 1 and 2 days', () => {
    const last = new Date(2026, 8, 28, 20, 0, 0).toISOString();
    const one = buildReminderPlan(
      config({ ...noWindow, missedWorkoutAlertDays: 1 }),
      ctx({ lastCompletedWorkoutAt: last })
    );
    const two = buildReminderPlan(
      config({ ...noWindow, missedWorkoutAlertDays: 2 }),
      ctx({ lastCompletedWorkoutAt: last })
    );
    expect(one[0]!.body).toBe('עבר יום מהאימון האחרון.');
    expect(two[0]!.body).toBe('עברו יומיים מהאימון האחרון.');
  });

  it('falls back to 3 days when the stored value is not a usable number', () => {
    const plan = buildReminderPlan(
      config({ ...noWindow, missedWorkoutAlertDays: Number.NaN }),
      ctx({ lastCompletedWorkoutAt: lastWorkout })
    );
    expect(plan[0]!.body).toBe('עברו 3 ימים מהאימון האחרון.');
  });

  it('is appended after the window, inside the reserved range', () => {
    const plan = buildReminderPlan(config(), ctx({ lastCompletedWorkoutAt: lastWorkout }));

    expect(plan.map((request) => request.id)).toEqual([
      7101,
      7103,
      7106,
      7108,
      7110,
      7113,
      INACTIVITY_NUDGE_ID,
    ]);
    for (const request of plan) {
      expect(RESERVED_REMINDER_IDS).toContain(request.id);
    }
  });
});

describe('buildReminderPlan · exact alarms', () => {
  // The plugin defaults isExactNotification to true, and on Android 12+ a
  // schedule() call without exact-alarm access then opens the system "Alarms &
  // reminders" screen. syncReminders runs on every return to the foreground, so
  // the default would reopen that screen each time: every request must opt out.
  it('opts every request out of exact alarms, window reminders and nudge alike', () => {
    const plan = buildReminderPlan(
      config({ workoutReminderDays: [0, 1, 2, 3, 4, 5, 6], missedWorkoutAlertDays: 3 }),
      ctx({ lastCompletedWorkoutAt: new Date(2026, 8, 27, 20, 0, 0).toISOString() })
    );

    expect(windowIds(plan)).toHaveLength(WINDOW_DAYS);
    expect(plan.some((request) => request.id === INACTIVITY_NUDGE_ID)).toBe(true);
    for (const request of plan) {
      expect(request.isExactNotification).toBe(false);
    }
  });
});

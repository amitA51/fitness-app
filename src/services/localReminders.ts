// ============================================================================
// LOCAL WORKOUT REMINDERS — pure scheduling plan (no side effects, no platform)
//
// Turns the persisted `NotificationConfig` into the list of notification
// requests the device should be holding right now. Everything here is a pure
// function of (config, last workout, rest days, trained days, current time) so
// the calendar arithmetic can be asserted without a device, a plugin or a clock.
//
// The side-effect half lives in `localRemindersSync.ts`.
// ============================================================================

import { toRestDayKey } from '../utils/restDays';
import type { NotificationConfig } from './notificationService';

/**
 * ROLLING WINDOW, not weekly repeats.
 *
 * Each reminder is a ONE-SHOT at an absolute instant, and the next 14 days are
 * scheduled at once. That is what lets a reminder be skipped for a single day
 * (a planned rest day, or a day already trained) — a repeating weekly
 * notification fires on its weekday unconditionally and cannot be excused.
 *
 * It also gives a lapsed user a natural exit: the device holds at most 14 days
 * of reminders, so someone who stops opening the app stops being reminded
 * instead of being nagged forever. That is intended behaviour, not a gap.
 */
export const WINDOW_DAYS = 14;

/**
 * Reserved id range — one slot per DAY OFFSET in the window (0..13), plus one
 * for the nudge.
 *
 * The id encodes the offset from today, not the weekday, so the same calendar
 * day carries a different id tomorrow. That is safe only because every resync
 * cancels the whole range before scheduling — see `syncReminders`. Cancelling by
 * a fixed reserved range is also what keeps a resync from deleting a
 * notification that belongs to another part of the app or to the OS.
 */
export const WINDOW_REMINDER_ID_BASE = 7100; // 7100 (today) .. 7113 (today + 13)
export const INACTIVITY_NUDGE_ID = 7200;

export const RESERVED_REMINDER_IDS: readonly number[] = [
  ...Array.from({ length: WINDOW_DAYS }, (_, offset) => WINDOW_REMINDER_ID_BASE + offset),
  INACTIVITY_NUDGE_ID,
];

/** One Android channel for every reminder here, so it can be muted on its own. */
export const REMINDER_CHANNEL_ID = 'workout-reminders';
export const REMINDER_CHANNEL_NAME = 'תזכורות אימון';

/** Hard cap on the missed-workout nudge: at most one per this many days. */
export const NUDGE_MIN_INTERVAL_DAYS = 7;

/** Wall-clock time of day, already validated. */
export interface ReminderTime {
  hour: number;
  minute: number;
}

/** The subset of the plugin's `Schedule` this app produces: one-shots only. */
export interface ReminderSchedule {
  at: Date;
  allowWhileIdle: boolean;
}

export interface ReminderRequest {
  id: number;
  title: string;
  body: string;
  channelId: string;
  schedule: ReminderSchedule;
  /**
   * ALWAYS `false`, and typed as the literal so no builder can forget it.
   *
   * The plugin (8.3.0+) defaults this to `true`, and then on Android 12+ every
   * `schedule()` call made without exact-alarm access OPENS the system "Alarms &
   * reminders" screen (`LocalNotificationsPlugin.kt`, `schedule`). Android 14+
   * denies that access by default, and `syncReminders` runs on every return to
   * the foreground — so the default would throw the user into that screen again
   * each time they come back to the app. A gym reminder does not need minute
   * precision: `false` schedules inexact via `setAndAllowWhileIdle`, with no
   * prompt, and the app declares no exact-alarm permission at all (see the
   * `tools:node="remove"` line in `android/app/src/main/AndroidManifest.xml`).
   */
  isExactNotification: false;
}

export interface ReminderPlanContext {
  /** ISO timestamp of the last COMPLETED workout, or null when there is none. */
  lastCompletedWorkoutAt: string | null;
  now: Date;
  /** Name of the next planned workout, when the caller knows it. */
  nextWorkoutName?: string | null;
  /** Declared rest days as `YYYY-MM-DD` keys (see `utils/restDays`). */
  restDayKeys: ReadonlySet<string>;
  /** Days that already hold a completed workout, as `YYYY-MM-DD` keys. */
  trainedDayKeys: ReadonlySet<string>;
}

const DEFAULT_TIME: ReminderTime = { hour: 18, minute: 0 };
const DEFAULT_NUDGE_DAYS = 3;
const DAY_MS = 86400000;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;

const REMINDER_TITLE = 'זמן אימון';
const NUDGE_TITLE = 'לא התאמנת מזמן';

/**
 * Parses an 'HH:MM' config value. Falls back to the config default rather than
 * throwing: `getNotificationConfig` merges whatever JSON localStorage holds over
 * the defaults, so a corrupted value must not take the whole schedule down.
 */
export function parseReminderTime(value: string): ReminderTime {
  const match = typeof value === 'string' ? TIME_PATTERN.exec(value.trim()) : null;
  if (!match) return { ...DEFAULT_TIME };
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return { ...DEFAULT_TIME };
  return { hour, minute };
}

/** Hebrew plural that is actually Hebrew: 1 -> יום, 2 -> יומיים, 3+ -> N ימים. */
function daysPhrase(days: number): string {
  if (days === 1) return 'עבר יום מהאימון האחרון.';
  if (days === 2) return 'עברו יומיים מהאימון האחרון.';
  return `עברו ${days} ימים מהאימון האחרון.`;
}

function reminderBody(nextWorkoutName?: string | null): string {
  const name = nextWorkoutName?.trim();
  return name ? `האימון הבא: ${name}` : 'זה הזמן שבחרת להתאמן בו.';
}

function nudgeDays(config: NotificationConfig): number {
  const raw = config.missedWorkoutAlertDays;
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_NUDGE_DAYS;
  return Math.round(raw);
}

/** Local midnight of `base` shifted by `offset` days. */
function dayAt(base: Date, offset: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
}

function atTimeOn(day: Date, time: ReminderTime): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.hour, time.minute, 0, 0);
}

/**
 * True when scheduling a nudge for `at` would break the one-per-7-days cap.
 *
 * The cap counts nudges that REACHED the user, not ones we merely handed over.
 * A recorded instant still in the future is a pending nudge: every resync
 * cancels and re-schedules it, so if the trainee trains before it fires it is
 * replaced and never delivered — counting it would silence the next genuine
 * nudge for up to a week. A recorded instant in the past was not replaced
 * before it fired (a workout save or app open would have resynced first), so it
 * was delivered and does count.
 */
function isNudgeWithinCooldown(at: Date, lastScheduled: string | null, now: Date): boolean {
  if (!lastScheduled) return false;
  const previous = new Date(lastScheduled);
  if (Number.isNaN(previous.getTime())) return false;
  if (previous.getTime() > now.getTime()) return false;
  return at.getTime() - previous.getTime() < NUDGE_MIN_INTERVAL_DAYS * DAY_MS;
}

/**
 * One-shot nudge at `lastCompleted + missedWorkoutAlertDays`, at the reminder
 * time. Returns null when there is nothing to schedule — no history, an
 * unparseable timestamp, a moment that has already passed (the device rejects a
 * past one-shot, and firing it late is worse than not firing), or the 7-day cap.
 */
function buildInactivityNudge(
  config: NotificationConfig,
  ctx: ReminderPlanContext,
  time: ReminderTime
): ReminderRequest | null {
  if (!ctx.lastCompletedWorkoutAt) return null;
  const last = new Date(ctx.lastCompletedWorkoutAt);
  if (Number.isNaN(last.getTime())) return null;

  const days = nudgeDays(config);
  // Local-calendar arithmetic: day + N at the chosen wall-clock time, so a DST
  // shift moves the notification with the clock instead of by an hour.
  const at = atTimeOn(dayAt(last, days), time);
  if (at.getTime() <= ctx.now.getTime()) return null;
  if (isNudgeWithinCooldown(at, config.lastNudgeScheduledAt, ctx.now)) return null;

  return {
    id: INACTIVITY_NUDGE_ID,
    title: NUDGE_TITLE,
    body: daysPhrase(days),
    channelId: REMINDER_CHANNEL_ID,
    schedule: { at, allowWhileIdle: true },
    isExactNotification: false,
  };
}

/**
 * The full set of notifications the device should be holding.
 *
 * Empty when reminders are off — the caller cancels the reserved ids first, so
 * an empty plan is how "off" is expressed.
 */
export function buildReminderPlan(
  config: NotificationConfig,
  ctx: ReminderPlanContext
): ReminderRequest[] {
  if (!config.workoutReminderEnabled) return [];

  const time = parseReminderTime(config.workoutReminderTime);
  const chosenDays = new Set(
    config.workoutReminderDays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  );

  const plan: ReminderRequest[] = [];
  for (let offset = 0; offset < WINDOW_DAYS; offset++) {
    const day = dayAt(ctx.now, offset);
    if (!chosenDays.has(day.getDay())) continue;

    const key = toRestDayKey(day);
    // A reminder on a declared rest day is the fastest way to get the whole
    // channel muted; a reminder on a day already trained is just noise. Only
    // today can realistically be in `trainedDayKeys`, which is the case that
    // matters: trained at 07:00, do not ping at 18:00.
    if (ctx.restDayKeys.has(key) || ctx.trainedDayKeys.has(key)) continue;

    const at = atTimeOn(day, time);
    if (at.getTime() <= ctx.now.getTime()) continue; // today's slot already passed

    plan.push({
      id: WINDOW_REMINDER_ID_BASE + offset,
      title: REMINDER_TITLE,
      body: reminderBody(ctx.nextWorkoutName),
      channelId: REMINDER_CHANNEL_ID,
      schedule: { at, allowWhileIdle: true },
      isExactNotification: false,
    });
  }

  const nudge = buildInactivityNudge(config, ctx, time);
  if (nudge) plan.push(nudge);

  return plan;
}

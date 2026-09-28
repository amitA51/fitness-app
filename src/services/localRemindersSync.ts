// ============================================================================
// LOCAL WORKOUT REMINDERS — device side (native only)
//
// The only place that talks to the LocalNotifications plugin. Reached through
// `getCapacitorPlugin` so `src/` still imports ZERO @capacitor/* packages: the
// same bundle ships as a PWA, where the plugin does not exist and every function
// here is a no-op.
//
// HONEST LIMITATION: the device fires only the schedule it was handed the LAST
// TIME THE APP WAS OPEN. Nothing of ours runs in the background to refresh it, so
// the 14-day window has to be re-handed on every app open and after every saved
// workout. See `hooks/useLocalReminderSync`.
// ============================================================================

import { logger } from '../utils/logger';
import { getCapacitorPlugin, getPlatform, isNativePlatform } from '../utils/platform';
import { getRestDays } from '../utils/restDays';
import {
  INACTIVITY_NUDGE_ID,
  REMINDER_CHANNEL_ID,
  REMINDER_CHANNEL_NAME,
  RESERVED_REMINDER_IDS,
  type ReminderRequest,
  buildReminderPlan,
} from './localReminders';
import { getNotificationConfig, saveNotificationConfig } from './notificationService';
import { getWorkoutSessions } from './sessionDb';

/** The subset of @capacitor/local-notifications this app actually calls. */
interface PermissionState {
  display: string;
}

interface ReminderChannel {
  id: string;
  name: string;
  /** Android importance; 3 = IMPORTANCE_DEFAULT, the plugin's own default. */
  importance?: 0 | 1 | 2 | 3 | 4 | 5;
}

export interface LocalNotificationsLike {
  checkPermissions(): Promise<PermissionState>;
  requestPermissions(): Promise<PermissionState>;
  schedule(options: { notifications: ReminderRequest[] }): Promise<unknown>;
  cancel(options: { notifications: { id: number }[] }): Promise<void>;
  createChannel(channel: ReminderChannel): Promise<void>;
}

export type ReminderPermission = 'granted' | 'denied' | 'unsupported';

/**
 * How many recent sessions to scan. Covers the latest completed workout (for the
 * nudge) and any workout already logged inside the 14-day window — in practice
 * only today's can be, since the window is forward-looking.
 */
const SESSION_SCAN_LIMIT = 30;

function reminderPlugin(): LocalNotificationsLike | undefined {
  if (!isNativePlatform()) return undefined;
  return getCapacitorPlugin<LocalNotificationsLike>('LocalNotifications');
}

/**
 * Asks the OS for notification permission. Call this ONLY when the user turns
 * reminders on — never on cold launch.
 *
 * `unsupported` means web/PWA: there is nothing to ask, and the caller should
 * still save the choice (it applies in the Android app).
 */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  const plugin = reminderPlugin();
  if (!plugin) return 'unsupported';
  try {
    const current = await plugin.checkPermissions();
    if (current.display === 'granted') return 'granted';
    const next = await plugin.requestPermissions();
    return next.display === 'granted' ? 'granted' : 'denied';
  } catch (err) {
    logger.app.warn('localReminders: permission request failed', err);
    return 'denied';
  }
}

/**
 * Creates the reminder channel. Android-only (channels do not exist on iOS, and
 * the plugin's other platforms reject the call), idempotent, and never fatal: a
 * missing channel means the OS uses its default, not a lost notification.
 *
 * One channel of our own means the user can mute workout reminders in system
 * settings without muting the rest-timer or PR notifications.
 */
async function ensureReminderChannel(plugin: LocalNotificationsLike): Promise<void> {
  if (getPlatform() !== 'android') return;
  try {
    await plugin.createChannel({
      id: REMINDER_CHANNEL_ID,
      name: REMINDER_CHANNEL_NAME,
      importance: 3,
    });
  } catch (err) {
    logger.app.warn('localReminders: could not create the reminder channel', err);
  }
}

interface WorkoutHistory {
  lastCompletedWorkoutAt: string | null;
  /** `YYYY-MM-DD` keys of days that already hold a completed workout. */
  trainedDayKeys: ReadonlySet<string>;
}

async function readWorkoutHistory(): Promise<WorkoutHistory> {
  try {
    const sessions = await getWorkoutSessions(SESSION_SCAN_LIMIT);
    const completed = sessions.filter((session) => session.status === 'completed');
    const newest = completed[0];
    return {
      lastCompletedWorkoutAt: newest?.endTime ?? newest?.startTime ?? null,
      trainedDayKeys: new Set(completed.map((session) => session.date)),
    };
  } catch (err) {
    logger.app.warn('localReminders: could not read the workout history', err);
    return { lastCompletedWorkoutAt: null, trainedDayKeys: new Set() };
  }
}

/**
 * Records the nudge instant we just handed to the device, which is what enforces
 * the one-per-7-days cap on the next resync. Written only when it changed, so a
 * resync that re-hands the identical nudge does not touch storage.
 */
function rememberNudge(plan: ReminderRequest[], previous: string | null): void {
  const nudge = plan.find((request) => request.id === INACTIVITY_NUDGE_ID);
  if (!nudge) return;
  const scheduledAt = nudge.schedule.at.toISOString();
  if (scheduledAt === previous) return;
  saveNotificationConfig({ lastNudgeScheduledAt: scheduledAt });
}

/**
 * Hands the device the current reminder plan: cancel our reserved ids, then
 * schedule the next 14 days.
 *
 * Never throws — a failed resync must not break an app open or a workout save.
 */
export async function syncReminders(): Promise<void> {
  const plugin = reminderPlugin();
  if (!plugin) return; // Web/PWA: nothing on the device can hold a schedule.

  try {
    await plugin.cancel({ notifications: RESERVED_REMINDER_IDS.map((id) => ({ id })) });

    const config = getNotificationConfig();
    // Cheap exit before the IndexedDB read; buildReminderPlan checks this too so
    // it stays correct on its own.
    if (!config.workoutReminderEnabled) return;

    const permission = await plugin.checkPermissions();
    if (permission.display !== 'granted') return;

    const history = await readWorkoutHistory();
    const plan = buildReminderPlan(config, {
      lastCompletedWorkoutAt: history.lastCompletedWorkoutAt,
      trainedDayKeys: history.trainedDayKeys,
      restDayKeys: getRestDays(),
      now: new Date(),
    });
    if (plan.length === 0) return;

    await ensureReminderChannel(plugin);
    await plugin.schedule({ notifications: plan });
    rememberNudge(plan, config.lastNudgeScheduledAt);
  } catch (err) {
    logger.app.warn('localReminders: sync failed', err);
  }
}

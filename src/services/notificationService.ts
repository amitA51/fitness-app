import { logger } from '../utils/logger';
import { safeJsonParse } from '../utils/safeJson';

export interface NotificationConfig {
  workoutReminderEnabled: boolean;
  workoutReminderTime: string; // HH:MM
  workoutReminderDays: number[]; // 0=Sunday, 6=Saturday
  missedWorkoutAlertDays: number; // alert after X days without workout
  nutritionReminderEnabled: boolean;
  nutritionReminderTimes: string[]; // HH:MM for meal logging reminders
  prNotificationEnabled: boolean;
}

const DEFAULT_CONFIG: NotificationConfig = {
  workoutReminderEnabled: false,
  workoutReminderTime: '08:00',
  workoutReminderDays: [0, 1, 2, 3, 4, 5, 6],
  missedWorkoutAlertDays: 3,
  nutritionReminderEnabled: false,
  nutritionReminderTimes: ['08:00', '13:00', '19:00'],
  prNotificationEnabled: true,
};

const CONFIG_KEY = 'sparkos_notification_config';

export function getNotificationConfig(): NotificationConfig {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (!stored) return { ...DEFAULT_CONFIG };
    return { ...DEFAULT_CONFIG, ...(safeJsonParse<Partial<typeof DEFAULT_CONFIG>>(stored) ?? {}) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveNotificationConfig(config: Partial<NotificationConfig>): NotificationConfig {
  const current = getNotificationConfig();
  const updated = { ...current, ...config };
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
  } catch {
    // Quota exceeded or privacy mode — config won't persist but app continues
  }
  return updated;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function showNotification(
  title: string,
  body: string,
  icon?: string,
  tag?: string
): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const options: NotificationOptions = {
    body,
    icon: icon || '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'he',
    // A shared tag lets this local notification coalesce with a server Web Push
    // for the same event (the OS replaces a same-tag notification).
    ...(tag ? { tag } : {}),
  };

  // Prefer the service-worker path: `new Notification()` is deprecated and
  // throws on iOS / many mobile browsers. Fall back to the constructor only
  // when no service worker is registered (e.g. desktop without a SW).
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // Fall through to the constructor fallback below.
  }

  if ('Notification' in window) {
    new Notification(title, options);
  }
}

/**
 * Rest-end notification, shown ONLY while the document is hidden (screen off /
 * app backgrounded). Routes through the service worker so it survives on iOS and
 * coalesces with any same-tag push via `tag: 'rest-end'`. `renotify` re-alerts
 * even when a previous rest-end notification is still on screen. Caller is
 * responsible for permission gating and for closing it on return/skip.
 */
export async function showRestEndNotification(body: string, vibrate?: number[]): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const options: NotificationOptions & { renotify?: boolean } = {
    body,
    icon: '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'he',
    tag: 'rest-end',
    renotify: true,
    ...(vibrate && vibrate.length > 0 ? { vibrate } : {}),
  };

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification('המנוחה הסתיימה', options);
      return;
    }
  } catch {
    // Fall through to the constructor fallback below.
  }

  if ('Notification' in window) {
    new Notification('המנוחה הסתיימה', options);
  }
}

/**
 * Close any on-screen rest-end notification (e.g. when the user returns to the
 * tab or skips/extends rest before the timer fired). Best-effort: silently
 * no-ops without a service worker or notification support.
 */
export async function closeRestEndNotification(): Promise<void> {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (!registration) return;
    const open = await registration.getNotifications({ tag: 'rest-end' });
    for (const n of open) n.close();
  } catch {
    // Notifications API unavailable — nothing to close.
  }
}

export function showWorkoutReminder(): void {
  void showNotification('זמן לאימון', 'האימון המתוכנן ממתין.').catch((err) => {
    logger.app.warn('Failed to show workout reminder notification', err);
  });
}

export function showMissedWorkoutAlert(daysSince: number): void {
  void showNotification('לא התאמנת מזמן', `עברו ${daysSince} ימים מהאימון האחרון.`).catch((err) => {
    logger.app.warn('Failed to show missed-workout notification', err);
  });
}

export function showPRNotification(exerciseName: string, type: string): void {
  void showNotification(
    'שיא אישי חדש',
    `${exerciseName} · שיא ${type === 'weight' ? 'משקל' : 'נפח'}`
  ).catch((err) => {
    logger.app.warn('Failed to show PR notification', err);
  });
}

export function showNutritionReminder(): void {
  void showNotification('תזכורת תזונה', 'רשום את הארוחה.').catch((err) => {
    logger.app.warn('Failed to show nutrition reminder notification', err);
  });
}

export function checkMissedWorkouts(lastWorkoutDate: string | null): void {
  if (!lastWorkoutDate) return;

  const config = getNotificationConfig();
  // The Settings "תזכורת אימון" toggle gates this alert — it used to fire
  // unconditionally from main.tsx, making the toggle a no-op.
  if (!config.workoutReminderEnabled) return;
  const last = new Date(lastWorkoutDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays >= config.missedWorkoutAlertDays) {
    showMissedWorkoutAlert(diffDays);
  }
}

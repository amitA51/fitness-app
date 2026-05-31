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

export async function showNotification(title: string, body: string, icon?: string): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const options: NotificationOptions = {
    body,
    icon: icon || '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'he',
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
  const last = new Date(lastWorkoutDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays >= config.missedWorkoutAlertDays) {
    showMissedWorkoutAlert(diffDays);
  }
}

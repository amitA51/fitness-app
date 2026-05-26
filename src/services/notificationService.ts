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
  localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));
  return updated;
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;

  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

export function showNotification(title: string, body: string, icon?: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  new Notification(title, {
    body,
    icon: icon || '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'he',
  });
}

export function showWorkoutReminder(): void {
  showNotification('זמן לאימון', 'האימון המתוכנן ממתין.');
}

export function showMissedWorkoutAlert(daysSince: number): void {
  showNotification('לא התאמנת מזמן', `עברו ${daysSince} ימים מהאימון האחרון.`);
}

export function showPRNotification(exerciseName: string, type: string): void {
  showNotification('שיא אישי חדש', `${exerciseName} · שיא ${type === 'weight' ? 'משקל' : 'נפח'}`);
}

export function showNutritionReminder(): void {
  showNotification('תזכורת תזונה', 'רשום את הארוחה.');
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

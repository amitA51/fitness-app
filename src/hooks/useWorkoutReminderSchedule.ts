import { useCallback, useState } from 'react';
import { requestReminderPermission, syncReminders } from '../services/localRemindersSync';
import type { NotificationConfig } from '../services/notificationService';
import { saveNotificationConfig } from '../services/notificationService';

const HH_MM = /^(\d{2}):(\d{2})$/;

export interface WorkoutReminderSchedule {
  days: number[];
  time: string;
  /** True once the OS refused permission, so the UI can say how to fix it. */
  permissionDenied: boolean;
  toggleDay: (day: number) => void;
  setTime: (time: string) => void;
  /**
   * Asks for permission. Returns false only when the OS refused — the caller must
   * then leave the toggle OFF. On web there is nothing to ask and the choice is
   * still saved, so this returns true.
   */
  requestEnable: () => Promise<boolean>;
  /** Re-hand the plan to the device after the enabled flag changed. */
  resync: () => void;
}

/**
 * Owns the day/time half of the workout reminder, which has no UI elsewhere.
 *
 * `config` is the source of truth for the initial values; every write goes back
 * to that SAME `NotificationConfig` in localStorage (the one the toggle writes
 * and the on-device scheduler reads) and immediately re-hands the plan to the
 * device. Only day and time are held locally, because nothing outside this UI
 * ever changes them.
 */
export function useWorkoutReminderSchedule(config: NotificationConfig): WorkoutReminderSchedule {
  const [days, setDays] = useState<number[]>(config.workoutReminderDays);
  const [time, setTimeState] = useState<string>(config.workoutReminderTime);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const toggleDay = useCallback(
    (day: number) => {
      const next = days.includes(day)
        ? days.filter((existing) => existing !== day)
        : [...days, day].sort((a, b) => a - b);
      setDays(next);
      saveNotificationConfig({ workoutReminderDays: next });
      void syncReminders();
    },
    [days]
  );

  const setTime = useCallback((value: string) => {
    setTimeState(value);
    // A native time input reports '' while the user is clearing it — keep that on
    // screen but never persist it, or the stored schedule loses its time.
    if (!HH_MM.test(value)) return;
    saveNotificationConfig({ workoutReminderTime: value });
    void syncReminders();
  }, []);

  const requestEnable = useCallback(async () => {
    const result = await requestReminderPermission();
    if (result === 'denied') {
      setPermissionDenied(true);
      return false;
    }
    setPermissionDenied(false);
    return true;
  }, []);

  const resync = useCallback(() => {
    void syncReminders();
  }, []);

  return { days, time, permissionDenied, toggleDay, setTime, requestEnable, resync };
}

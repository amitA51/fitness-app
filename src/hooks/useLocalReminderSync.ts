import { useEffect } from 'react';
import { onWorkoutSaved } from '../services/dataEvents';
import { syncReminders } from '../services/localRemindersSync';

/**
 * Keeps the device's scheduled workout reminders in step with the saved config.
 *
 * LIMITATION, by design: the device only knows the schedule it was told the LAST
 * TIME THE APP WAS OPEN. Nothing of ours runs in the background to refresh it —
 * that is the price of using purely on-device notifications instead of a push
 * server. So the plan is re-handed to the OS on every app open (mount + return to
 * the foreground) and after every saved workout, which is what moves the
 * inactivity nudge forward.
 *
 * The device holds at most 14 days of one-shots, so a user who stops opening the
 * app stops being reminded rather than being nagged indefinitely. That is the
 * intended behaviour, not a gap.
 *
 * On web every call is a no-op (see `services/localRemindersSync`).
 */
export function useLocalReminderSync(): void {
  useEffect(() => {
    void syncReminders();

    const offWorkoutSaved = onWorkoutSaved(() => {
      void syncReminders();
    });

    const onVisibilityChange = () => {
      if (!document.hidden) void syncReminders();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      offWorkoutSaved();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);
}

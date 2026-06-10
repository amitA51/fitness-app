// ============================================================================
// COACH PLATFORM — Reminder service
// ============================================================================
// Coach schedules reminders; the trainee's client materializes due ones into
// the existing local notification system on app open / while active. Closed-app
// delivery is handled server-side by the `reminders-dispatch` edge function
// (pg_cron, once a minute) — the shared per-reminder-per-day `tag` lets the two
// coalesce so an open app doesn't double-notify.

import type { Reminder, ReminderSchedule } from '../../types/coach';
import { logger } from '../../utils/logger';
import { showNotification } from '../notificationService';
import { getCurrentUser } from '../supabaseAuth';
import { requireClient, toReminder } from './mappers';

export interface NewReminder {
  title: string;
  body?: string;
  schedule: ReminderSchedule;
  clientId?: string;
  groupId?: string;
}

/** HH:MM (24h) — the only shape isReminderDue can match on. */
const TIME_PATTERN = /^\d{1,2}:\d{2}$/;

export const createReminder = async (input: NewReminder): Promise<Reminder> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('unauthenticated');
  if (!input.clientId && !input.groupId) throw new Error('reminder_needs_target');
  const { time } = input.schedule ?? {};
  if (!time || !TIME_PATTERN.test(time)) throw new Error('reminder_invalid_time');
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      coach_id: user.id,
      client_id: input.clientId ?? null,
      group_id: input.groupId ?? null,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      schedule: input.schedule,
    })
    .select('*')
    .single();
  if (error) throw error;
  return toReminder(data);
};

export const listCoachReminders = async (clientId?: string): Promise<Reminder[]> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return [];
  let query = supabase
    .from('reminders')
    .select('id, coach_id, client_id, group_id, title, body, schedule, created_at')
    .eq('coach_id', user.id);
  if (clientId) query = query.eq('client_id', clientId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    logger.db.error('listCoachReminders failed', error);
    // Throw so the reminders box shows its error state, not a fake empty list.
    throw new Error(error.message);
  }
  return (data ?? []).map(toReminder);
};

export const deleteReminder = async (id: string): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  return { error: error?.message ?? null };
};

export const listMyReminders = async (): Promise<Reminder[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('reminders')
    .select('id, coach_id, client_id, group_id, title, body, schedule, created_at')
    .order('created_at', { ascending: false });
  if (error) {
    logger.db.error('listMyReminders failed', error);
    return [];
  }
  return (data ?? []).map(toReminder);
};

const FIRED_KEY = 'coach_reminders_fired';

const pad = (n: number): string => String(n).padStart(2, '0');

/**
 * Local YYYY-MM-DD for `d`. Hour/minute matching is LOCAL, so the one-off
 * `date` match must be too — toISOString() (UTC) makes a 00:00–02:59 reminder
 * in Asia/Jerusalem compare against yesterday's date and never fire.
 */
const toLocalDateString = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Is `reminder` due within the current minute for `now`? */
export const isReminderDue = (reminder: Reminder, now: Date): boolean => {
  const { time, days, date } = reminder.schedule ?? {};
  if (!time) return false;
  const [h, m] = time.split(':').map(Number);
  // A malformed time such as '9' (no colon) yields m=NaN, which would silently
  // never fire; reject any non-integer hour/minute rather than miss the slot.
  if (!Number.isInteger(h) || !Number.isInteger(m)) return false;
  if (now.getHours() !== h || now.getMinutes() !== m) return false;
  if (date && date !== toLocalDateString(now)) return false;
  if (days && days.length > 0 && !days.includes(now.getDay())) return false;
  return true;
};

/**
 * Fire due reminders as local notifications, de-duplicated per reminder+minute
 * so re-renders within the same minute don't double-notify.
 */
export const materializeDueReminders = async (now: Date = new Date()): Promise<number> => {
  let reminders: Reminder[];
  try {
    reminders = await listMyReminders();
  } catch {
    return 0; // offline — nothing to do
  }
  const stamp = `${now.toISOString().slice(0, 16)}`; // minute precision
  let fired: Record<string, string> = {};
  try {
    fired = JSON.parse(localStorage.getItem(FIRED_KEY) ?? '{}');
  } catch {
    fired = {};
  }

  // Per-reminder-per-day tag: shared with the server-side reminders-dispatch
  // push payload so the OS coalesces the two into a single notification when
  // the app happens to be open at the scheduled minute. Uses the LOCAL date
  // (isReminderDue matches on local time, and the dispatcher uses Israel date),
  // so the two tags line up rather than diverging across the UTC midnight.
  const localDate = toLocalDateString(now);

  // Collect everything due-this-minute first, then fire in parallel — several
  // reminders can collide on a single minute and serial awaits would stagger them.
  const due = reminders.filter((r) => isReminderDue(r, now) && fired[r.id] !== stamp);
  await Promise.all(
    due.map((r) => showNotification(r.title, r.body ?? '', undefined, `reminder:${r.id}:${localDate}`))
  );
  for (const r of due) {
    fired[r.id] = stamp;
  }
  const count = due.length;
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  } catch {
    // ignore storage errors
  }
  return count;
};

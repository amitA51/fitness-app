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

/** Group ids the given user is a MEMBER of (RLS: client_group_members_select_self). */
const listMyGroupIds = async (userId: string): Promise<Set<string>> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('client_group_members')
    .select('group_id')
    .eq('client_id', userId);
  if (error) {
    // Fail CLOSED: an unknown membership must not become a fired notification.
    logger.db.error('listMyGroupIds failed', error);
    return new Set();
  }
  return new Set((data ?? []).map((r: { group_id: string }) => r.group_id));
};

/** listMyReminders for a known user, except that a failed read THROWS, so a
 * cache can tell "the server failed" apart from "there are no reminders". */
const fetchRemindersFor = async (userId: string): Promise<Reminder[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('reminders')
    .select('id, coach_id, client_id, group_id, title, body, schedule, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const rows = (data ?? []).map(toReminder);
  // Only pay for the membership lookup when a group-addressed row is in play.
  const needsGroups = rows.some((r) => !r.clientId && r.groupId);
  const myGroupIds = needsGroups ? await listMyGroupIds(userId) : new Set<string>();
  return rows.filter((r) =>
    r.clientId ? r.clientId === userId : !!r.groupId && myGroupIds.has(r.groupId)
  );
};

/**
 * Reminders addressed TO the current user — the only set the local materializer
 * may fire.
 *
 * RLS on `reminders` returns the UNION of two policies: `reminders_all_own`
 * (rows the viewer AUTHORED — coach_id = auth.uid(), which the coach UI needs)
 * and `reminders_select_target` (rows the viewer RECEIVES). A coach therefore
 * reads their clients' reminders too, so the recipient has to be re-asserted
 * here or a coach's device fires reminders meant for a client.
 *
 * The discriminator is the RECIPIENT of the row, never the role of the viewer:
 * `client_id` (else `group_id` membership) — `coach_id` is only the author. A
 * coach is also a trainee, so their own rows still come through. Precedence
 * mirrors the server-side reminders-dispatch resolution (client_id wins).
 */
export const listMyReminders = async (): Promise<Reminder[]> => {
  requireClient();
  const user = await getCurrentUser();
  if (!user) return [];
  try {
    return await fetchRemindersFor(user.id);
  } catch (error) {
    logger.db.error('listMyReminders failed', error);
    return [];
  }
};

/** How often the open app re-reads the reminder list from the server. */
export const REMINDERS_REFRESH_MS = 5 * 60_000;
/** How often due reminders are checked against the cached list (no network). */
export const REMINDERS_TICK_MS = 60_000;

/** The last list the server returned, per user. In memory: a reload re-reads it.
 * Keyed by user so a late answer for one account never displaces another's. */
const reminderCache = new Map<string, Reminder[]>();
/** When the server was last ASKED per user (success or failure), so a failing
 * server is retried every REMINDERS_REFRESH_MS rather than on every tick. */
const lastAttemptAt = new Map<string, number>();
/** The read in flight per user, shared by every caller (single-flight). */
const inFlight = new Map<string, Promise<void>>();

const refreshReminderCache = (userId: string): Promise<void> => {
  const running = inFlight.get(userId);
  if (running) return running;
  lastAttemptAt.set(userId, Date.now());
  const promise: Promise<void> = fetchRemindersFor(userId)
    .then((reminders) => {
      reminderCache.set(userId, reminders);
    })
    .catch((error) => {
      // Keep the last good list: an overloaded server must not silence reminders.
      logger.db.warn('Reminder refresh failed; keeping the last list', error);
    })
    .finally(() => {
      inFlight.delete(userId);
    });
  inFlight.set(userId, promise);
  return promise;
};

/**
 * The current user's reminders from the in-memory cache, re-read from the
 * server at most every REMINDERS_REFRESH_MS. With a cached list the answer is
 * immediate and a due re-read happens in the background; only the very first
 * read (nothing cached yet) is awaited. Concurrent callers share one request.
 */
export const getMyRemindersCached = async (): Promise<Reminder[]> => {
  requireClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const askedAt = lastAttemptAt.get(user.id);
  const due = askedAt === undefined || Date.now() - askedAt >= REMINDERS_REFRESH_MS;
  const cached = reminderCache.get(user.id);
  if (cached) {
    if (due) void refreshReminderCache(user.id);
    return cached;
  }
  if (due || inFlight.has(user.id)) await refreshReminderCache(user.id);
  return reminderCache.get(user.id) ?? [];
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
 * so re-renders within the same minute don't double-notify. Pass `list` to
 * check an already-loaded list (the open-app loop passes its cache); without
 * it the list is read from the server.
 */
export const materializeDueReminders = async (
  now: Date = new Date(),
  list?: Reminder[]
): Promise<number> => {
  let reminders: Reminder[];
  try {
    reminders = list ?? (await listMyReminders());
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
    due.map((r) =>
      showNotification(r.title, r.body ?? '', undefined, `reminder:${r.id}:${localDate}`)
    )
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

/**
 * The open-app reminder loop. Every REMINDERS_TICK_MS it checks the cached list
 * for reminders due this minute (local work only); the list itself is re-read
 * from the server at most every REMINDERS_REFRESH_MS (getMyRemindersCached).
 *
 * - Visible only: the loop stops while the tab is hidden and runs at once when
 *   it comes back, which also re-reads the list if it has gone stale.
 * - Single-flight: a tick that finds the previous one still running is skipped,
 *   so a slow server never stacks requests or fires a reminder twice.
 *
 * Returns the function that stops the loop.
 */
export const startReminderLoop = (): (() => void) => {
  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;
  let stopped = false;

  const run = async (): Promise<void> => {
    if (running || stopped || document.hidden) return;
    running = true;
    // Take the minute BEFORE any network wait, so a slow first read still
    // checks the minute this tick was meant for.
    const now = new Date();
    try {
      const reminders = await getMyRemindersCached();
      if (!stopped) await materializeDueReminders(now, reminders);
    } catch {
      // Offline / no backend: nothing to fire, try again next tick.
    } finally {
      running = false;
    }
  };

  const start = (): void => {
    if (timer !== null) return;
    void run();
    timer = setInterval(() => void run(), REMINDERS_TICK_MS);
  };

  const stop = (): void => {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  };

  const handleVisibility = (): void => {
    if (document.hidden) stop();
    else start();
  };

  if (!document.hidden) start();
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    stopped = true;
    stop();
    document.removeEventListener('visibilitychange', handleVisibility);
  };
};

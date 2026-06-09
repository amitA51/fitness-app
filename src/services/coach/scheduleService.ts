// ============================================================================
// COACH PLATFORM — Weekly schedule service (public.workout_schedule)
// ============================================================================
// A coach plans concrete dated workouts for a trainee; the trainee sees today's
// plan and can start it. Online-only (requireClient()), RLS-gated: owner sees
// own rows, a coach sees rows of clients they are an ACTIVE coach of. Coach
// writes stamp `updated_by` and best-effort writeAudit. Schedule rows are NOT
// part of the local-first sync, so deletes are a hard delete (no tombstone).

import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { writeAudit } from './auditService';
import { requireClient } from './mappers';

const TABLE = 'workout_schedule';
const CONFLICT_KEY = 'user_id,scheduled_date,template_id';
const MS_PER_DAY = 86_400_000;

export type ScheduleStatus = 'planned' | 'done' | 'skipped';

export interface ScheduledWorkout {
  id: string;
  coachId: string | null;
  userId: string;
  templateId: string | null;
  assignmentId: string | null;
  /** Local calendar date in YYYY-MM-DD format. */
  scheduledDate: string;
  title: string | null;
  status: ScheduleStatus;
  sessionId: string | null;
  completedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

type Row = Record<string, unknown>;

/** Map a snake_case workout_schedule row to the camelCase domain shape. */
export const toScheduledWorkout = (r: Row): ScheduledWorkout => ({
  id: r.id as string,
  coachId: (r.coach_id as string | null) ?? null,
  userId: r.user_id as string,
  templateId: (r.template_id as string | null) ?? null,
  assignmentId: (r.assignment_id as string | null) ?? null,
  scheduledDate: r.scheduled_date as string,
  title: (r.title as string | null) ?? null,
  status: ((r.status as ScheduleStatus) ?? 'planned') as ScheduleStatus,
  sessionId: (r.session_id as string | null) ?? null,
  completedAt: (r.completed_at as string | null) ?? null,
  createdAt: r.created_at as string | undefined,
  updatedAt: r.updated_at as string | undefined,
});

// ---- helpers ---------------------------------------------------------------

/** Build a local YYYY-MM-DD string without UTC conversion (avoids timezone bug). */
function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today's local calendar date (YYYY-MM-DD). */
function todayLocal(now: Date = new Date()): string {
  return toLocalDateString(now);
}

/** Add `days` whole days to a YYYY-MM-DD string and return YYYY-MM-DD. */
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const base = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  base.setDate(base.getDate() + days);
  return toLocalDateString(base);
}

// ============================================================================
// COACH FUNCTIONS (write path — stamp updated_by + audit)
// ============================================================================

/** Schedule a single dated workout for a client. */
export const scheduleWorkout = async (
  clientId: string,
  input: {
    templateId: string | null;
    scheduledDate: string;
    title?: string | null;
    assignmentId?: string | null;
  }
): Promise<{ error: string | null; id?: string }> => {
  let db: ReturnType<typeof requireClient>;
  try {
    db = requireClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'offline' };
  }

  const coach = await getCurrentUser();
  const { data, error } = await db
    .from(TABLE)
    .insert({
      coach_id: coach?.id ?? null,
      user_id: clientId,
      template_id: input.templateId ?? null,
      assignment_id: input.assignmentId ?? null,
      scheduled_date: input.scheduledDate,
      title: input.title?.trim() || null,
      status: 'planned',
      updated_by: coach?.id ?? null,
    })
    .select('id')
    .single();

  if (error) {
    logger.db.error('scheduleWorkout failed', error);
    return { error: error.message };
  }

  const id = (data as { id: string } | null)?.id;
  await writeAudit({
    subjectUserId: clientId,
    tableName: TABLE,
    action: 'schedule_workout',
    rowId: id ?? null,
  }).catch(() => undefined);
  return { error: null, id };
};

/**
 * Expand a weekly day-map into concrete dated rows and upsert them.
 * `weekStart` is the Sunday (or any anchor) the `weekday` offsets are relative
 * to. Upsert on the (user_id, scheduled_date, template_id) conflict key keeps
 * re-runs idempotent (no duplicate rows when a coach re-applies a week).
 */
export const scheduleProgramWeek = async (
  clientId: string,
  input: {
    assignmentId?: string | null;
    weekStart: string;
    dayMap: Array<{ templateId: string; name: string; weekday: number }>;
    weeks?: number;
  }
): Promise<{ error: string | null; count: number }> => {
  let db: ReturnType<typeof requireClient>;
  try {
    db = requireClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'offline', count: 0 };
  }

  const weeks = Math.max(1, input.weeks ?? 1);
  const coach = await getCurrentUser();

  const rows: Array<Record<string, unknown>> = [];
  for (let w = 0; w < weeks; w++) {
    for (const entry of input.dayMap) {
      const offset = w * 7 + entry.weekday;
      rows.push({
        coach_id: coach?.id ?? null,
        user_id: clientId,
        template_id: entry.templateId,
        assignment_id: input.assignmentId ?? null,
        scheduled_date: addDays(input.weekStart, offset),
        title: entry.name?.trim() || null,
        status: 'planned',
        updated_by: coach?.id ?? null,
      });
    }
  }

  if (rows.length === 0) return { error: null, count: 0 };

  const { error } = await db.from(TABLE).upsert(rows, { onConflict: CONFLICT_KEY });
  if (error) {
    logger.db.error('scheduleProgramWeek failed', error);
    return { error: error.message, count: 0 };
  }

  await writeAudit({
    subjectUserId: clientId,
    tableName: TABLE,
    action: 'schedule_program_week',
    rowId: null,
  }).catch(() => undefined);
  return { error: null, count: rows.length };
};

/** Patch a scheduled workout (date / template / status / title). */
export const updateScheduledWorkout = async (
  id: string,
  patch: {
    scheduledDate?: string;
    templateId?: string | null;
    status?: ScheduleStatus;
    title?: string | null;
  }
): Promise<{ error: string | null }> => {
  let db: ReturnType<typeof requireClient>;
  try {
    db = requireClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'offline' };
  }

  const coach = await getCurrentUser();
  const update: Record<string, unknown> = { updated_by: coach?.id ?? null };
  if (patch.scheduledDate !== undefined) update.scheduled_date = patch.scheduledDate;
  if (patch.templateId !== undefined) update.template_id = patch.templateId;
  if (patch.title !== undefined) update.title = patch.title?.trim() || null;
  if (patch.status !== undefined) {
    update.status = patch.status;
    update.completed_at = patch.status === 'done' ? new Date().toISOString() : null;
  }

  const { data, error } = await db
    .from(TABLE)
    .update(update)
    .eq('id', id)
    .select('user_id')
    .single();
  if (error) {
    logger.db.error('updateScheduledWorkout failed', error);
    return { error: error.message };
  }

  // audit_log.subject_user_id is a NOT NULL FK, so an empty subject would
  // silently reject the audit insert. Use the row's owner; skip if unresolved.
  const subjectUserId = (data as { user_id: string } | null)?.user_id;
  if (subjectUserId) {
    await writeAudit({
      subjectUserId,
      tableName: TABLE,
      action: 'update_scheduled_workout',
      rowId: id,
    }).catch(() => undefined);
  }
  return { error: null };
};

/** Hard-delete a scheduled workout (schedule rows are not in local-first sync). */
export const deleteScheduledWorkout = async (id: string): Promise<{ error: string | null }> => {
  let db: ReturnType<typeof requireClient>;
  try {
    db = requireClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'offline' };
  }

  // Resolve the row's owner BEFORE deleting — after the delete the row is gone,
  // and audit_log.subject_user_id is a NOT NULL FK (an empty subject is rejected).
  const { data: owner } = await db.from(TABLE).select('user_id').eq('id', id).single();
  const subjectUserId = (owner as { user_id: string } | null)?.user_id;

  const { error } = await db.from(TABLE).delete().eq('id', id);
  if (error) {
    logger.db.error('deleteScheduledWorkout failed', error);
    return { error: error.message };
  }

  if (subjectUserId) {
    await writeAudit({
      subjectUserId,
      tableName: TABLE,
      action: 'delete_scheduled_workout',
      rowId: id,
    }).catch(() => undefined);
  }
  return { error: null };
};

/** Coach read: a client's schedule over an inclusive [fromDate, toDate] window. */
export const getClientSchedule = async (
  clientId: string,
  fromDate: string,
  toDate: string,
  opts?: { throwOnError?: boolean }
): Promise<ScheduledWorkout[]> => {
  let db: ReturnType<typeof requireClient>;
  try {
    db = requireClient();
  } catch (e) {
    if (opts?.throwOnError) throw e;
    return [];
  }

  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('user_id', clientId)
    .gte('scheduled_date', fromDate)
    .lte('scheduled_date', toDate)
    .order('scheduled_date', { ascending: true });

  if (error) {
    logger.db.error('getClientSchedule failed', error);
    // throwOnError lets aggregates distinguish a fetch failure from no data.
    if (opts?.throwOnError) throw new Error(error.message);
    return [];
  }
  return (data ?? []).map(toScheduledWorkout);
};

/** Per-client planned/done split of today's scheduled workouts. */
export interface TodayScheduleCount {
  planned: number;
  done: number;
}

/**
 * Coach read: today's scheduled workouts for many clients in ONE query
 * (workout_schedule where user_id IN clientIds and scheduled_date = today),
 * reduced to a per-client {planned, done} split — no N+1. `planned` counts rows
 * still due (status 'planned'); `done` counts completed rows. Empty input
 * short-circuits. RLS limits rows to the coach's active clients.
 */
export const getScheduledTodayByClient = async (
  clientIds: string[],
  now: Date = new Date()
): Promise<Record<string, TodayScheduleCount>> => {
  const result: Record<string, TodayScheduleCount> = {};
  if (clientIds.length === 0) return result;

  let db: ReturnType<typeof requireClient>;
  try {
    db = requireClient();
  } catch {
    return result;
  }

  const today = todayLocal(now);
  const { data, error } = await db
    .from(TABLE)
    .select('user_id, status')
    .in('user_id', clientIds)
    .eq('scheduled_date', today);

  if (error) {
    logger.db.error('getScheduledTodayByClient failed', error);
    return result;
  }

  for (const r of data ?? []) {
    const row = r as { user_id: string; status: ScheduleStatus };
    const bucket = result[row.user_id] ?? { planned: 0, done: 0 };
    if (row.status === 'done') bucket.done += 1;
    else if (row.status === 'planned') bucket.planned += 1;
    result[row.user_id] = bucket;
  }
  return result;
};

// ============================================================================
// TRAINEE FUNCTIONS (RLS scopes user_id to self)
// ============================================================================

/** Trainee read: own schedule over an inclusive [fromDate, toDate] window. */
export const getMySchedule = async (
  fromDate: string,
  toDate: string
): Promise<ScheduledWorkout[]> => {
  let db: ReturnType<typeof requireClient>;
  try {
    db = requireClient();
  } catch {
    return [];
  }

  const user = await getCurrentUser();
  if (!user) return [];

  const { data, error } = await db
    .from(TABLE)
    .select('*')
    .eq('user_id', user.id)
    .gte('scheduled_date', fromDate)
    .lte('scheduled_date', toDate)
    .order('scheduled_date', { ascending: true });

  if (error) {
    logger.db.error('getMySchedule failed', error);
    return [];
  }
  return (data ?? []).map(toScheduledWorkout);
};

/** Trainee read: today's scheduled workouts (local date). */
export const getTodaysScheduledWorkouts = async (
  now: Date = new Date()
): Promise<ScheduledWorkout[]> => {
  const today = todayLocal(now);
  return getMySchedule(today, today);
};

/** Trainee write: mark a scheduled row done/skipped (sets completed_at on done). */
export const markScheduleStatus = async (
  id: string,
  status: 'done' | 'skipped',
  sessionId?: string | null
): Promise<{ error: string | null }> => {
  let db: ReturnType<typeof requireClient>;
  try {
    db = requireClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'offline' };
  }

  const user = await getCurrentUser();
  const update: Record<string, unknown> = {
    status,
    completed_at: status === 'done' ? new Date().toISOString() : null,
    session_id: sessionId ?? null,
    updated_by: user?.id ?? null,
  };

  let query = db.from(TABLE).update(update).eq('id', id);
  // Defense-in-depth ownership scoping (RLS already restricts to the owner).
  if (user?.id) query = query.eq('user_id', user.id);
  const { error } = await query;
  if (error) {
    logger.db.error('markScheduleStatus failed', error);
    return { error: error.message };
  }
  return { error: null };
};

/**
 * Reconcile the schedule after a workout session is saved. If the session is
 * completed and references a templateId, find the first matching `planned` row
 * (same templateId, on the session's local date OR the day before — to catch a
 * late-night workout that started before midnight) and flip it to `done`,
 * linking the session. Idempotent (skips rows already non-planned), online
 * best-effort: never throws, logs a warning on any failure.
 */
export const reconcileScheduleOnSessionSave = async (session: {
  templateId?: string | null;
  startTime?: string | null;
  status?: string;
  id: string;
}): Promise<void> => {
  try {
    if (session.status !== 'completed') return;
    if (!session.templateId) return;

    const start = session.startTime ? new Date(session.startTime) : new Date();
    if (!Number.isFinite(start.getTime())) return;

    const sessionDate = toLocalDateString(start);
    const dayBefore = toLocalDateString(new Date(start.getTime() - MS_PER_DAY));

    const rows = await getMySchedule(dayBefore, sessionDate);
    const match = rows.find(
      (r) =>
        r.status === 'planned' &&
        r.templateId === session.templateId &&
        (r.scheduledDate === sessionDate || r.scheduledDate === dayBefore)
    );
    if (!match) return;

    await markScheduleStatus(match.id, 'done', session.id);
  } catch (e) {
    logger.db.warn('reconcileScheduleOnSessionSave failed (non-fatal)', e);
  }
};

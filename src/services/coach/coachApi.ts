// ============================================================================
// COACH PLATFORM — coachApi (the coach-side data path)
// ============================================================================
// Direct-to-Supabase reads/writes of a TRAINEE's data, parameterized by
// clientId. This deliberately bypasses the local-first IndexedDB layer (which
// is wiped on logout and only holds the current user's own data). RLS enforces
// that the caller is an ACTIVE coach of `clientId`; writes stamp `updated_by`
// for audit and reflect to the trainee via their normal pull/Realtime path.

import type { BodyWeightEntry, WorkoutSession, WorkoutTemplate } from '../../types';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import type { BodyMeasurement, NutritionLog, PersonalRecordRow } from '../supabaseSyncMappers';
import {
  toCanonicalBodyWeight,
  toCanonicalSession,
  toCanonicalTemplate,
} from '../supabaseSyncMappers';
import { writeAudit } from './auditService';
import { requireClient } from './mappers';

/** Sum reps×weight across all sets of all exercises — the canonical totalVolume. */
const computeTotalVolume = (exercises: WorkoutSession['exercises']): number => {
  let total = 0;
  for (const ex of exercises ?? []) {
    for (const set of ex.sets ?? []) {
      const reps = typeof set.reps === 'number' ? set.reps : 0;
      const weight = typeof set.weight === 'number' ? set.weight : 0;
      total += reps * weight;
    }
  }
  return total;
};

// ---- READS -----------------------------------------------------------------

export const getClientSessions = async (
  clientId: string,
  limit = 100,
  opts?: { throwOnError?: boolean }
): Promise<WorkoutSession[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select(
      'id, title, date, start_time, end_time, duration, exercises, total_volume, notes, created_at, updated_at'
    )
    .eq('user_id', clientId)
    .is('deleted_at', null)
    .order('start_time', { ascending: false })
    .limit(limit);
  if (error) {
    logger.db.error('getClientSessions failed', error);
    // throwOnError lets aggregates (e.g. week adherence) distinguish a fetch
    // failure from a genuinely empty result instead of rendering fake zeros.
    if (opts?.throwOnError) throw new Error(error.message);
    return [];
  }
  return (data ?? []).map((r) =>
    toCanonicalSession({
      id: r.id,
      title: r.title,
      date: r.date,
      startTime: r.start_time,
      endTime: r.end_time,
      duration: r.duration,
      exercises: r.exercises ?? [],
      totalVolume: r.total_volume,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })
  );
};

/**
 * Batched activity fetch for the coach overview. ONE query for ALL clients
 * (only 3 small columns, no exercises JSON) instead of N per-client fetches —
 * fixes the roster N+1. Returns sessions grouped by clientId. RLS keeps the
 * rows scoped to the coach's active links.
 */
export const getClientsActivity = async (
  clientIds: string[]
): Promise<Record<string, { startTime: string; totalVolume: number }[]>> => {
  const grouped: Record<string, { startTime: string; totalVolume: number }[]> = {};
  if (clientIds.length === 0) return grouped;
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('user_id, start_time, total_volume')
    .in('user_id', clientIds)
    .is('deleted_at', null)
    .order('start_time', { ascending: false });
  if (error) {
    logger.db.error('getClientsActivity failed', error);
    // A failed roster-activity read must surface as an error — returning an
    // empty map would render the whole roster as "all calm".
    throw new Error(error.message);
  }
  for (const id of clientIds) grouped[id] = [];
  for (const r of data ?? []) {
    const row = r as { user_id: string; start_time: string; total_volume: number | null };
    let bucket = grouped[row.user_id];
    if (!bucket) {
      bucket = [];
      grouped[row.user_id] = bucket;
    }
    bucket.push({
      startTime: row.start_time,
      totalVolume: row.total_volume ?? 0,
    });
  }
  return grouped;
};

export const getClientTemplates = async (clientId: string): Promise<WorkoutTemplate[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('workout_templates')
    .select('id, name, description, exercises, created_at, updated_at')
    .eq('user_id', clientId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    logger.db.error('getClientTemplates failed', error);
    return [];
  }
  return (data ?? []).map((r) =>
    toCanonicalTemplate({
      id: r.id,
      name: r.name,
      description: r.description,
      exercises: r.exercises ?? [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })
  );
};

export const getClientBodyWeight = async (
  clientId: string,
  opts?: { throwOnError?: boolean }
): Promise<BodyWeightEntry[]> => {
  const supabase = requireClient();
  // body_weight has a `notes` column (migration 20260608000500) that
  // upsertClientBodyWeight writes, so it is selected and mapped here.
  const { data, error } = await supabase
    .from('body_weight')
    .select('id, weight, date, notes, created_at, updated_at')
    .eq('user_id', clientId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .limit(500);
  if (error) {
    logger.db.error('getClientBodyWeight failed', error);
    if (opts?.throwOnError) throw new Error(error.message);
    return [];
  }
  return (data ?? []).map((r) =>
    toCanonicalBodyWeight({
      id: r.id,
      weight: r.weight,
      date: r.date,
      notes: r.notes,
      createdAt: r.created_at,
    })
  );
};

export const getClientPRs = async (
  clientId: string,
  opts?: { throwOnError?: boolean }
): Promise<PersonalRecordRow[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('personal_records')
    .select(
      'id, exercise_id, exercise_name, weight, reps, date, record_type, created_at, updated_at'
    )
    .eq('user_id', clientId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .limit(500);
  if (error) {
    logger.db.error('getClientPRs failed', error);
    if (opts?.throwOnError) throw new Error(error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    exerciseId: r.exercise_id,
    exerciseName: r.exercise_name,
    weight: r.weight,
    reps: r.reps,
    date: r.date,
    recordType: r.record_type,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
};

export const getClientNutrition = async (
  clientId: string,
  limit = 60,
  opts?: { throwOnError?: boolean }
): Promise<NutritionLog[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('nutrition_logs')
    .select('id, date, calories, protein, carbs, fat, meals, notes, created_at, updated_at')
    .eq('user_id', clientId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) {
    logger.db.error('getClientNutrition failed', error);
    if (opts?.throwOnError) throw new Error(error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    meals: r.meals ?? [],
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
};

export const getClientMeasurements = async (
  clientId: string,
  opts?: { throwOnError?: boolean }
): Promise<BodyMeasurement[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('body_measurements')
    .select('id, date, measurements, notes, created_at, updated_at')
    .eq('user_id', clientId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .limit(500);
  if (error) {
    logger.db.error('getClientMeasurements failed', error);
    if (opts?.throwOnError) throw new Error(error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id,
    date: r.date,
    measurements: r.measurements ?? {},
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
};

// ---- WRITES (full control, audited) ----------------------------------------
// Every coach write to a trainee-owned table goes through `auditedWrite`: it
// stamps `updated_by` = the coach (so the trainee's last-write-wins merge knows
// who touched the row), runs the Supabase op, and — only on success — records an
// audit entry. Deletes are TOMBSTONE updates (deleted_at + a fresh updated_at),
// never hard deletes: a hard delete is resurrected by the trainee's local-first
// push, whereas a tombstone propagates the deletion through the merge.

interface AuditedWriteParams {
  /** The trainee whose data is being written (audit subject + RLS scope). */
  clientId: string;
  /** Snake_case table name (also recorded in the audit log). */
  tableName: string;
  /** Audit verb: 'create' | 'update' | 'delete'. */
  action: 'create' | 'update' | 'delete';
  /** The affected row's id, for the audit trail. */
  rowId: string;
  /** Runs the actual Supabase write; resolves with a Supabase-style error. */
  run: (coachId: string | null) => PromiseLike<{ error: { message: string } | null }>;
}

/**
 * Run a coach write and, on success, append an audit entry. Returns the same
 * `{ error }` envelope every coach writer uses. The audit write is best-effort
 * (its own failure is logged inside writeAudit) and never masks a successful
 * data write.
 */
const auditedWrite = async ({
  clientId,
  tableName,
  action,
  rowId,
  run,
}: AuditedWriteParams): Promise<{ error: string | null }> => {
  const coach = await getCurrentUser();
  const { error } = await run(coach?.id ?? null);
  if (error) {
    logger.db.error(`coach write failed: ${action} ${tableName}`, error);
    return { error: error.message };
  }
  await writeAudit({ subjectUserId: clientId, tableName, action, rowId });
  return { error: null };
};

// ---- workout sessions ------------------------------------------------------
// Session-title model (decided): `notes` is the ONE user-facing title concept —
// the canonical WorkoutSession has no `title` field and nothing in the app
// reads the row's `title` column. Coach writers mirror notes → title so the
// column stays coherent for any future trainee-side title UI.

/** Create a workout session on the trainee's behalf. Returns the new row id. */
export const createClientSession = async (
  clientId: string,
  session: Partial<WorkoutSession>
): Promise<{ error: string | null; id?: string }> => {
  const supabase = requireClient();
  // Cloud id columns are UUID — generateId() (prefixed IndexedDB ids) is invalid here.
  const id = session.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const exercises = (session.exercises ?? []) as WorkoutSession['exercises'];
  const { error } = await auditedWrite({
    clientId,
    tableName: 'workout_sessions',
    action: 'create',
    rowId: id,
    run: (coachId) =>
      supabase.from('workout_sessions').insert({
        id,
        user_id: clientId,
        title: session.notes || null,
        date: session.date || now.slice(0, 10),
        start_time: session.startTime || now,
        end_time: session.endTime ?? null,
        duration: session.duration ?? 0,
        exercises,
        total_volume: session.totalVolume ?? computeTotalVolume(exercises),
        notes: session.notes || null,
        created_at: now,
        updated_at: now,
        updated_by: coachId,
      }),
  });
  return error ? { error } : { error: null, id };
};

/** Patch an existing session. Always stamps a fresh updated_at + updated_by. */
export const updateClientSession = async (
  clientId: string,
  sessionId: string,
  patch: Partial<WorkoutSession>
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const now = new Date().toISOString();
  const row: Record<string, unknown> = { updated_at: now };
  if (patch.date !== undefined) row.date = patch.date;
  if (patch.startTime !== undefined) row.start_time = patch.startTime;
  if (patch.endTime !== undefined) row.end_time = patch.endTime ?? null;
  if (patch.duration !== undefined) row.duration = patch.duration ?? 0;
  if (patch.exercises !== undefined) {
    row.exercises = patch.exercises;
    row.total_volume =
      patch.totalVolume ?? computeTotalVolume(patch.exercises as WorkoutSession['exercises']);
  } else if (patch.totalVolume !== undefined) {
    row.total_volume = patch.totalVolume;
  }
  if (patch.notes !== undefined) {
    row.notes = patch.notes || null;
    row.title = patch.notes || null; // mirror — notes is the single title concept
  }
  return auditedWrite({
    clientId,
    tableName: 'workout_sessions',
    action: 'update',
    rowId: sessionId,
    run: (coachId) =>
      supabase
        .from('workout_sessions')
        .update({ ...row, updated_by: coachId })
        .eq('id', sessionId)
        .eq('user_id', clientId),
  });
};

/** Soft-delete a session (tombstone). The trainee's merge removes it on pull. */
export const deleteClientSession = async (
  clientId: string,
  sessionId: string
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const now = new Date().toISOString();
  return auditedWrite({
    clientId,
    tableName: 'workout_sessions',
    action: 'delete',
    rowId: sessionId,
    run: (coachId) =>
      supabase
        .from('workout_sessions')
        .update({ deleted_at: now, updated_at: now, updated_by: coachId })
        .eq('id', sessionId)
        .eq('user_id', clientId),
  });
};

// ---- nutrition logs --------------------------------------------------------

export interface ClientNutritionInput {
  id?: string;
  date: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  notes?: string;
}

/** Create or update a daily nutrition log for the trainee. Returns the row id. */
export const upsertClientNutritionLog = async (
  clientId: string,
  log: ClientNutritionInput
): Promise<{ error: string | null; id?: string }> => {
  const supabase = requireClient();
  const isCreate = !log.id;
  const id = log.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const { error } = await auditedWrite({
    clientId,
    tableName: 'nutrition_logs',
    action: log.id ? 'update' : 'create',
    rowId: id,
    run: (coachId) =>
      supabase.from('nutrition_logs').upsert({
        id,
        user_id: clientId,
        date: log.date,
        calories: log.calories || null,
        protein: log.protein ?? null,
        carbs: log.carbs ?? null,
        fat: log.fat ?? null,
        notes: log.notes || null,
        updated_at: now,
        updated_by: coachId,
        // Create-only fields: on UPDATE these would wipe the trainee's logged
        // meals (jsonb NOT NULL, defaults to []) and reset the original
        // created_at, so they are sent only when minting a new row.
        ...(isCreate && { meals: [], created_at: now }),
      }),
  });
  return error ? { error } : { error: null, id };
};

/** Soft-delete a nutrition log (tombstone). */
export const deleteClientNutritionLog = async (
  clientId: string,
  logId: string
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const now = new Date().toISOString();
  return auditedWrite({
    clientId,
    tableName: 'nutrition_logs',
    action: 'delete',
    rowId: logId,
    run: (coachId) =>
      supabase
        .from('nutrition_logs')
        .update({ deleted_at: now, updated_at: now, updated_by: coachId })
        .eq('id', logId)
        .eq('user_id', clientId),
  });
};

// ---- body weight -----------------------------------------------------------

export interface ClientBodyWeightInput {
  id?: string;
  date: string;
  weight: number;
  notes?: string;
}

/** Create or update a body-weight entry for the trainee. Returns the row id. */
export const upsertClientBodyWeight = async (
  clientId: string,
  entry: ClientBodyWeightInput
): Promise<{ error: string | null; id?: string }> => {
  const supabase = requireClient();
  const isCreate = !entry.id;
  const id = entry.id ?? crypto.randomUUID();
  const now = new Date().toISOString();
  const { error } = await auditedWrite({
    clientId,
    tableName: 'body_weight',
    action: entry.id ? 'update' : 'create',
    rowId: id,
    run: (coachId) =>
      supabase.from('body_weight').upsert({
        id,
        user_id: clientId,
        weight: entry.weight,
        date: entry.date,
        notes: entry.notes || null,
        updated_at: now,
        updated_by: coachId,
        // Create-only: on UPDATE this would reset the row's original created_at.
        ...(isCreate && { created_at: now }),
      }),
  });
  return error ? { error } : { error: null, id };
};

// ---- workout templates -----------------------------------------------------

/** Create or update a template owned by the trainee. Stamps updated_by = coach. */
export const upsertClientTemplate = async (
  clientId: string,
  template: WorkoutTemplate
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const now = new Date().toISOString();
  return auditedWrite({
    clientId,
    tableName: 'workout_templates',
    action: 'update',
    rowId: template.id,
    run: (coachId) =>
      supabase.from('workout_templates').upsert({
        id: template.id,
        user_id: clientId,
        name: template.name,
        description: template.description || null,
        exercises: template.exercises,
        created_at: template.createdAt || now,
        updated_at: now,
        updated_by: coachId,
      }),
  });
};

/**
 * Soft-delete a template (tombstone). Previously a HARD delete, which the
 * trainee's local-first push immediately resurrected; a tombstone (deleted_at +
 * fresh updated_at) lets the deletion propagate through the merge instead.
 */
export const deleteClientTemplate = async (
  clientId: string,
  templateId: string
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const now = new Date().toISOString();
  return auditedWrite({
    clientId,
    tableName: 'workout_templates',
    action: 'delete',
    rowId: templateId,
    run: (coachId) =>
      supabase
        .from('workout_templates')
        .update({ deleted_at: now, updated_at: now, updated_by: coachId })
        .eq('id', templateId)
        .eq('user_id', clientId),
  });
};

// ============================================================================
// COACH PLATFORM — Assignment service (recommendations / "send things")
// ============================================================================
// A single assignment row targets either one client OR a group. Group targets
// fan out for free via RLS (is_group_member), so a group announcement/program
// is one row seen by every member — no per-member duplication.

import type { WorkoutTemplate } from '../../types';
import type { Assignment, AssignmentKind } from '../../types/coach';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { upsertClientTemplate } from './coachApi';
import { getGroupMemberIds } from './groupService';
import { requireClient, toAssignment } from './mappers';
import { sendCoachPush } from './pushService';
import { listClients } from './relationshipService';

export interface NewAssignment {
  kind: AssignmentKind;
  title?: string;
  payload?: Record<string, unknown>;
  templateId?: string | null;
  schedule?: Record<string, unknown> | null;
  /** Provide exactly one target. */
  clientId?: string;
  groupId?: string;
}

export const createAssignment = async (input: NewAssignment): Promise<Assignment> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('unauthenticated');
  if (!input.clientId && !input.groupId) throw new Error('assignment_needs_target');

  const { data, error } = await supabase
    .from('assignments')
    .insert({
      coach_id: user.id,
      client_id: input.clientId ?? null,
      group_id: input.groupId ?? null,
      kind: input.kind,
      title: input.title ?? null,
      payload: input.payload ?? {},
      template_id: input.templateId ?? null,
      schedule: input.schedule ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  // Best-effort push so a direct assignment reaches the client with the app closed.
  if (input.clientId) {
    void sendCoachPush(input.clientId, input.title || 'עדכון חדש מהמאמן', undefined, '/my-coach');
  }
  return toAssignment(data);
};

// ---- Group program assignment (bulk) ---------------------------------------
// A program targets a whole group, but unlike an announcement (one shared row,
// no per-trainee data) each member needs THEIR OWN runnable workout_templates:
// template ids are PKs owned by the trainee, so they must be unique per member.
// We materialize a fresh copy of every day template for each active member, then
// surface ONE group assignment row whose payload.memberDays maps memberId -> day
// refs. The trainee resolves their own day list via resolveProgramDays().

/** A program day a trainee can start, after per-member template materialization. */
export interface ProgramDayRef {
  templateId: string;
  name: string;
}

/** One program day as built by ProgramBuilder: a label + a trainee-ready template. */
export interface ProgramDayInput {
  name: string;
  template: WorkoutTemplate;
}

export interface AssignProgramToGroupInput {
  groupId: string;
  programName: string;
  days: ProgramDayInput[];
}

export interface AssignProgramToGroupResult {
  assignmentId: string | null;
  memberCount: number;
  /** Member ids whose per-member templates failed to materialize fully. */
  failures: string[];
}

/** How many members we materialize templates for in parallel (bounded fan-out). */
const MEMBER_CHUNK_SIZE = 4;
const GROUP_PROGRAM_PUSH_TITLE = 'תוכנית אימון חדשה מהמאמן';

/** Split a list into fixed-size chunks for bounded-concurrency processing. */
const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

/**
 * Assign a program to every ACTIVE member of a group. For each member we write
 * fresh per-member copies of each day template (unique ids), then create ONE
 * group assignment row carrying a memberId -> day-refs map. Partial failures are
 * collected by member id; a member whose templates all failed is omitted from
 * memberDays so the trainee never sees a dangling "start" button.
 */
export const assignProgramToGroup = async (
  input: AssignProgramToGroupInput
): Promise<AssignProgramToGroupResult> => {
  const programName = input.programName.trim() || 'תוכנית אימון';

  // Only ACTIVE coach_clients pass the per-member template RLS, so intersect the
  // raw group membership with the active roster before doing any writes.
  const [memberIds, activeClients] = await Promise.all([
    getGroupMemberIds(input.groupId),
    listClients('active'),
  ]);
  const activeIds = new Set(activeClients.map((c) => c.clientId));
  const targetIds = memberIds.filter((id) => activeIds.has(id));

  if (targetIds.length === 0) {
    return { assignmentId: null, memberCount: 0, failures: [] };
  }

  const memberDays: Record<string, ProgramDayRef[]> = {};
  const failures: string[] = [];

  // Materialize per-member templates with bounded concurrency.
  for (const batch of chunk(targetIds, MEMBER_CHUNK_SIZE)) {
    const results = await Promise.allSettled(
      batch.map(async (memberId) => {
        const dayRefs: ProgramDayRef[] = [];
        for (const day of input.days) {
          // Fresh id per member per day — template ids are PKs owned by each
          // trainee; reusing the same id across members would collide/overwrite.
          const template: WorkoutTemplate = { ...day.template, id: crypto.randomUUID() };
          const { error } = await upsertClientTemplate(memberId, template);
          if (error) throw new Error(error);
          dayRefs.push({ templateId: template.id, name: day.name });
        }
        return { memberId, dayRefs };
      })
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const memberId = batch[i];
      if (!memberId) continue;
      if (result && result.status === 'fulfilled') {
        memberDays[result.value.memberId] = result.value.dayRefs;
      } else {
        failures.push(memberId);
        if (result && result.status === 'rejected') {
          logger.db.error('assignProgramToGroup member failed', result.reason);
        }
      }
    }
  }

  // No member's templates landed — don't create an empty assignment row.
  const successfulIds = Object.keys(memberDays);
  if (successfulIds.length === 0) {
    return { assignmentId: null, memberCount: targetIds.length, failures };
  }

  const assignment = await createAssignment({
    kind: 'program',
    groupId: input.groupId,
    title: programName,
    payload: { programName, perMember: true, memberDays },
  });

  // Best-effort push per successful member so the program lands with app closed.
  for (const memberId of successfulIds) {
    void sendCoachPush(memberId, GROUP_PROGRAM_PUSH_TITLE, programName, '/my-coach');
  }

  return { assignmentId: assignment.id, memberCount: targetIds.length, failures };
};

/**
 * Resolve the program days a given trainee should start for an assignment.
 * Group programs carry a per-member map (payload.memberDays); a direct program
 * carries a flat payload.days. Returns the member's own list, falling back to
 * the flat list, then to an empty array — so MyCoach can render uniformly.
 */
export const resolveProgramDays = (assignment: Assignment, myUserId: string): ProgramDayRef[] => {
  const payload = assignment.payload ?? {};
  const memberDays = payload.memberDays;
  if (memberDays && typeof memberDays === 'object') {
    const mine = (memberDays as Record<string, unknown>)[myUserId];
    if (Array.isArray(mine)) return mine.filter(isProgramDayRef);
  }
  if (Array.isArray(payload.days)) return payload.days.filter(isProgramDayRef);
  return [];
};

/** Narrow an unknown payload entry to a runnable program day ref. */
const isProgramDayRef = (value: unknown): value is ProgramDayRef =>
  value !== null &&
  typeof value === 'object' &&
  typeof (value as Record<string, unknown>).templateId === 'string' &&
  typeof (value as Record<string, unknown>).name === 'string';

/** Assignments authored by the current coach (optionally for one client). */
export const listCoachAssignments = async (clientId?: string): Promise<Assignment[]> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return [];
  let query = supabase
    .from('assignments')
    .select(
      'id, coach_id, client_id, group_id, kind, title, payload, template_id, schedule, status, created_at, updated_at'
    )
    .eq('coach_id', user.id);
  if (clientId) query = query.eq('client_id', clientId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    logger.db.error('listCoachAssignments failed', error);
    return [];
  }
  return (data ?? []).map(toAssignment);
};

/** The current trainee's inbox — direct + group assignments (RLS-scoped). */
export const listMyAssignments = async (): Promise<Assignment[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('assignments')
    .select(
      'id, coach_id, client_id, group_id, kind, title, payload, template_id, schedule, status, created_at, updated_at'
    )
    .eq('status', 'active')
    .order('created_at', { ascending: false });
  if (error) {
    logger.db.error('listMyAssignments failed', error);
    return [];
  }
  return (data ?? []).map(toAssignment);
};

export const archiveAssignment = async (id: string): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const { error } = await supabase.from('assignments').update({ status: 'archived' }).eq('id', id);
  return { error: error?.message ?? null };
};

// ============================================================================
// COACH PLATFORM — Assignment service (recommendations / "send things")
// ============================================================================
// A single assignment row targets either one client OR a group. Group targets
// fan out for free via RLS (is_group_member), so a group announcement/program
// is one row seen by every member — no per-member duplication.

import type { Assignment, AssignmentKind } from '../../types/coach';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { requireClient, toAssignment } from './mappers';

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
  return toAssignment(data);
};

/** Assignments authored by the current coach (optionally for one client). */
export const listCoachAssignments = async (clientId?: string): Promise<Assignment[]> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return [];
  let query = supabase.from('assignments').select('*').eq('coach_id', user.id);
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
    .select('*')
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

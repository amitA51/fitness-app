// ============================================================================
// COACH PLATFORM — audit log service
// ============================================================================
// Records coach actions on client data for accountability. Online-only.

import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { requireClient } from './mappers';

export interface AuditEntry {
  id: string;
  actorId: string;
  subjectUserId: string;
  tableName: string;
  action: string;
  rowId: string | null;
  createdAt?: string;
}

type Row = Record<string, unknown>;

const toAuditEntry = (r: Row): AuditEntry => ({
  id: r.id as string,
  actorId: r.actor_id as string,
  subjectUserId: r.subject_user_id as string,
  tableName: r.table_name as string,
  action: r.action as string,
  rowId: (r.row_id as string | null) ?? null,
  createdAt: r.created_at as string | undefined,
});

/** Best-effort write of an audit entry (actor_id = current user). */
export const writeAudit = async ({
  subjectUserId,
  tableName,
  action,
  rowId,
}: {
  subjectUserId: string;
  tableName: string;
  action: string;
  rowId?: string | null;
}): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' };
  const { error } = await supabase.from('audit_log').insert({
    actor_id: user.id,
    subject_user_id: subjectUserId,
    table_name: tableName,
    action,
    row_id: rowId ?? null,
  });
  if (error) logger.db.error('writeAudit failed', error);
  return { error: error?.message ?? null };
};

/** List audit entries for a subject user, ordered newest first. */
export const listAudit = async (subjectUserId: string, limit = 50): Promise<AuditEntry[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('subject_user_id', subjectUserId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    logger.db.error('listAudit failed', error);
    // Throw so the audit box shows its error state, not a fake "no actions".
    throw new Error(error.message);
  }
  return (data ?? []).map(toAuditEntry);
};

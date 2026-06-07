// ============================================================================
// COACH PLATFORM — Program template library service
// ============================================================================
// CRUD for `coach_program_templates`. Coach-only (RLS enforced server-side).
// Follows the same online-only / requireClient() contract as all other coach
// services: offline callers receive graceful empty results or thrown errors.

import type { CoachProgramTemplate, ProgramTemplateDay } from '../../types/coach';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { requireClient } from './mappers';
import { toProgramTemplate } from './mappers';

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

/**
 * Return all program templates owned by the current coach, newest first.
 * Returns [] when Supabase is unreachable (CoachOfflineError propagates as []).
 */
export const listProgramTemplates = async (): Promise<CoachProgramTemplate[]> => {
  let db: ReturnType<typeof requireClient>;
  try {
    db = requireClient();
  } catch {
    return [];
  }

  const { data, error } = await db
    .from('coach_program_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.db.error('listProgramTemplates failed', error);
    return [];
  }

  return (data ?? []).map(toProgramTemplate);
};

// ---------------------------------------------------------------------------
// Save (insert)
// ---------------------------------------------------------------------------

/**
 * Insert a new program template for the current coach.
 * Throws a plain Error with a user-visible message when:
 *   - name is empty / whitespace-only
 *   - days array is empty
 *   - Supabase is unreachable
 *   - the current user cannot be resolved
 */
export const saveProgramTemplate = async (input: {
  name: string;
  description?: string;
  days: ProgramTemplateDay[];
}): Promise<CoachProgramTemplate> => {
  if (!input.name.trim()) {
    throw new Error('שם התוכנית לא יכול להיות ריק');
  }
  if (!input.days.length) {
    throw new Error('התוכנית חייבת לכלול לפחות יום אחד');
  }

  const db = requireClient();
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('unauthenticated');
  }

  const { data, error } = await db
    .from('coach_program_templates')
    .insert({
      coach_id: user.id,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      days: input.days,
    })
    .select()
    .single();

  if (error) {
    logger.db.error('saveProgramTemplate failed', error);
    throw new Error(error.message);
  }

  return toProgramTemplate(data as Record<string, unknown>);
};

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete a program template by id.
 * Returns `{ error: null }` on success or `{ error: <message> }` on failure.
 */
export const deleteProgramTemplate = async (id: string): Promise<{ error: string | null }> => {
  let db: ReturnType<typeof requireClient>;
  try {
    db = requireClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'offline' };
  }

  const { error } = await db.from('coach_program_templates').delete().eq('id', id);

  if (error) {
    logger.db.error('deleteProgramTemplate failed', error);
    return { error: error.message };
  }

  return { error: null };
};

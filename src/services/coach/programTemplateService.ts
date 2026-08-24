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
 * Throws when Supabase is unreachable or the read fails, so CoachPrograms
 * renders its error state with a retry — never a misleading empty library.
 */
export const listProgramTemplates = async (): Promise<CoachProgramTemplate[]> => {
  let db: ReturnType<typeof requireClient>;
  try {
    db = requireClient();
  } catch (err) {
    // Re-throw offline as a real error: a failed read must reach the UI's
    // error state, not render as "no programs yet" (a coach reads an empty
    // library as "my work vanished").
    throw err instanceof Error ? err : new Error(String(err));
  }

  const { data, error } = await db
    .from('coach_program_templates')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    logger.db.error('listProgramTemplates failed', error);
    throw new Error(error.message);
  }

  return (data ?? []).map(toProgramTemplate);
};

// ---------------------------------------------------------------------------
// Save (insert / update-in-place)
// ---------------------------------------------------------------------------

/**
 * Save a program template for the current coach. Without `id` this inserts a
 * new row; with `id` it upserts that row in place — re-saving a template the
 * coach loaded into the builder must NOT mint a duplicate with the same name.
 * Throws a plain Error with a user-visible message when:
 *   - name is empty / whitespace-only
 *   - days array is empty
 *   - Supabase is unreachable
 *   - the current user cannot be resolved
 */
export const saveProgramTemplate = async (input: {
  /** Existing template id to update in place; omit to insert a new template. */
  id?: string;
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

  const row = {
    coach_id: user.id,
    name: input.name.trim(),
    description: input.description?.trim() ?? null,
    days: input.days,
  };

  // Upsert by id when re-saving a loaded template (RLS scopes both paths to
  // the owning coach); plain insert otherwise.
  const query = input.id
    ? db
        .from('coach_program_templates')
        .upsert({ ...row, id: input.id, updated_at: new Date().toISOString() })
    : db.from('coach_program_templates').insert(row);

  const { data, error } = await query.select().single();

  if (error) {
    // Keep the raw Supabase message in the log only — never leak an English DB
    // string into the Hebrew UI.
    logger.db.error('saveProgramTemplate failed', error);
    throw new Error('שמירת התבנית נכשלה');
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

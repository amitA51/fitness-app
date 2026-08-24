/**
 * Workout Template Database Service
 *
 * CRUD operations for workout templates, plus cloud merge/replace helpers.
 */

import { NotFoundError, ValidationError } from '../errors';
import type { Exercise, PersonalItem, WorkoutTemplate } from '../types';
import { createWorkoutSet } from '../types';
import { generateId } from '../utils/id';
import { safeTimestamp } from './cloudMerge';
import { STORES, dbDelete, dbGet, dbGetAll, dbPut, initDB } from './indexedDBCore';
import { addPersonalItem } from './personalItemsDb';
import { getCurrentUser } from './supabaseAuth';
import { syncWorkoutTemplate } from './supabaseSync';
import { syncWithRetry } from './syncEngine';

/**
 * True when a template carries a soft-delete tombstone (deletedAt set).
 * `WorkoutTemplate` does not declare `deletedAt` in its canonical type, but the
 * cloud mappers attach it at runtime, so we narrow structurally here.
 */
const isTombstoned = (record: unknown): boolean =>
  Boolean((record as { deletedAt?: string | null }).deletedAt);

/**
 * Gets all workout templates (excludes soft-deleted tombstones).
 */
export const getWorkoutTemplates = async (): Promise<WorkoutTemplate[]> => {
  const templates = await dbGetAll<WorkoutTemplate>(STORES.WORKOUT_TEMPLATES);
  // Exclude tombstoned templates and app-managed hidden program-day templates
  // (the latter are still reachable by id via getWorkoutTemplate for the runner).
  return (templates || []).filter((t) => !isTombstoned(t) && !t.isProgramHidden);
};

/**
 * Gets a single workout template by ID.
 */
export const getWorkoutTemplate = (id: string): Promise<WorkoutTemplate | null> => {
  if (!id) throw new ValidationError('Template ID is required.');
  return dbGet<WorkoutTemplate>(STORES.WORKOUT_TEMPLATES, id).then((res) => res || null);
};

/**
 * Total number of template rows in the store, INCLUDING tombstones and
 * app-managed program-day templates. Used by the first-run seeding check:
 * any prior content (even hidden or deleted rows) means the user already has
 * history and must not receive the starter set.
 */
export const getWorkoutTemplateCount = async (): Promise<number> => {
  const all = await dbGetAll<WorkoutTemplate>(STORES.WORKOUT_TEMPLATES);
  return (all || []).length;
};

/**
 * Free-plan template quota — RETIRED (2026-08, migration 20260824000000).
 *
 * The trigger `trg_enforce_free_template_quota` was dropped: nothing is
 * purchasable yet (`billing_not_configured`), so the cap only produced silent
 * data loss — local write succeeded, the cloud rejected with P0001, and the
 * mutation dead-lettered with no user-visible error. It also broke coach
 * program-day splits written into a trainee's library. Re-introduce a quota
 * only when billing ships, server-authoritative, with grandfathering.
 */

/** Legacy guard name kept so existing imports keep compiling. */
export class FreeTemplateLimitError extends Error {
  constructor() {
    super('free_template_limit_reached');
    this.name = 'FreeTemplateLimitError';
  }
}

/** True when the DB rejected a write because of a (historical) quota trigger. */
export const isFreeTemplateLimitError = (err: unknown): boolean => {
  if (err instanceof FreeTemplateLimitError) return true;
  const message = err instanceof Error ? err.message : String(err ?? '');
  return message.includes('free_template_limit_reached');
};

/**
 * Creates a new workout template.
 */
export const createWorkoutTemplate = async (
  templateData: Omit<WorkoutTemplate, 'id' | 'createdAt'>
): Promise<WorkoutTemplate> => {
  if (!templateData.name?.trim()) {
    throw new ValidationError('Template name is required.');
  }

  const newTemplate: WorkoutTemplate = {
    id: crypto.randomUUID?.() || generateId('tmpl'),
    createdAt: new Date().toISOString(),
    ...templateData,
    updatedAt: new Date().toISOString(),
  };

  await dbPut(STORES.WORKOUT_TEMPLATES, newTemplate);

  const user = await getCurrentUser();
  if (user) {
    const userId = user.id;
    syncWithRetry(
      () => syncWorkoutTemplate(userId, newTemplate),
      `createWorkoutTemplate:${newTemplate.id}`,
      3,
      { type: 'template:update', payload: newTemplate }
    );
  }

  return newTemplate;
};

/**
 * Updates an existing workout template.
 */
export const updateWorkoutTemplate = async (
  id: string,
  updates: Partial<WorkoutTemplate>
): Promise<WorkoutTemplate> => {
  const template = await dbGet<WorkoutTemplate>(STORES.WORKOUT_TEMPLATES, id);
  if (!template) throw new NotFoundError('WorkoutTemplate', id);

  const updatedTemplate = {
    ...template,
    ...updates,
    id: template.id,
    updatedAt: new Date().toISOString(),
  };
  await dbPut(STORES.WORKOUT_TEMPLATES, updatedTemplate);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(
      () => syncWorkoutTemplate(user.id, updatedTemplate),
      `updateWorkoutTemplate:${id}`,
      3,
      { type: 'template:update', payload: updatedTemplate }
    );
  }

  return updatedTemplate;
};

/**
 * Deletes a workout template (soft-delete for cloud propagation).
 */
export const deleteWorkoutTemplate = async (id: string): Promise<void> => {
  if (!id) throw new ValidationError('Template ID is required for deletion.');
  const now = new Date().toISOString();
  await dbDelete(STORES.WORKOUT_TEMPLATES, id);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(
      () =>
        syncWorkoutTemplate(user.id, {
          id,
          name: '',
          exercises: [],
          deletedAt: now,
          updatedAt: now,
        }),
      `deleteWorkoutTemplate:${id}`,
      3,
      { type: 'template:delete', payload: id }
    );
  }
};

/**
 * Loads a workout template into a new workout item.
 */
export const loadWorkoutFromTemplate = async (templateId: string): Promise<PersonalItem> => {
  const template = await getWorkoutTemplate(templateId);
  if (!template) throw new NotFoundError('WorkoutTemplate', templateId);

  const exercises: Exercise[] = template.exercises.map((ex) => ({
    id: generateId('active-ex'),
    exerciseId: ex.exerciseId || ex.id,
    exerciseName: ex.exerciseName,
    name: ex.exerciseName,
    targetMuscle: ex.targetMuscle,
    muscleGroup: ex.muscleGroup,
    tempo: ex.tempo,
    targetRestTime: ex.targetRestTime ?? ex.restSeconds,
    notes: ex.notes,
    // Carry rich program metadata (RPE target, intensity technique, substitutions,
    // coaching notes) into the active workout so the runner can surface it.
    programExtras: ex.programExtras,
    sets: (ex.sets ?? []).map((s) => createWorkoutSet({ reps: s.reps, weight: s.weight })),
  }));

  const newWorkout: Omit<PersonalItem, 'id' | 'createdAt' | 'updatedAt'> = {
    type: 'workout',
    title: template.name,
    content: template.description || '',
    exercises,
    workoutTemplateId: templateId,
    workoutStartTime: new Date().toISOString(),
    isActiveWorkout: true,
  };

  return addPersonalItem(newWorkout);
};

/**
 * Re-add workout template from cloud (no cloud sync trigger).
 */
export const reAddWorkoutTemplate = (template: WorkoutTemplate): Promise<void> =>
  dbPut(STORES.WORKOUT_TEMPLATES, template);

/**
 * Replace all workout templates with cloud data.
 */
export const replaceWorkoutTemplatesFromCloud = async (
  templates: WorkoutTemplate[]
): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.WORKOUT_TEMPLATES, 'readwrite');
    const store = tx.objectStore(STORES.WORKOUT_TEMPLATES);
    store.clear();
    for (const template of templates) {
      store.put(template);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
};

/**
 * Merge workout templates from cloud - keeps the most recent version of each record.
 * Unlike replace, this preserves local-only records and resolves conflicts by updatedAt timestamp.
 *
 * Tombstone-aware (mirrors mergeGenericRecords in cloudMerge.ts): a cloud row
 * whose `deletedAt` is set removes the local row and is skipped; otherwise
 * last-writer-wins by `updatedAt` (falling back to `createdAt`). All writes and
 * deletes are applied in a single readwrite IndexedDB transaction so the merge
 * is atomic — it fully succeeds or leaves local data untouched.
 */
export const mergeWorkoutTemplatesFromCloud = async (
  cloudTemplates: WorkoutTemplate[]
): Promise<{ added: number; updated: number; kept: number; deleted: number }> => {
  const localTemplates = await dbGetAll<WorkoutTemplate>(STORES.WORKOUT_TEMPLATES);
  const localMap = new Map(localTemplates.map((t) => [t.id, t]));

  let added = 0;
  let updated = 0;
  let kept = 0;
  let deleted = 0;

  const writes: WorkoutTemplate[] = [];
  const deletes: string[] = [];

  for (const cloud of cloudTemplates) {
    if (!cloud.id) continue; // skip records without a usable key

    // If cloud row is tombstoned, remove it locally and skip.
    if (isTombstoned(cloud)) {
      if (localMap.has(cloud.id)) {
        deletes.push(cloud.id);
        deleted++;
      }
      continue;
    }

    const local = localMap.get(cloud.id);
    if (!local) {
      writes.push(cloud);
      added++;
    } else {
      const localTime = safeTimestamp(local.updatedAt) || safeTimestamp(local.createdAt);
      const cloudTime = safeTimestamp(cloud.updatedAt) || safeTimestamp(cloud.createdAt);
      if (cloudTime > localTime || (cloudTime > 0 && localTime === 0)) {
        writes.push(cloud);
        updated++;
      } else {
        kept++;
      }
    }
  }

  // Atomic transaction — all writes and deletes succeed or none do.
  if (writes.length > 0 || deletes.length > 0) {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.WORKOUT_TEMPLATES, 'readwrite');
      const store = tx.objectStore(STORES.WORKOUT_TEMPLATES);
      for (const template of writes) {
        store.put(template);
      }
      for (const id of deletes) {
        store.delete(id);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Merge transaction aborted'));
    });
  }

  return { added, updated, kept, deleted };
};

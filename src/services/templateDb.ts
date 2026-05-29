/**
 * Workout Template Database Service
 *
 * CRUD operations for workout templates, plus cloud merge/replace helpers.
 */

import { LOCAL_STORAGE_KEYS as LS } from '../constants';
import { NotFoundError, ValidationError } from '../errors';
import type { Exercise, PersonalItem, WorkoutTemplate } from '../types';
import { createWorkoutSet } from '../types';
import { STORES, dbDelete, dbGet, dbGetAll, dbPut, initDB, syncWithRetry } from './indexedDBCore';
import { addPersonalItem } from './personalItemsDb';
import { getCurrentUser } from './supabaseAuth';
import { deleteCloudWorkoutTemplate, syncWorkoutTemplate } from './supabaseSync';

/**
 * Gets all workout templates.
 */
export const getWorkoutTemplates = async (): Promise<WorkoutTemplate[]> => {
  const templates = await dbGetAll<WorkoutTemplate>(LS.WORKOUT_TEMPLATES);
  return templates || [];
};

/**
 * Gets a single workout template by ID.
 */
export const getWorkoutTemplate = (id: string): Promise<WorkoutTemplate | null> => {
  if (!id) throw new ValidationError('Template ID is required.');
  return dbGet<WorkoutTemplate>(LS.WORKOUT_TEMPLATES, id).then((res) => res || null);
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
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...templateData,
    updatedAt: new Date().toISOString(),
  };

  await dbPut(LS.WORKOUT_TEMPLATES, newTemplate);

  const user = await getCurrentUser();
  if (user) {
    const userId = user.id;
    syncWithRetry(
      () => syncWorkoutTemplate(userId, newTemplate),
      `createWorkoutTemplate:${newTemplate.id}`
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
  const template = await dbGet<WorkoutTemplate>(LS.WORKOUT_TEMPLATES, id);
  if (!template) throw new NotFoundError('WorkoutTemplate', id);

  const updatedTemplate = {
    ...template,
    ...updates,
    id: template.id,
    updatedAt: new Date().toISOString(),
  };
  await dbPut(LS.WORKOUT_TEMPLATES, updatedTemplate);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(
      () => syncWorkoutTemplate(user.id, updatedTemplate),
      `updateWorkoutTemplate:${id}`
    );
  }

  return updatedTemplate;
};

/**
 * Deletes a workout template.
 */
export const deleteWorkoutTemplate = async (id: string): Promise<void> => {
  if (!id) throw new ValidationError('Template ID is required for deletion.');
  await dbDelete(LS.WORKOUT_TEMPLATES, id);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(() => deleteCloudWorkoutTemplate(user.id, id), `deleteWorkoutTemplate:${id}`);
  }
};

/**
 * Loads a workout template into a new workout item.
 */
export const loadWorkoutFromTemplate = async (templateId: string): Promise<PersonalItem> => {
  const template = await getWorkoutTemplate(templateId);
  if (!template) throw new NotFoundError('WorkoutTemplate', templateId);

  const exercises: Exercise[] = template.exercises.map((ex) => ({
    id: ex.id,
    name: ex.exerciseName,
    targetMuscle: ex.targetMuscle,
    muscleGroup: ex.muscleGroup,
    tempo: ex.tempo,
    targetRestTime: ex.targetRestTime ?? ex.restSeconds,
    notes: ex.notes,
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
  dbPut(LS.WORKOUT_TEMPLATES, template);

/**
 * Replace all workout templates with cloud data.
 */
export const replaceWorkoutTemplatesFromCloud = async (
  templates: WorkoutTemplate[]
): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LS.WORKOUT_TEMPLATES, 'readwrite');
    const store = tx.objectStore(LS.WORKOUT_TEMPLATES);
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
 */
export const mergeWorkoutTemplatesFromCloud = async (
  cloudTemplates: WorkoutTemplate[]
): Promise<{ added: number; updated: number; kept: number }> => {
  const localTemplates = await dbGetAll<WorkoutTemplate>(STORES.WORKOUT_TEMPLATES);
  const localMap = new Map(localTemplates.map((t) => [t.id, t]));

  let added = 0;
  let updated = 0;
  let kept = 0;

  for (const cloud of cloudTemplates) {
    const local = localMap.get(cloud.id);
    if (!local) {
      // New from cloud - add it
      await dbPut(STORES.WORKOUT_TEMPLATES, cloud);
      added++;
    } else {
      // Both exist - keep the newer one
      const localTime = new Date(local.updatedAt || local.createdAt).getTime();
      const cloudTime = new Date(cloud.updatedAt || cloud.createdAt || '').getTime();
      if (cloudTime > localTime) {
        await dbPut(STORES.WORKOUT_TEMPLATES, cloud);
        updated++;
      } else {
        kept++;
      }
    }
  }

  return { added, updated, kept };
};

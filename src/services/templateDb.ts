/**
 * Workout Template Database Service
 *
 * CRUD operations for workout templates, plus cloud merge/replace helpers.
 */

import { NotFoundError, ValidationError } from '../errors';
import { isSupabaseConfigured } from '../lib/supabase';
import type { Exercise, PersonalItem, WorkoutTemplate } from '../types';
import { createWorkoutSet } from '../types';
import { generateId } from '../utils/id';
import { safeTimestamp } from './cloudMerge';
import { STORES, dbDelete, dbGet, dbGetAll, dbPut, initDB } from './indexedDBCore';
import { queueMutation } from './offlineQueue';
import { addPersonalItem } from './personalItemsDb';
import { clearUnsyncedRecordMarker, markRecordUnsynced } from './sessionDb';
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

  // No cloud configured means nothing to sync to and nothing at risk — mirrors
  // syncWithRetry, which returns early in that case rather than queueing.
  if (isSupabaseConfigured()) {
    // Ledger FIRST (services/sessionDb). From here until the cloud confirms,
    // this template exists in exactly one place; recording that is what lets the
    // sign-out guard and the offline indicator see it at all — including if the
    // tab is closed while the request is still in flight.
    await markRecordUnsynced(STORES.WORKOUT_TEMPLATES, newTemplate.id);

    if (user) {
      const userId = user.id;
      void syncWithRetry(
        () => syncWorkoutTemplate(userId, newTemplate),
        `createWorkoutTemplate:${newTemplate.id}`,
        3,
        { type: 'template:update', payload: newTemplate }
      ).then((synced) => {
        if (synced) void clearUnsyncedRecordMarker(STORES.WORKOUT_TEMPLATES, newTemplate.id);
      });
    } else {
      // THE FIX (T-118, same shape as sessionDb.saveWorkoutSession and
      // waterService.addWaterEntry). This enqueue used to live inside the
      // `if (user)` above, and getCurrentUser() returns null not only for a guest
      // but for a signed-in user whose token refresh just failed with a 401
      // (services/supabaseAuth models that path). In this codebase the enqueue IS
      // syncWithRetry's 4th argument, so a guarded call that never runs leaves NO
      // queue row at all — the template existed only on this device, every
      // defence keys off the queue and could not see it, and the sign-out wipe
      // destroyed authored content the user cannot regenerate.
      //
      // queueMutation resolves and stamps ownership itself (real account id, or
      // GUEST_OWNER / UNKNOWN_OWNER), so no user id is needed from here. An
      // ownerless entry is quarantined into the dead-letter store on replay
      // (claimable from Settings) and re-stamped by adoptGuestDataForUser on a
      // first sign-in. Either way it is inside the machinery, not invisible to it.
      await queueMutation('template:update', newTemplate);
    }
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

  if (isSupabaseConfigured()) {
    await markRecordUnsynced(STORES.WORKOUT_TEMPLATES, updatedTemplate.id);

    if (user) {
      const userId = user.id;
      void syncWithRetry(
        () => syncWorkoutTemplate(userId, updatedTemplate),
        `updateWorkoutTemplate:${id}`,
        3,
        { type: 'template:update', payload: updatedTemplate }
      ).then((synced) => {
        if (synced) void clearUnsyncedRecordMarker(STORES.WORKOUT_TEMPLATES, updatedTemplate.id);
      });
    } else {
      // Same hole as the create path: an EDIT made while auth could not answer
      // was written locally with nothing scheduled to push it, so the next cloud
      // pull silently reverted it to the older cloud revision.
      await queueMutation('template:update', updatedTemplate);
    }
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
  // The local row is gone, so it is no longer a template that can be lost.
  await clearUnsyncedRecordMarker(STORES.WORKOUT_TEMPLATES, id);

  const user = await getCurrentUser();

  if (isSupabaseConfigured()) {
    if (user) {
      const userId = user.id;
      void syncWithRetry(
        () =>
          syncWorkoutTemplate(userId, {
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
    } else {
      // A DELETE needs a tombstone QUEUED, not a skipped call. The local row is
      // hard-deleted above regardless of auth, while the cloud tombstone sat
      // inside the guard — so with a null user the deletion existed nowhere but
      // this device and the next pull RESURRECTED the template the user deleted.
      //
      // `template:delete` replays through deleteCloudWorkoutTemplate, which
      // stamps `deleted_at` (a soft delete — see supabaseSync), so the queued
      // form propagates the deletion exactly like the direct call above.
      await queueMutation('template:delete', id);
    }
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
  await new Promise<void>((resolve, reject) => {
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

  // Same reasoning as the merge: these rows came FROM the cloud, so they are not
  // unsynced local work any more.
  for (const template of templates) {
    if (template.id) await clearUnsyncedRecordMarker(STORES.WORKOUT_TEMPLATES, template.id);
  }
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
  /** Ids the cloud demonstrably holds at or ahead of our revision. */
  const confirmed: string[] = [];

  for (const cloud of cloudTemplates) {
    if (!cloud.id) continue; // skip records without a usable key

    // If cloud row is tombstoned, remove it locally and skip.
    if (isTombstoned(cloud)) {
      if (localMap.has(cloud.id)) {
        deletes.push(cloud.id);
        deleted++;
      }
      confirmed.push(cloud.id);
      continue;
    }

    const local = localMap.get(cloud.id);
    if (!local) {
      writes.push(cloud);
      confirmed.push(cloud.id);
      added++;
    } else {
      const localTime = safeTimestamp(local.updatedAt) || safeTimestamp(local.createdAt);
      const cloudTime = safeTimestamp(cloud.updatedAt) || safeTimestamp(cloud.createdAt);
      if (cloudTime > localTime || (cloudTime > 0 && localTime === 0)) {
        writes.push(cloud);
        confirmed.push(cloud.id);
        updated++;
      } else {
        // The cloud holds this id at the SAME revision, so it demonstrably has a
        // copy of the local row — stop counting it as unsynced local work. A
        // cloud copy that is OLDER keeps its marker: a template is mutable, so a
        // newer local edit really can still be unpushed. (Sessions clear only the
        // rows they write for the same reason; water clears every reported id
        // because a water entry is an immutable amount.)
        if (cloudTime > 0 && cloudTime === localTime) confirmed.push(cloud.id);
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

  // A row the cloud reported at or ahead of our revision demonstrably has a
  // cloud copy, so its ledger marker is no longer real risk. Leaving it would
  // make the sign-out warning fire forever for a template that is safely stored.
  for (const templateId of confirmed) {
    await clearUnsyncedRecordMarker(STORES.WORKOUT_TEMPLATES, templateId);
  }

  return { added, updated, kept, deleted };
};

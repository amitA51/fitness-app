/**
 * Body Weight Database Service
 *
 * CRUD operations for body-weight entries, plus cloud merge/replace helpers.
 */

import { LOCAL_STORAGE_KEYS as LS } from '../constants';
import { ValidationError } from '../errors';
import type { BodyWeightEntry } from '../types';
import { mergeGenericRecords } from './cloudMerge';
import { STORES, dbDelete, dbGetAll, dbPut, initDB, syncWithRetry } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import { deleteCloudBodyWeight, syncBodyWeight } from './supabaseSync';

/**
 * Save a body weight entry.
 */
export const saveBodyWeight = async (entry: BodyWeightEntry): Promise<void> => {
  await dbPut(LS.BODY_WEIGHT, entry);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(() => syncBodyWeight(user.id, entry), `saveBodyWeight:${entry.id}`, 3, {
      type: 'bodyweight:create',
      payload: entry,
    });
  }
};

/**
 * Get body weight history, sorted by date (newest first).
 */
export const getBodyWeightHistory = async (): Promise<BodyWeightEntry[]> => {
  const entries = await dbGetAll<BodyWeightEntry>(LS.BODY_WEIGHT);
  return entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

/**
 * Get the latest body weight.
 */
export const getLatestBodyWeight = async (): Promise<number | null> => {
  const history = await getBodyWeightHistory();
  return history.length > 0 && history[0] ? history[0].weight : null;
};

/**
 * Re-add body weight entry from cloud (no cloud sync trigger).
 */
export const reAddBodyWeight = (entry: BodyWeightEntry): Promise<void> =>
  dbPut(LS.BODY_WEIGHT, entry);

/**
 * Replace all body weight entries with cloud data.
 */
export const replaceBodyWeightFromCloud = async (entries: BodyWeightEntry[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LS.BODY_WEIGHT, 'readwrite');
    const store = tx.objectStore(LS.BODY_WEIGHT);
    store.clear();
    for (const entry of entries) {
      store.put(entry);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
};

/**
 * Delete a body weight entry by ID.
 */
export const deleteBodyWeight = async (id: string): Promise<void> => {
  if (!id) throw new ValidationError('Body weight ID is required for deletion.');
  await dbDelete(LS.BODY_WEIGHT, id);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(() => deleteCloudBodyWeight(user.id, id), `deleteBodyWeight:${id}`, 3, {
      type: 'bodyweight:delete',
      payload: id,
    });
  }
};

export const mergeBodyWeightFromCloud = (
  entries: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.BODY_WEIGHT, entries);

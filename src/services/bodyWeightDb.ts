/**
 * Body Weight Database Service
 *
 * Thin compatibility layer — delegates CRUD to bodyStatsService (canonical),
 * retains cloud merge/replace helpers used by supabaseSync.
 */

import type { BodyWeightEntry } from '../types';
import {
  addBodyWeight,
  deleteBodyWeight as deleteBodyWeightCanonical,
  getBodyWeightsByDateRange,
  getLatestWeight,
} from './bodyStatsService';
import { mergeGenericRecords } from './cloudMerge';
import { STORES, dbPut, initDB } from './indexedDBCore';

/**
 * Save a body weight entry (delegates to bodyStatsService.addBodyWeight).
 */
export const saveBodyWeight = async (entry: BodyWeightEntry): Promise<void> => {
  await addBodyWeight({ date: entry.date, weight: entry.weight, notes: entry.notes });
};

/**
 * Get body weight history, sorted by date (newest first).
 */
export const getBodyWeightHistory = async (): Promise<BodyWeightEntry[]> => {
  const entries = await getBodyWeightsByDateRange('0000-01-01', '9999-12-31');
  return entries
    .map((e) => ({
      id: e.id,
      date: e.date,
      weight: e.weight,
      notes: e.notes,
      createdAt: e.createdAt,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
};

/**
 * Get the latest body weight.
 */
export const getLatestBodyWeight = async (): Promise<number | null> => {
  const entry = await getLatestWeight();
  return entry?.weight ?? null;
};

/**
 * Re-add body weight entry from cloud (no cloud sync trigger).
 */
export const reAddBodyWeight = (entry: BodyWeightEntry): Promise<void> =>
  dbPut(STORES.BODY_WEIGHT, entry);

/**
 * Replace all body weight entries with cloud data.
 */
export const replaceBodyWeightFromCloud = async (entries: BodyWeightEntry[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES.BODY_WEIGHT, 'readwrite');
    const store = tx.objectStore(STORES.BODY_WEIGHT);
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
  await deleteBodyWeightCanonical(id);
};

export const mergeBodyWeightFromCloud = (
  entries: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.BODY_WEIGHT, entries);

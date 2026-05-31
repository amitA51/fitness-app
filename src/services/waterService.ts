import { supabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/supabase';
import { todayStr } from '../utils/dateUtils';
import { STORES, dbGetAll, dbPut, initDB } from './indexedDBCore';
import { queueMutation } from './offlineQueue';
import { getCurrentUser } from './supabaseAuth';

export interface WaterEntry {
  id: string;
  date: string; // YYYY-MM-DD
  amountMl: number;
  createdAt: string;
  // Soft-delete tombstone. Set when the entry is deleted so the deletion
  // propagates to other devices on pull (matching how sessions are handled).
  deletedAt?: string | null;
}

const WATER_GOAL_ML = 2500;
const GLASS_ML = 250;

export function getWaterGoal(): number {
  return WATER_GOAL_ML;
}

export function getGlassSize(): number {
  return GLASS_ML;
}

export async function addWaterEntry(amountMl: number): Promise<WaterEntry> {
  const entry: WaterEntry = {
    id: crypto.randomUUID(),
    date: todayStr(),
    amountMl,
    createdAt: new Date().toISOString(),
  };
  await dbPut(STORES.WATER_LOGS, entry);

  const user = await getCurrentUser();
  if (user) {
    try {
      await syncWaterEntryToCloud(user.id, entry);
    } catch {
      await queueMutation('water:create', entry);
    }
  }

  return entry;
}

export async function getTodayWaterTotal(): Promise<number> {
  const today = todayStr();
  const all = await dbGetAll<WaterEntry>(STORES.WATER_LOGS);
  return all
    .filter((e) => e.date === today && !e.deletedAt)
    .reduce((sum, e) => sum + e.amountMl, 0);
}

export async function getTodayWaterEntries(): Promise<WaterEntry[]> {
  const today = todayStr();
  const all = await dbGetAll<WaterEntry>(STORES.WATER_LOGS);
  return all
    .filter((e) => e.date === today && !e.deletedAt)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getWaterByDateRange(
  startDate: string,
  endDate: string
): Promise<WaterEntry[]> {
  const all = await dbGetAll<WaterEntry>(STORES.WATER_LOGS);
  return all.filter((e) => e.date >= startDate && e.date <= endDate && !e.deletedAt);
}

export async function syncWaterEntryToCloud(userId: string, entry: WaterEntry): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase.from('water_logs').upsert(
    {
      id: entry.id,
      user_id: userId,
      date: entry.date,
      amount_ml: entry.amountMl,
      created_at: entry.createdAt,
      deleted_at: entry.deletedAt ?? null,
    },
    { onConflict: 'id' }
  );
  if (error) {
    throw new Error(`water sync failed: ${error.message}`);
  }
}

/**
 * Soft-delete a water entry in the cloud by stamping `deleted_at`, rather than
 * hard-deleting the row. This lets the deletion propagate to other devices on
 * pull through the tombstone-aware merge (matching how sessions are handled);
 * a hard delete would simply be re-inserted by an insert-only merge.
 */
export async function deleteCloudWaterEntry(userId: string, id: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase
    .from('water_logs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId);
  if (error) {
    throw new Error(`water delete failed: ${error.message}`);
  }
}

export async function fetchWaterLogs(userId: string): Promise<WaterEntry[]> {
  if (!isSupabaseConfigured() || !supabase) return [];
  const { data, error } = await supabase
    .from('water_logs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  // Distinguish a fetch error from a legitimately empty result: throw so the
  // puller marks the pull as failed instead of silently treating it as empty.
  if (error) {
    throw new Error(`fetch water_logs failed: ${error.message}`);
  }
  return (data || []).map((row) => ({
    id: row.id,
    date: row.date,
    amountMl: row.amount_ml,
    createdAt: row.created_at,
    deletedAt: row.deleted_at ?? null,
  }));
}

/**
 * Merge water logs from cloud. Tombstone-aware (mirrors the session merge):
 * a cloud row with `deleted_at` removes the local row; otherwise rows missing
 * locally are inserted. Existing non-deleted rows are left untouched (water
 * entries are immutable amounts with no `updatedAt` to reconcile). All writes
 * and deletes run in a single readwrite transaction so the merge is atomic.
 */
export async function mergeWaterLogsFromCloud(cloudEntries: WaterEntry[]): Promise<void> {
  const local = await dbGetAll<WaterEntry>(STORES.WATER_LOGS);
  const localMap = new Map(local.map((e) => [e.id, e]));

  const writes: WaterEntry[] = [];
  const deletes: string[] = [];

  for (const cloud of cloudEntries) {
    if (!cloud.id) continue;
    if (cloud.deletedAt) {
      if (localMap.has(cloud.id)) deletes.push(cloud.id);
      continue;
    }
    if (!localMap.has(cloud.id)) {
      writes.push(cloud);
    }
  }

  if (writes.length === 0 && deletes.length === 0) return;

  const db = await initDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.WATER_LOGS, 'readwrite');
    const store = tx.objectStore(STORES.WATER_LOGS);
    for (const entry of writes) {
      store.put(entry);
    }
    for (const id of deletes) {
      store.delete(id);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Water merge transaction aborted'));
  });
}

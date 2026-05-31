import { supabase } from '../lib/supabase';
import { isSupabaseConfigured } from '../lib/supabase';
import { todayStr } from '../utils/dateUtils';
import { STORES, dbGetAll, dbPut } from './indexedDBCore';
import { queueMutation } from './offlineQueue';
import { getCurrentUser } from './supabaseAuth';

export interface WaterEntry {
  id: string;
  date: string; // YYYY-MM-DD
  amountMl: number;
  createdAt: string;
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
  return all.filter((e) => e.date === today).reduce((sum, e) => sum + e.amountMl, 0);
}

export async function getTodayWaterEntries(): Promise<WaterEntry[]> {
  const today = todayStr();
  const all = await dbGetAll<WaterEntry>(STORES.WATER_LOGS);
  return all.filter((e) => e.date === today).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getWaterByDateRange(
  startDate: string,
  endDate: string
): Promise<WaterEntry[]> {
  const all = await dbGetAll<WaterEntry>(STORES.WATER_LOGS);
  return all.filter((e) => e.date >= startDate && e.date <= endDate);
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
    },
    { onConflict: 'id' }
  );
  if (error) {
    throw new Error(`water sync failed: ${error.message}`);
  }
}

export async function deleteCloudWaterEntry(userId: string, id: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;
  const { error } = await supabase.from('water_logs').delete().eq('id', id).eq('user_id', userId);
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
  if (error) return [];
  return (data || []).map((row) => ({
    id: row.id,
    date: row.date,
    amountMl: row.amount_ml,
    createdAt: row.created_at,
  }));
}

export async function mergeWaterLogsFromCloud(cloudEntries: WaterEntry[]): Promise<void> {
  const local = await dbGetAll<WaterEntry>(STORES.WATER_LOGS);
  const localMap = new Map(local.map((e) => [e.id, e]));
  for (const cloud of cloudEntries) {
    if (!localMap.has(cloud.id)) {
      await dbPut(STORES.WATER_LOGS, cloud);
    }
  }
}

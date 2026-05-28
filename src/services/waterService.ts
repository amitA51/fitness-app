import { supabase } from '../lib/supabase';
import { todayStr } from '../utils/dateUtils';
import { generateId } from '../utils/id';
import { STORES, dbGetAll, dbPut } from './indexedDBCore';
import { syncWithRetry } from './indexedDBCore';
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
    id: generateId('water', 5),
    date: todayStr(),
    amountMl,
    createdAt: new Date().toISOString(),
  };
  await dbPut(STORES.WATER_LOGS, entry);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(() => syncWaterEntry(user.id, entry), `addWaterEntry:${entry.id}`);
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

async function syncWaterEntry(userId: string, entry: WaterEntry): Promise<void> {
  if (!supabase) return; // sync disabled when Supabase is not configured
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
    // Throw so syncWithRetry can re-queue with backoff
    throw new Error(`water sync failed: ${error.message}`);
  }
}

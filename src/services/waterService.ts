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

function todayStr(): string {
  return new Date().toISOString().split('T')[0] ?? '';
}

function generateId(): string {
  return `water-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function getWaterGoal(): number {
  return WATER_GOAL_ML;
}

export function getGlassSize(): number {
  return GLASS_ML;
}

export async function addWaterEntry(amountMl: number): Promise<WaterEntry> {
  const entry: WaterEntry = {
    id: generateId(),
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

async function syncWaterEntry(_userId: string, _entry: WaterEntry): Promise<void> {
  // Placeholder — water log sync can be added to supabaseSync.ts when the cloud table is created
}

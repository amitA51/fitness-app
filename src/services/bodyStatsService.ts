import { dbGetAll, dbPut, dbDelete, STORES } from './indexedDBCore';

const BODY_MEASUREMENTS_STORE = 'body_measurements';

export interface BodyWeightEntry {
  id: string;
  date: string;
  weight: number;
  notes?: string;
  createdAt: string;
}

export interface BodyMeasurement {
  id: string;
  date: string;
  chest?: number;
  waist?: number;
  hips?: number;
  arms?: number;
  thighs?: number;
  neck?: number;
  bodyFat?: number;
  notes?: string;
  createdAt: string;
}

export interface RecoveryLog {
  id: string;
  date: string;
  sleepHours: number;
  sleepQuality: 1 | 2 | 3 | 4 | 5;
  muscleSoreness: number;
  energyLevel: number;
  stressLevel: number;
  tightnessAreas: string[];
  notes?: string;
  createdAt: string;
}

export interface RecoveryScore {
  score: number;
  sleepScore: number;
  sorenessScore: number;
  energyScore: number;
  stressScore: number;
  label: 'מעולה' | 'טובה' | 'בינונית' | 'חלשה' | 'גרועה';
  color: string;
}

export interface WeightTrend {
  change: number;
  changePercent: number;
  direction: 'עלייה' | 'ירידה' | 'יציב';
  weeklyAvg: number;
  dataPoints: number;
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function addBodyWeight(entry: Omit<BodyWeightEntry, 'id' | 'createdAt'>): Promise<BodyWeightEntry> {
  const newEntry: BodyWeightEntry = { ...entry, id: generateId('bw'), createdAt: new Date().toISOString() };
  await dbPut(STORES.BODY_WEIGHT, newEntry);
  return newEntry;
}

export async function updateBodyWeight(entry: BodyWeightEntry): Promise<void> {
  await dbPut(STORES.BODY_WEIGHT, entry);
}

export async function deleteBodyWeight(id: string): Promise<void> {
  await dbDelete(STORES.BODY_WEIGHT, id);
}

export async function getBodyWeightsByDateRange(startDate: string, endDate: string): Promise<BodyWeightEntry[]> {
  const all = await dbGetAll<BodyWeightEntry>(STORES.BODY_WEIGHT);
  return all.filter((e) => e.date >= startDate && e.date <= endDate).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getLatestWeight(): Promise<BodyWeightEntry | null> {
  const all = await dbGetAll<BodyWeightEntry>(STORES.BODY_WEIGHT);
  if (all.length === 0) return null;
  return all.sort((a, b) => b.date.localeCompare(a.date))[0];
}

export function calculateWeightTrend(entries: BodyWeightEntry[]): WeightTrend {
  if (entries.length < 2) return { change: 0, changePercent: 0, direction: 'יציב', weeklyAvg: entries[0]?.weight || 0, dataPoints: entries.length };
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1].weight;
  const earliest = sorted[0].weight;
  const change = Math.round((latest - earliest) * 10) / 10;
  const changePercent = earliest === 0 ? 0 : Math.round((change / earliest) * 1000) / 10;
  const weeklyAvg = Math.round((sorted.reduce((s, e) => s + e.weight, 0) / sorted.length) * 10) / 10;
  const direction: WeightTrend['direction'] = Math.abs(change) < 0.3 ? 'יציב' : change > 0 ? 'עלייה' : 'ירידה';
  return { change, changePercent, direction, weeklyAvg, dataPoints: entries.length };
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  if (heightM <= 0) return 0;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'תת משקל', color: '#3b82f6' };
  if (bmi < 25) return { label: 'משקל תקין', color: '#22c55e' };
  if (bmi < 30) return { label: 'עודף משקל', color: '#f59e0b' };
  return { label: 'השמנה', color: '#ef4444' };
}

export async function addBodyMeasurement(entry: Omit<BodyMeasurement, 'id' | 'createdAt'>): Promise<BodyMeasurement> {
  await getOrCreateMeasurementsStore();
  const newEntry: BodyMeasurement = { ...entry, id: generateId('bm'), createdAt: new Date().toISOString() };
  await dbPut(BODY_MEASUREMENTS_STORE, newEntry);
  return newEntry;
}

export async function getBodyMeasurementsByDateRange(startDate: string, endDate: string): Promise<BodyMeasurement[]> {
  const all = await dbGetAll<BodyMeasurement>(BODY_MEASUREMENTS_STORE);
  return all.filter((e) => e.date >= startDate && e.date <= endDate).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getLatestMeasurement(): Promise<BodyMeasurement | null> {
  const all = await dbGetAll<BodyMeasurement>(BODY_MEASUREMENTS_STORE);
  if (all.length === 0) return null;
  return all.sort((a, b) => b.date.localeCompare(a.date))[0];
}

async function getOrCreateMeasurementsStore(): Promise<void> {
  try {
    await dbGetAll(BODY_MEASUREMENTS_STORE);
  } catch {
    const request = indexedDB.open('sparkos-fitness-db');
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(BODY_MEASUREMENTS_STORE)) {
        db.close();
        const version = db.version + 1;
        const upgradeRequest = indexedDB.open('sparkos-fitness-db', version);
        upgradeRequest.onupgradeneeded = (event) => {
          const upgradedDb = (event.target as IDBOpenDBRequest).result;
          if (!upgradedDb.objectStoreNames.contains(BODY_MEASUREMENTS_STORE)) {
            upgradedDb.createObjectStore(BODY_MEASUREMENTS_STORE, { keyPath: 'id' });
          }
        };
      }
    };
  }
}

export async function addRecoveryLog(entry: Omit<RecoveryLog, 'id' | 'createdAt'>): Promise<RecoveryLog> {
  const newEntry: RecoveryLog = { ...entry, id: generateId('rec'), createdAt: new Date().toISOString() };
  await dbPut(STORES.RECOVERY_LOGS, newEntry);
  return newEntry;
}

export async function updateRecoveryLog(entry: RecoveryLog): Promise<void> {
  await dbPut(STORES.RECOVERY_LOGS, entry);
}

export async function deleteRecoveryLog(id: string): Promise<void> {
  await dbDelete(STORES.RECOVERY_LOGS, id);
}

export async function getRecoveryLogsByDateRange(startDate: string, endDate: string): Promise<RecoveryLog[]> {
  const all = await dbGetAll<RecoveryLog>(STORES.RECOVERY_LOGS);
  return all.filter((e) => e.date >= startDate && e.date <= endDate).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getTodayRecoveryLog(): Promise<RecoveryLog | null> {
  const today = new Date().toISOString().split('T')[0];
  const all = await dbGetAll<RecoveryLog>(STORES.RECOVERY_LOGS);
  return all.find((e) => e.date === today) || null;
}

export function calculateRecoveryScore(log: RecoveryLog): RecoveryScore {
  const sleepScore = Math.min((log.sleepHours / 8) * 25, 25) * (log.sleepQuality / 5);
  const sorenessScore = Math.max(0, (10 - log.muscleSoreness) / 10) * 25;
  const energyScore = (log.energyLevel / 10) * 25;
  const stressScore = Math.max(0, (10 - log.stressLevel) / 10) * 25;
  const score = Math.round(sleepScore + sorenessScore + energyScore + stressScore);

  let label: RecoveryScore['label'];
  let color: string;
  if (score >= 85) { label = 'מעולה'; color = '#22c55e'; }
  else if (score >= 65) { label = 'טובה'; color = '#3b82f6'; }
  else if (score >= 45) { label = 'בינונית'; color = '#f59e0b'; }
  else if (score >= 25) { label = 'חלשה'; color = '#f97316'; }
  else { label = 'גרועה'; color = '#ef4444'; }

  return {
    score,
    sleepScore: Math.round(sleepScore),
    sorenessScore: Math.round(sorenessScore),
    energyScore: Math.round(energyScore),
    stressScore: Math.round(stressScore),
    label,
    color,
  };
}

export async function getWeeklyRecoveryAverage(): Promise<{ avgSleep: number; avgEnergy: number; avgSoreness: number; avgStress: number; avgScore: number }> {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const logs = await getRecoveryLogsByDateRange(weekAgo.toISOString().split('T')[0], today.toISOString().split('T')[0]);

  if (logs.length === 0) return { avgSleep: 0, avgEnergy: 0, avgSoreness: 0, avgStress: 0, avgScore: 0 };

  const avgSleep = Math.round((logs.reduce((s, l) => s + l.sleepHours, 0) / logs.length) * 10) / 10;
  const avgEnergy = Math.round((logs.reduce((s, l) => s + l.energyLevel, 0) / logs.length) * 10) / 10;
  const avgSoreness = Math.round((logs.reduce((s, l) => s + l.muscleSoreness, 0) / logs.length) * 10) / 10;
  const avgStress = Math.round((logs.reduce((s, l) => s + l.stressLevel, 0) / logs.length) * 10) / 10;
  const avgScore = Math.round(logs.reduce((s, l) => s + calculateRecoveryScore(l).score, 0) / logs.length);

  return { avgSleep, avgEnergy, avgSoreness, avgStress, avgScore };
}

export const TIGHTNESS_AREAS = [
  'צוואר', 'כתפיים', 'גב עליון', 'גב תחתון', 'חזה', 'זרועות',
  'אמות', 'בטן', 'ירכיים קדמיות', 'ירכיים אחוריות', 'תאומים', 'עקבים',
];
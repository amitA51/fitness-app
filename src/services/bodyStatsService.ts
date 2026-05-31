import { ValidationError } from '../errors';
import { generateId } from '../utils/id';
import { STORES, dbDelete, dbGetAll, dbPut } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import { syncBodyMeasurement, syncBodyWeight, syncRecoveryLog } from './supabaseSync';
import { syncWithRetry } from './syncEngine';

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
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp

  // Sleep
  sleepHours: number;
  sleepQuality: 1 | 2 | 3 | 4 | 5; // 1=terrible, 5=great

  // Body
  sorenessLevel: 1 | 2 | 3 | 4 | 5; // 1=very sore, 5=fresh
  energyLevel: 1 | 2 | 3 | 4 | 5; // 1=exhausted, 5=energized
  stressLevel: 1 | 2 | 3 | 4 | 5; // 1=very stressed, 5=calm

  // Tightness
  tightAreas: string[]; // body part names

  // Optional
  notes?: string;
  sessionId?: string; // reference to workout session

  // Computed
  overallScore?: number; // 0-100, computed from components
}

export interface RecoveryScore {
  overall: number; // 0-100
  sleep: number; // 0-100
  soreness: number; // 0-100
  energy: number; // 0-100
  stress: number; // 0-100
  label: 'poor' | 'fair' | 'good' | 'excellent';
}

// Legacy alias for backwards compatibility
export type LegacyRecoveryScore = RecoveryScore & {
  score: number;
  sleepScore: number;
  sorenessScore: number;
  energyScore: number;
  stressScore: number;
};

export interface WeightTrend {
  change: number;
  changePercent: number;
  direction: 'עלייה' | 'ירידה' | 'יציב';
  weeklyAvg: number;
  dataPoints: number;
}

export async function addBodyWeight(
  entry: Omit<BodyWeightEntry, 'id' | 'createdAt'>
): Promise<BodyWeightEntry> {
  if (entry.weight <= 0 || entry.weight >= 700) {
    throw new ValidationError('Body weight must be greater than 0 and less than 700 kg.');
  }

  const newEntry: BodyWeightEntry = {
    ...entry,
    id: generateId('bw'),
    createdAt: new Date().toISOString(),
  };
  await dbPut(STORES.BODY_WEIGHT, newEntry);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(() => syncBodyWeight(user.id, newEntry), `addBodyWeight:${newEntry.id}`, 3, {
      type: 'bodyweight:create',
      payload: newEntry,
    });
  }

  // Notify TDEE-aware consumers (Settings / Nutrition) that latest weight has changed.
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('BODY_WEIGHT_UPDATED', {
          detail: { weight: newEntry.weight, date: newEntry.date },
        })
      );
    }
  } catch {
    // CustomEvent not supported — ignore
  }

  return newEntry;
}

export async function updateBodyWeight(entry: BodyWeightEntry): Promise<void> {
  await dbPut(STORES.BODY_WEIGHT, entry);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(() => syncBodyWeight(user.id, entry), `updateBodyWeight:${entry.id}`, 3, {
      type: 'bodyweight:create',
      payload: entry,
    });
  }
}

export async function deleteBodyWeight(id: string): Promise<void> {
  await dbDelete(STORES.BODY_WEIGHT, id);

  const user = await getCurrentUser();
  if (user) {
    const now = new Date().toISOString();
    syncWithRetry(
      () => syncBodyWeight(user.id, { id, weight: 0, date: '', deletedAt: now, updatedAt: now }),
      `deleteBodyWeight:${id}`,
      3,
      { type: 'bodyweight:delete', payload: id }
    );
  }
}

export async function getBodyWeightsByDateRange(
  startDate: string,
  endDate: string
): Promise<BodyWeightEntry[]> {
  const all = await dbGetAll<BodyWeightEntry>(STORES.BODY_WEIGHT);
  return all
    .filter((e) => e.date >= startDate && e.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getLatestWeight(): Promise<BodyWeightEntry | null> {
  const all = await dbGetAll<BodyWeightEntry>(STORES.BODY_WEIGHT);
  if (all.length === 0) return null;
  return all.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

export function calculateWeightTrend(entries: BodyWeightEntry[]): WeightTrend {
  if (entries.length < 2)
    return {
      change: 0,
      changePercent: 0,
      direction: 'יציב',
      weeklyAvg: entries[0]?.weight || 0,
      dataPoints: entries.length,
    };
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const latest = sorted[sorted.length - 1]?.weight ?? 0;
  const earliest = sorted[0]?.weight ?? 0;
  const change = Math.round((latest - earliest) * 10) / 10;
  const changePercent = earliest === 0 ? 0 : Math.round((change / earliest) * 1000) / 10;
  const weeklyAvg =
    Math.round((sorted.reduce((s, e) => s + e.weight, 0) / sorted.length) * 10) / 10;
  const direction: WeightTrend['direction'] =
    Math.abs(change) < 0.3 ? 'יציב' : change > 0 ? 'עלייה' : 'ירידה';
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

export async function addBodyMeasurement(
  entry: Omit<BodyMeasurement, 'id' | 'createdAt'>
): Promise<BodyMeasurement> {
  const newEntry: BodyMeasurement = {
    ...entry,
    id: generateId('bm'),
    createdAt: new Date().toISOString(),
  };
  await dbPut(BODY_MEASUREMENTS_STORE, newEntry);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(
      () =>
        syncBodyMeasurement(user.id, {
          id: newEntry.id,
          date: newEntry.date,
          measurements: {
            chest: newEntry.chest,
            waist: newEntry.waist,
            hips: newEntry.hips,
            arms: newEntry.arms,
            thighs: newEntry.thighs,
            neck: newEntry.neck,
            bodyFat: newEntry.bodyFat,
          },
          notes: newEntry.notes,
          createdAt: newEntry.createdAt,
        }),
      `addBodyMeasurement:${newEntry.id}`,
      3,
      { type: 'measurement:create', payload: newEntry }
    );
  }

  return newEntry;
}

export async function getBodyMeasurementsByDateRange(
  startDate: string,
  endDate: string
): Promise<BodyMeasurement[]> {
  const all = await dbGetAll<BodyMeasurement>(BODY_MEASUREMENTS_STORE);
  return all
    .filter((e) => e.date >= startDate && e.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getLatestMeasurement(): Promise<BodyMeasurement | null> {
  const all = await dbGetAll<BodyMeasurement>(BODY_MEASUREMENTS_STORE);
  if (all.length === 0) return null;
  return all.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

export async function addRecoveryLog(
  entry: Omit<RecoveryLog, 'id' | 'createdAt'>
): Promise<RecoveryLog> {
  const existingForDate = (await dbGetAll<RecoveryLog>(STORES.RECOVERY_LOGS))
    .filter((log) => log.date === entry.date)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const canonicalLog = existingForDate[0];
  const score = calculateRecoveryScore({
    ...entry,
    id: canonicalLog?.id ?? '',
    createdAt: canonicalLog?.createdAt ?? '',
  });

  const newEntry: RecoveryLog = {
    ...entry,
    id: canonicalLog?.id ?? generateId('rec'),
    createdAt: canonicalLog?.createdAt ?? new Date().toISOString(),
    overallScore: score.overall,
  };
  await dbPut(STORES.RECOVERY_LOGS, newEntry);

  const duplicateLogs = existingForDate.slice(1);
  await Promise.all(duplicateLogs.map((log) => dbDelete(STORES.RECOVERY_LOGS, log.id)));

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(
      () =>
        syncRecoveryLog(user.id, {
          id: newEntry.id,
          date: newEntry.date,
          sleepHours: newEntry.sleepHours,
          sleepQuality: newEntry.sleepQuality,
          sorenessLevel: newEntry.sorenessLevel,
          energyLevel: newEntry.energyLevel,
          stressLevel: newEntry.stressLevel,
          tightAreas: newEntry.tightAreas,
          overallScore: newEntry.overallScore,
          sessionId: newEntry.sessionId,
          notes: newEntry.notes,
          createdAt: newEntry.createdAt,
        }),
      `addRecoveryLog:${newEntry.id}`
    );
    duplicateLogs.forEach((log) => {
      const now = new Date().toISOString();
      syncWithRetry(
        () => syncRecoveryLog(user.id, { id: log.id, date: '', deletedAt: now, updatedAt: now }),
        `deleteRecoveryLog:${log.id}`
      );
    });
  }

  return newEntry;
}

export async function updateRecoveryLog(entry: RecoveryLog): Promise<void> {
  await dbPut(STORES.RECOVERY_LOGS, entry);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(
      () =>
        syncRecoveryLog(user.id, {
          id: entry.id,
          date: entry.date,
          sleepHours: entry.sleepHours,
          sleepQuality: entry.sleepQuality,
          sorenessLevel: entry.sorenessLevel,
          energyLevel: entry.energyLevel,
          stressLevel: entry.stressLevel,
          tightAreas: entry.tightAreas,
          overallScore: entry.overallScore,
          sessionId: entry.sessionId,
          notes: entry.notes,
          createdAt: entry.createdAt,
        }),
      `updateRecoveryLog:${entry.id}`
    );
  }
}

export async function deleteRecoveryLog(id: string): Promise<void> {
  await dbDelete(STORES.RECOVERY_LOGS, id);

  const user = await getCurrentUser();
  if (user) {
    const now = new Date().toISOString();
    syncWithRetry(
      () => syncRecoveryLog(user.id, { id, date: '', deletedAt: now, updatedAt: now }),
      `deleteRecoveryLog:${id}`
    );
  }
}

export async function getRecoveryLogsByDateRange(
  startDate: string,
  endDate: string
): Promise<RecoveryLog[]> {
  const all = await dbGetAll<RecoveryLog>(STORES.RECOVERY_LOGS);
  return all
    .filter((e) => e.date >= startDate && e.date <= endDate)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getTodayRecoveryLog(now = new Date()): Promise<RecoveryLog | null> {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const all = await dbGetAll<RecoveryLog>(STORES.RECOVERY_LOGS);
  return (
    all
      .filter((entry) => entry.date === today)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

function mapSleepHoursToScore(hours: number): number {
  if (hours <= 5) return 20;
  if (hours <= 6) return 20 + (hours - 5) * 20;
  if (hours <= 7) return 40 + (hours - 6) * 20;
  if (hours <= 8) return 60 + (hours - 7) * 20;
  if (hours <= 9) return 80 + (hours - 8) * 20;
  return 100;
}

function getScoreLabel(score: number): RecoveryScore['label'] {
  if (score <= 25) return 'poor';
  if (score <= 50) return 'fair';
  if (score <= 75) return 'good';
  return 'excellent';
}

function getScoreColor(overall: number): string {
  if (overall <= 25) return '#ef4444';
  if (overall <= 50) return '#f97316';
  if (overall <= 75) return '#f59e0b';
  return '#22c55e';
}

export function calculateRecoveryScore(log: RecoveryLog): RecoveryScore {
  const rawSleepScore = mapSleepHoursToScore(log.sleepHours);
  const sleep = Math.round(rawSleepScore * (log.sleepQuality / 5));
  const soreness = log.sorenessLevel * 20;
  const energy = log.energyLevel * 20;
  const stress = log.stressLevel * 20;

  const overall = Math.round(sleep * 0.3 + soreness * 0.25 + energy * 0.25 + stress * 0.2);

  return {
    overall,
    sleep,
    soreness,
    energy,
    stress,
    label: getScoreLabel(overall),
  };
}

// Backwards compatibility: returns score with color property
export function getLegacyRecoveryScore(log: RecoveryLog): {
  score: number;
  sleepScore: number;
  sorenessScore: number;
  energyScore: number;
  stressScore: number;
  label: string;
  color: string;
} {
  const result = calculateRecoveryScore(log);
  const labelMap: Record<RecoveryScore['label'], string> = {
    poor: 'גרועה',
    fair: 'חלשה',
    good: 'בינונית',
    excellent: 'טובה',
  };
  return {
    score: result.overall,
    sleepScore: result.sleep,
    sorenessScore: result.soreness,
    energyScore: result.energy,
    stressScore: result.stress,
    label: labelMap[result.label],
    color: getScoreColor(result.overall),
  };
}

export async function getWeeklyRecoveryAverage(): Promise<{
  avgSleep: number;
  avgEnergy: number;
  avgSoreness: number;
  avgStress: number;
  avgScore: number;
}> {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const formatLocal = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const logs = await getRecoveryLogsByDateRange(formatLocal(weekAgo), formatLocal(today));

  if (logs.length === 0)
    return { avgSleep: 0, avgEnergy: 0, avgSoreness: 0, avgStress: 0, avgScore: 0 };

  const avgSleep = Math.round((logs.reduce((s, l) => s + l.sleepHours, 0) / logs.length) * 10) / 10;
  const avgEnergy =
    Math.round((logs.reduce((s, l) => s + l.energyLevel, 0) / logs.length) * 10) / 10;
  const avgSoreness =
    Math.round((logs.reduce((s, l) => s + l.sorenessLevel, 0) / logs.length) * 10) / 10;
  const avgStress =
    Math.round((logs.reduce((s, l) => s + l.stressLevel, 0) / logs.length) * 10) / 10;
  const avgScore = Math.round(
    logs.reduce((s, l) => s + calculateRecoveryScore(l).overall, 0) / logs.length
  );

  return { avgSleep, avgEnergy, avgSoreness, avgStress, avgScore };
}

export const BODY_AREAS: string[] = [
  'צוואר',
  'כתפיים',
  'גב עליון',
  'גב תחתון',
  'חזה',
  'ביצפס',
  'טריצפס',
  'אמות',
  'בטן',
  'מפרקי ירך',
  'שרירי ארבע ראשי',
  'ירך אחורית',
  'תאומים',
  'אכילס',
];

// Alias for backwards compatibility
export const TIGHTNESS_AREAS = BODY_AREAS;

import { ValidationError } from '../errors';
import { generateId } from '../utils/id';
import { STORES, dbDelete, dbGetAll, dbGetByRange, dbPut } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import {
  deleteCloudBodyWeight,
  deleteCloudRecoveryLog,
  syncBodyMeasurement,
  syncBodyWeight,
  syncRecoveryLog,
} from './supabaseSync';
import { syncWithRetry } from './syncEngine';

const BODY_MEASUREMENTS_STORE = 'body_measurements';

export interface BodyWeightEntry {
  id: string;
  date: string;
  weight: number;
  notes?: string;
  createdAt: string;
  /** Bumped on every edit so last-writer-wins doesn't collapse to createdAt. */
  updatedAt?: string;
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
  /** Bumped on every edit so last-writer-wins doesn't collapse to createdAt. */
  updatedAt?: string;
}

export interface RecoveryLog {
  id: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp
  /** Bumped on every edit so last-writer-wins doesn't collapse to createdAt. */
  updatedAt?: string;

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

  const now = new Date().toISOString();
  const newEntry: BodyWeightEntry = {
    ...entry,
    // UUID — cloud body_weight.id is uuid; PostgREST rejects `bw-...` (22P02).
    id: crypto.randomUUID?.() || generateId('bw'),
    createdAt: now,
    updatedAt: now,
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
  // Stamp a fresh updatedAt so this edit beats the prior version under LWW
  // merge — without it the merge falls back to createdAt and the later edit
  // is silently discarded under two-device contention.
  const updated: BodyWeightEntry = { ...entry, updatedAt: new Date().toISOString() };
  await dbPut(STORES.BODY_WEIGHT, updated);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(() => syncBodyWeight(user.id, updated), `updateBodyWeight:${updated.id}`, 3, {
      type: 'bodyweight:create',
      payload: updated,
    });
  }
}

export async function deleteBodyWeight(id: string): Promise<void> {
  await dbDelete(STORES.BODY_WEIGHT, id);

  const user = await getCurrentUser();
  if (user) {
    // Targeted soft-delete UPDATE (house pattern) — the previous tombstone
    // upsert sent date: '' which Postgres rejected (22007), losing the delete.
    syncWithRetry(() => deleteCloudBodyWeight(user.id, id), `deleteBodyWeight:${id}`, 3, {
      type: 'bodyweight:delete',
      payload: id,
    });
  }
}

export async function getBodyWeightsByDateRange(
  startDate: string,
  endDate: string
): Promise<BodyWeightEntry[]> {
  return dbGetByRange<BodyWeightEntry>(STORES.BODY_WEIGHT, 'date', startDate, endDate);
}

export async function getLatestWeight(): Promise<BodyWeightEntry | null> {
  const all = await dbGetByRange<BodyWeightEntry>(
    STORES.BODY_WEIGHT,
    'date',
    '0000-01-01',
    '9999-12-31'
  );
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
  if (bmi < 25) return { label: 'משקל תקין', color: 'var(--color-success-fg)' };
  if (bmi < 30) return { label: 'עודף משקל', color: '#f59e0b' };
  return { label: 'השמנה', color: 'var(--color-error-fg)' };
}

export async function addBodyMeasurement(
  entry: Omit<BodyMeasurement, 'id' | 'createdAt'>
): Promise<BodyMeasurement> {
  const now = new Date().toISOString();
  const newEntry: BodyMeasurement = {
    ...entry,
    // UUID — cloud body_measurements.id is uuid (22P02 on prefixed ids).
    id: crypto.randomUUID?.() || generateId('bm'),
    createdAt: now,
    updatedAt: now,
  };
  await dbPut(BODY_MEASUREMENTS_STORE, newEntry);

  const user = await getCurrentUser();
  if (user) {
    // The queue replays the payload straight into syncBodyMeasurement, so the
    // descriptor must carry the mapper shape (nested `measurements`), not the
    // flat local entry — a flat payload replayed as `measurements: undefined`.
    const syncPayload = {
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
      updatedAt: newEntry.updatedAt,
    };
    syncWithRetry(
      () => syncBodyMeasurement(user.id, syncPayload),
      `addBodyMeasurement:${newEntry.id}`,
      3,
      { type: 'measurement:create', payload: syncPayload }
    );
  }

  return newEntry;
}

export async function getBodyMeasurementsByDateRange(
  startDate: string,
  endDate: string
): Promise<BodyMeasurement[]> {
  return dbGetByRange<BodyMeasurement>(BODY_MEASUREMENTS_STORE, 'date', startDate, endDate);
}

export async function getLatestMeasurement(): Promise<BodyMeasurement | null> {
  const all = await dbGetByRange<BodyMeasurement>(
    BODY_MEASUREMENTS_STORE,
    'date',
    '0000-01-01',
    '9999-12-31'
  );
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
    // UUID — cloud recovery_logs.id is uuid (22P02 on prefixed ids).
    id: canonicalLog?.id ?? (crypto.randomUUID?.() || generateId('rec')),
    createdAt: canonicalLog?.createdAt ?? new Date().toISOString(),
    // Re-logging the same day reuses the canonical id+createdAt, so a fresh
    // updatedAt is what lets the newer entry win LWW on another device.
    updatedAt: new Date().toISOString(),
    overallScore: score.overall,
  };
  await dbPut(STORES.RECOVERY_LOGS, newEntry);

  const duplicateLogs = existingForDate.slice(1);
  await Promise.all(duplicateLogs.map((log) => dbDelete(STORES.RECOVERY_LOGS, log.id)));

  const user = await getCurrentUser();
  if (user) {
    const syncPayload = {
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
      updatedAt: newEntry.updatedAt,
    };
    syncWithRetry(() => syncRecoveryLog(user.id, syncPayload), `addRecoveryLog:${newEntry.id}`, 3, {
      type: 'recovery:create',
      payload: syncPayload,
    });
    duplicateLogs.forEach((log) => {
      // Targeted soft-delete UPDATE (house pattern) — the previous tombstone
      // upsert sent date: '' which Postgres rejected (22007), losing the delete.
      syncWithRetry(
        () => deleteCloudRecoveryLog(user.id, log.id),
        `deleteRecoveryLog:${log.id}`,
        3,
        { type: 'recovery:delete', payload: log.id }
      );
    });
  }

  return newEntry;
}

export async function updateRecoveryLog(entry: RecoveryLog): Promise<void> {
  // Fresh updatedAt so the edit wins LWW instead of collapsing to createdAt.
  const updated: RecoveryLog = { ...entry, updatedAt: new Date().toISOString() };
  await dbPut(STORES.RECOVERY_LOGS, updated);

  const user = await getCurrentUser();
  if (user) {
    const syncPayload = {
      id: updated.id,
      date: updated.date,
      sleepHours: updated.sleepHours,
      sleepQuality: updated.sleepQuality,
      sorenessLevel: updated.sorenessLevel,
      energyLevel: updated.energyLevel,
      stressLevel: updated.stressLevel,
      tightAreas: updated.tightAreas,
      overallScore: updated.overallScore,
      sessionId: updated.sessionId,
      notes: updated.notes,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
    syncWithRetry(
      () => syncRecoveryLog(user.id, syncPayload),
      `updateRecoveryLog:${updated.id}`,
      3,
      { type: 'recovery:create', payload: syncPayload }
    );
  }
}

export async function deleteRecoveryLog(id: string): Promise<void> {
  await dbDelete(STORES.RECOVERY_LOGS, id);

  const user = await getCurrentUser();
  if (user) {
    // Targeted soft-delete UPDATE (house pattern) — the previous tombstone
    // upsert sent date: '' which Postgres rejected (22007), losing the delete.
    syncWithRetry(() => deleteCloudRecoveryLog(user.id, id), `deleteRecoveryLog:${id}`, 3, {
      type: 'recovery:delete',
      payload: id,
    });
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
  // Clamp to a sane window so garbage/typo input (e.g. 80h, negative from synced
  // data) can't silently produce a perfect or inverted sub-score (RN-4/RN-5).
  const h = Math.min(16, Math.max(0, Number.isFinite(hours) ? hours : 0));
  // Intentional floor of 20 (not 0): this is a sleep-QUALITY curve, where even
  // a short night leaves some baseline recovery. The composite can still reach
  // the 'poor' band because the Likert components (soreness/energy/stress) zero out.
  if (h <= 5) return 20;
  if (h <= 6) return 20 + (h - 5) * 20;
  if (h <= 7) return 40 + (h - 6) * 20;
  if (h <= 8) return 60 + (h - 7) * 20;
  if (h <= 9) return 80 + (h - 8) * 20;
  return 100;
}

function getScoreLabel(score: number): RecoveryScore['label'] {
  if (score <= 25) return 'poor';
  if (score <= 50) return 'fair';
  if (score <= 75) return 'good';
  return 'excellent';
}

function getScoreColor(overall: number): string {
  if (overall <= 25) return 'var(--color-error-fg)';
  if (overall <= 50) return '#f97316';
  if (overall <= 75) return '#f59e0b';
  return 'var(--color-success-fg)';
}

export function calculateRecoveryScore(log: RecoveryLog): RecoveryScore {
  // Likert 1-5 inputs map to a TRUE 0-100 scale ((level-1)/4*100) so the worst
  // day can actually reach the 'poor' band. Previously level*20 floored every
  // component at 20, so 'overall' never dropped below ~15 even though the
  // poor/fair/good/excellent labels were calibrated for a full 0-100 range (RN-1).
  // Inputs are clamped so out-of-range synced data can't push a component past
  // 100 or below 0 (RN-4).
  const clampLevel = (n: number): number => Math.min(5, Math.max(1, Number.isFinite(n) ? n : 1));
  const levelToScore = (level: number): number => ((clampLevel(level) - 1) / 4) * 100;

  const rawSleepScore = mapSleepHoursToScore(log.sleepHours);
  const sleep = Math.round(rawSleepScore * (clampLevel(log.sleepQuality) / 5));
  const soreness = levelToScore(log.sorenessLevel);
  const energy = levelToScore(log.energyLevel);
  const stress = levelToScore(log.stressLevel);

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

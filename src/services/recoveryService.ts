/**
 * Recovery Tracking Service
 * @deprecated This file is NOT imported anywhere in the app.
 * All recovery functionality lives in bodyStatsService.ts instead.
 * This file can be safely deleted.
 */

import { STORES, dbDelete, dbGetAll, dbGetByRange, dbPut, syncWithRetry } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import { deleteCloudRecoveryLog, syncRecoveryLog } from './supabaseSync';

// ============================================================================
// TYPES
// ============================================================================

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
  notes: string;
  sessionId?: string; // reference to workout session

  // Computed
  overallScore: number; // 0-100, computed from components
}

export interface RecoveryScore {
  overall: number; // 0-100
  sleep: number; // 0-100
  soreness: number; // 0-100
  energy: number; // 0-100
  stress: number; // 0-100
  label: 'poor' | 'fair' | 'good' | 'excellent';
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

// ============================================================================
// SCORE CALCULATION
// ============================================================================

function mapSleepHoursToScore(hours: number): number {
  // Linear interpolation between known anchor points:
  // 5h -> 20, 6h -> 40, 7h -> 60, 8h -> 80, 9h+ -> 100
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

export function calculateRecoveryScore(
  log: Omit<RecoveryLog, 'id' | 'overallScore' | 'createdAt'>
): RecoveryScore {
  // Sleep: hours mapped to 0-100, then multiplied by quality ratio (quality/5)
  const rawSleepScore = mapSleepHoursToScore(log.sleepHours);
  const sleep = Math.round(rawSleepScore * (log.sleepQuality / 5));

  // Soreness: level * 20 (5 = 100 = fresh, 1 = 20 = very sore)
  const soreness = log.sorenessLevel * 20;

  // Energy: level * 20
  const energy = log.energyLevel * 20;

  // Stress: level * 20 (5 = 100 = calm)
  const stress = log.stressLevel * 20;

  // Overall: weighted average
  // sleep 30%, soreness 25%, energy 25%, stress 20%
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

// ============================================================================
// CRUD OPERATIONS
// ============================================================================

export async function saveRecoveryLog(
  log: Omit<RecoveryLog, 'id' | 'overallScore' | 'createdAt'>
): Promise<RecoveryLog> {
  const score = calculateRecoveryScore(log);
  const now = new Date().toISOString();

  const recoveryLog: RecoveryLog = {
    ...log,
    id: 'recovery-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    overallScore: score.overall,
    createdAt: now,
  };

  await dbPut(STORES.RECOVERY_LOGS, recoveryLog);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(
      () =>
        syncRecoveryLog(user.id, {
          id: recoveryLog.id,
          date: recoveryLog.date,
          sleepHours: recoveryLog.sleepHours,
          sleepQuality: recoveryLog.sleepQuality,
          sorenessLevel: recoveryLog.sorenessLevel,
          energyLevel: recoveryLog.energyLevel,
          stressLevel: recoveryLog.stressLevel,
          tightAreas: recoveryLog.tightAreas,
          overallScore: recoveryLog.overallScore,
          sessionId: recoveryLog.sessionId,
          notes: recoveryLog.notes,
          createdAt: recoveryLog.createdAt,
        }),
      `saveRecoveryLog:${recoveryLog.id}`
    );
  }

  return recoveryLog;
}

export async function getRecoveryLogs(
  startDate?: string,
  endDate?: string
): Promise<RecoveryLog[]> {
  if (startDate && endDate) {
    const ranged = await dbGetByRange<RecoveryLog>(
      STORES.RECOVERY_LOGS,
      'date',
      startDate,
      endDate
    );
    return ranged.sort((a, b) => a.date.localeCompare(b.date));
  }

  const all = await dbGetAll<RecoveryLog>(STORES.RECOVERY_LOGS);
  return all.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getLatestRecoveryLog(): Promise<RecoveryLog | null> {
  const all = await dbGetAll<RecoveryLog>(STORES.RECOVERY_LOGS);
  if (all.length === 0) return null;

  const sorted = [...all].sort((a, b) => b.date.localeCompare(a.date));
  return sorted[0] ?? null;
}

export async function getRecoveryLogBySession(sessionId: string): Promise<RecoveryLog | null> {
  const all = await dbGetAll<RecoveryLog>(STORES.RECOVERY_LOGS);
  const match = all.find((log) => log.sessionId === sessionId);
  return match ?? null;
}

export async function deleteRecoveryLog(id: string): Promise<void> {
  await dbDelete(STORES.RECOVERY_LOGS, id);

  const user = await getCurrentUser();
  if (user) {
    syncWithRetry(() => deleteCloudRecoveryLog(user.id, id), `deleteRecoveryLog:${id}`);
  }
}

// ============================================================================
// ANALYTICS
// ============================================================================

export function getRecoveryTrend(logs: RecoveryLog[]): {
  averageScore: number;
  trend: 'improving' | 'declining' | 'stable';
} {
  if (logs.length === 0) {
    return { averageScore: 0, trend: 'stable' };
  }

  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  // Calculate overall average across all logs
  const averageScore = Math.round(
    sorted.reduce((sum, log) => sum + log.overallScore, 0) / sorted.length
  );

  if (sorted.length < 2) {
    return { averageScore, trend: 'stable' };
  }

  // Split into last 7 days and previous 7 days based on date
  const midIndex = Math.floor(sorted.length / 2);
  const recentLogs = sorted.slice(midIndex);
  const previousLogs = sorted.slice(0, midIndex);

  const recentAvg = recentLogs.reduce((sum, log) => sum + log.overallScore, 0) / recentLogs.length;

  const previousAvg =
    previousLogs.reduce((sum, log) => sum + log.overallScore, 0) / previousLogs.length;

  if (previousAvg === 0) {
    return { averageScore, trend: 'stable' };
  }

  const percentChange = ((recentAvg - previousAvg) / previousAvg) * 100;

  const trend: 'improving' | 'declining' | 'stable' =
    percentChange > 5 ? 'improving' : percentChange < -5 ? 'declining' : 'stable';

  return { averageScore, trend };
}

// ============================================================================
// QUICK RECOVERY QUESTIONS
// ============================================================================

export function getQuickRecoveryQuestions(): Array<{
  key: string;
  question: string;
  type: 'rating' | 'multiselect';
  options?: string[];
}> {
  return [
    {
      key: 'feeling',
      question: 'איך אתה מרגיש?',
      type: 'rating',
    },
    {
      key: 'tightAreas',
      question: 'היכן יש חולשה או התמתחות?',
      type: 'multiselect',
      options: BODY_AREAS,
    },
    {
      key: 'energy',
      question: 'מה רמת האנרגיה שלך?',
      type: 'rating',
    },
  ];
}

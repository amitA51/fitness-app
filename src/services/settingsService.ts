/**
 * Settings business-logic orchestration layer (AR-4).
 * Composes pure functions from utils/tdee and services/indexedDBCore
 * so the UI just calls settingsService without embedding logic.
 */
import type { WorkoutSession } from '../types';
import { logger } from '../utils/logger';
import { calculateTDEE, getMacroGoalsForGoal } from '../utils/tdee';
import { exportWorkoutHistoryCSV } from './exportService';
import { STORES, dbClear, dbGetAll } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import {
  deleteCloudAIConversation,
  deleteCloudBodyMeasurement,
  deleteCloudBodyWeight,
  deleteCloudNutritionLog,
  deleteCloudPersonalExercise,
  deleteCloudPersonalRecord,
  deleteCloudRecoveryLog,
  deleteCloudUserSetting,
  deleteCloudWorkoutSession,
  deleteCloudWorkoutTemplate,
  fetchAIConversations,
  fetchBodyMeasurements,
  fetchBodyWeight,
  fetchNutritionLogs,
  fetchPersonalExercises,
  fetchPersonalRecords,
  fetchRecoveryLogs,
  fetchUserSettings,
  fetchWorkoutSessions,
  fetchWorkoutTemplates,
} from './supabaseSync';
import { deleteCloudWaterEntry, fetchWaterLogs } from './waterService';

// ─── TDEE / Macro orchestration ─────────────────────────────────────────────

export interface ComputeMacrosInput {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: 'male' | 'female' | 'other';
  activityLevel: string;
  weightGoal: string;
}

export interface MacroResult {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function computeMacrosFromProfile(input: ComputeMacrosInput): MacroResult {
  const tdee = calculateTDEE(
    input.weightKg,
    input.heightCm,
    input.age,
    input.gender,
    input.activityLevel
  );
  return getMacroGoalsForGoal(tdee, input.weightGoal);
}

// ─── DB Clear orchestration ─────────────────────────────────────────────────

const SETTINGS_LOCALSTORAGE_KEYS = [
  'user_profile',
  'nutrition_goals',
  'workout_prefs',
  'last_sync_time',
] as const;

/**
 * Delete every cloud row owned by `userId` across all synced tables.
 *
 * "Delete all my data" must purge the cloud copy too — otherwise a signed-in
 * user's data silently re-downloads on the next sign-in (AuthContext auto-pulls)
 * and the privacy promise is broken. Each table is fetched then its rows are
 * deleted by id via the existing per-record cloud-delete helpers. Failures are
 * collected and rethrown so the caller can surface an error rather than report
 * a false success.
 */
async function deleteAllCloudData(userId: string): Promise<void> {
  const [
    templates,
    sessions,
    exercises,
    bodyWeight,
    bodyMeasurements,
    personalRecords,
    recoveryLogs,
    nutritionLogs,
    userSettings,
    aiConversations,
    waterLogs,
  ] = await Promise.all([
    fetchWorkoutTemplates(userId),
    fetchWorkoutSessions(userId),
    fetchPersonalExercises(userId),
    fetchBodyWeight(userId),
    fetchBodyMeasurements(userId),
    fetchPersonalRecords(userId),
    fetchRecoveryLogs(userId),
    fetchNutritionLogs(userId),
    fetchUserSettings(userId),
    fetchAIConversations(userId),
    fetchWaterLogs(userId),
  ]);

  const deletions: Promise<void>[] = [
    ...templates.map((r) => deleteCloudWorkoutTemplate(userId, r.id)),
    ...sessions.map((r) => deleteCloudWorkoutSession(userId, r.id)),
    ...exercises.map((r) => deleteCloudPersonalExercise(userId, r.id)),
    ...bodyWeight.map((r) => deleteCloudBodyWeight(userId, r.id)),
    ...bodyMeasurements.map((r) => deleteCloudBodyMeasurement(userId, r.id)),
    ...personalRecords.map((r) => deleteCloudPersonalRecord(userId, r.id)),
    ...recoveryLogs.map((r) => deleteCloudRecoveryLog(userId, r.id)),
    ...nutritionLogs.map((r) => deleteCloudNutritionLog(userId, r.id)),
    ...userSettings.map((r) => (r.id ? deleteCloudUserSetting(userId, r.id) : Promise.resolve())),
    ...aiConversations.map((r) => deleteCloudAIConversation(userId, r.id)),
    ...waterLogs.map((r) => deleteCloudWaterEntry(userId, r.id)),
  ];

  const results = await Promise.allSettled(deletions);
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    logger.app.error(`deleteAllCloudData: ${failed.length} cloud deletions failed`);
    throw new Error(`Failed to delete ${failed.length} cloud records`);
  }
}

export async function deleteAllUserData(): Promise<void> {
  // Purge the cloud copy first (while still authenticated) so the data cannot
  // silently re-sync on the next sign-in. If cloud deletion fails we abort
  // BEFORE wiping local data, so nothing is lost and the user can retry.
  const user = await getCurrentUser();
  if (user) {
    await deleteAllCloudData(user.id);
  }

  const allStores = Object.values(STORES);
  for (const store of allStores) {
    await dbClear(store);
  }
  for (const key of SETTINGS_LOCALSTORAGE_KEYS) {
    localStorage.removeItem(key);
  }
}

// ─── CSV Export orchestration ───────────────────────────────────────────────

export async function exportWorkoutHistory(): Promise<void> {
  const sessions = await dbGetAll<WorkoutSession>(STORES.WORKOUT_SESSIONS);
  exportWorkoutHistoryCSV(sessions);
}

// ─── JSON Backup orchestration ──────────────────────────────────────────────

export async function exportFullBackup(): Promise<void> {
  const [sessions, templates, personalExercises, personalRecords] = await Promise.all([
    dbGetAll(STORES.WORKOUT_SESSIONS),
    dbGetAll(STORES.WORKOUT_TEMPLATES),
    dbGetAll(STORES.PERSONAL_EXERCISES),
    dbGetAll(STORES.PERSONAL_RECORDS),
  ]);
  const backup = {
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    data: { sessions, templates, personalExercises, personalRecords },
    settings: {
      userProfile: localStorage.getItem('user_profile'),
      workoutPrefs: localStorage.getItem('workout_prefs'),
      nutritionGoals: localStorage.getItem('nutrition_goals'),
    },
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sparkos-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

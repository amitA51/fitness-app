/**
 * Settings business-logic orchestration layer (AR-4).
 * Composes pure functions from utils/tdee and services/indexedDBCore
 * so the UI just calls settingsService without embedding logic.
 */
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { WorkoutSession } from '../types';
import { logger } from '../utils/logger';
import { calculateTDEE, getMacroGoalsForGoal } from '../utils/tdee';
import { exportWorkoutHistoryCSV } from './exportService';
import { STORES, dbClear, dbGetAll } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';

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

/** Every cloud table holding rows owned by a single user (keyed by user_id). */
const USER_DATA_TABLES = [
  'workout_templates',
  'workout_sessions',
  'personal_exercises',
  'body_weight',
  'body_measurements',
  'personal_records',
  'recovery_logs',
  'nutrition_logs',
  'user_settings',
  'ai_conversations',
  'water_logs',
] as const;

/**
 * Delete every cloud row owned by `userId` across all synced tables.
 *
 * "Delete all my data" must purge the cloud copy too — otherwise a signed-in
 * user's data silently re-downloads on the next sign-in (AuthContext auto-pulls)
 * and the privacy promise is broken. One bulk `DELETE ... WHERE user_id = ?`
 * per table (instead of fetch-all + N per-row deletes, which was an N+1 storm
 * and silently truncated at the fetch page size). Failures are collected and
 * rethrown so the caller can surface an error rather than report a false
 * success.
 */
async function deleteAllCloudData(userId: string): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return;

  const results = await Promise.allSettled(
    USER_DATA_TABLES.map(async (table) => {
      const { error } = await supabase!.from(table).delete().eq('user_id', userId);
      if (error) {
        throw new Error(`delete ${table} failed: ${error.message}`);
      }
    })
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) {
    logger.app.error(`deleteAllCloudData: ${failed.length} cloud table purges failed`);
    throw new Error(`Failed to delete cloud data from ${failed.length} tables`);
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

  // Drop any queued offline mutations — a later replay must not re-create
  // data the user just asked to erase.
  try {
    const { clearMutationQueue } = await import('./offlineQueue');
    await clearMutationQueue();
  } catch (err) {
    logger.app.warn('deleteAllUserData: failed to clear offline mutation queue', err);
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

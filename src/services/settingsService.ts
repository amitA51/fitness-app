/**
 * Settings business-logic orchestration layer (AR-4).
 * Composes pure functions from utils/tdee and services/indexedDBCore
 * so the UI just calls settingsService without embedding logic.
 */
import type { WorkoutSession } from '../types';
import { calculateTDEE, getMacroGoalsForGoal } from '../utils/tdee';
import { exportWorkoutHistoryCSV } from './exportService';
import { STORES, dbClear, dbGetAll } from './indexedDBCore';

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

export async function deleteAllUserData(): Promise<void> {
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

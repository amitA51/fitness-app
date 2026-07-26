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
import { STORES, dbGetAll, dbPut } from './indexedDBCore';
import { getCurrentUser } from './supabaseAuth';
import { clearUserScopedLocalData } from './userScopedLocalData';

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

  await clearUserScopedLocalData();
}

// ─── CSV Export orchestration ───────────────────────────────────────────────

export async function exportWorkoutHistory(): Promise<void> {
  const sessions = await dbGetAll<WorkoutSession>(STORES.WORKOUT_SESSIONS);
  exportWorkoutHistoryCSV(sessions);
}

// ─── JSON Backup orchestration ──────────────────────────────────────────────

// ─── JSON Backup (full export + restore) ─────────────────────────────────────
// Inspired by OutRun's "keep full control over your data": ONE portable JSON
// file capturing every user-data store + the localStorage settings, with a
// matching restore. The transient offline-sync queue (PENDING_SYNC) is plumbing,
// not user data, so it is excluded; everything else round-trips.

/** Backup `data` key → IndexedDB store. Single source of truth shared by BOTH
 *  the export (reads these) and the restore (writes them) so they never drift. */
const BACKUP_DATA_TO_STORE: Record<string, string> = {
  sessions: STORES.WORKOUT_SESSIONS,
  templates: STORES.WORKOUT_TEMPLATES,
  personalExercises: STORES.PERSONAL_EXERCISES,
  personalRecords: STORES.PERSONAL_RECORDS,
  bodyWeight: STORES.BODY_WEIGHT,
  bodyMeasurements: STORES.BODY_MEASUREMENTS,
  nutritionLogs: STORES.NUTRITION_LOGS,
  recoveryLogs: STORES.RECOVERY_LOGS,
  waterLogs: STORES.WATER_LOGS,
  personalItems: STORES.PERSONAL_ITEMS,
  aiConversations: STORES.AI_CONVERSATIONS,
  userSettings: STORES.USER_SETTINGS,
};

/** `settings` key → localStorage key (captured alongside the stores). */
const BACKUP_SETTINGS_TO_LS: Record<string, string> = {
  userProfile: 'user_profile',
  workoutPrefs: 'workout_prefs',
  nutritionGoals: 'nutrition_goals',
  // The built-in 12-week program tracks progress only in localStorage (no cloud
  // sync yet); capture it so a manual backup preserves the commitment. Mirrors
  // PROGRESS_KEY in programService.ts (a literal, to avoid importing the large
  // generated program data here).
  programProgress: 'bbt_program_progress_v1',
};

export interface FullBackup {
  version: string;
  exportDate: string;
  data: Record<string, unknown[]>;
  settings: Record<string, string | null>;
}

/** Assemble the full backup object (pure of the download side-effect; testable). */
export async function buildFullBackup(): Promise<FullBackup> {
  const entries = Object.entries(BACKUP_DATA_TO_STORE);
  const rowsPerStore = await Promise.all(entries.map(([, store]) => dbGetAll(store)));
  const data: Record<string, unknown[]> = {};
  entries.forEach(([key, store], i) => {
    let rows = rowsPerStore[i] ?? [];
    // Drop the internal program-day scratch template (isProgramHidden) so it
    // never lands in a user backup and gets reintroduced (possibly stale).
    if (store === STORES.WORKOUT_TEMPLATES) {
      rows = (rows as Array<{ isProgramHidden?: boolean }>).filter((t) => !t.isProgramHidden);
    }
    data[key] = rows;
  });
  return {
    version: '1.1.0',
    exportDate: new Date().toISOString(),
    data,
    settings: Object.fromEntries(
      Object.entries(BACKUP_SETTINGS_TO_LS).map(([key, lsKey]) => [
        key,
        localStorage.getItem(lsKey),
      ])
    ),
  };
}

/** Build a full backup and download it as a .json file. */
export async function exportFullBackup(): Promise<void> {
  const backup = await buildFullBackup();
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

// ─── JSON Backup restore ────────────────────────────────────────────────────
// Completes the round-trip for exportFullBackup above (data ownership). Merges
// records by key (upsert — never wipes existing data) and overwrites the
// captured localStorage settings. A backup you can't restore isn't really yours.

export interface RestoreResult {
  /** Records written across all data stores. */
  records: number;
  /** localStorage settings keys restored. */
  settings: number;
}

interface BackupShape {
  version?: string;
  data?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

/**
 * Parse + restore a backup produced by {@link exportFullBackup}. Throws a
 * user-facing Hebrew error for malformed JSON or a foreign (non-SparkOS) file.
 */
export async function importFullBackup(text: string): Promise<RestoreResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('הקובץ אינו קובץ גיבוי תקין (JSON שגוי).');
  }
  const backup = parsed as BackupShape;
  if (
    typeof backup !== 'object' ||
    backup === null ||
    typeof backup.data !== 'object' ||
    backup.data === null
  ) {
    throw new Error('הקובץ אינו גיבוי של SparkOS.');
  }

  // Hardening: a restored file is untrusted input (a user may be socially
  // engineered into importing one). Bound what it can do — cap how many rows
  // per store it may write (storage-exhaustion guard) and reject non-record
  // shapes (arrays pass `typeof === 'object'`). Cross-user pollution is already
  // prevented downstream: supabaseSync stamps user_id from the live session.
  const MAX_ROWS_PER_STORE = 50_000;
  const MAX_SETTING_BYTES = 256 * 1024;

  let records = 0;
  for (const [key, store] of Object.entries(BACKUP_DATA_TO_STORE)) {
    const rows = backup.data[key];
    if (!Array.isArray(rows)) continue;
    if (rows.length > MAX_ROWS_PER_STORE) {
      logger.app.warn(
        `restore: "${store}" has ${rows.length} rows (> ${MAX_ROWS_PER_STORE}); skipping`
      );
      continue;
    }
    for (const row of rows) {
      // Plain object only — exclude arrays/null which also report as 'object'.
      if (row && typeof row === 'object' && !Array.isArray(row)) {
        try {
          await dbPut(store, row as object);
          records++;
        } catch (err) {
          logger.app.warn(`restore: failed to write a row to "${store}"`, err);
        }
      }
    }
  }

  let settings = 0;
  for (const [key, lsKey] of Object.entries(BACKUP_SETTINGS_TO_LS)) {
    const value = backup.settings?.[key];
    // Stored settings are JSON strings read back through safeJsonParse. Accept
    // only strings that are size-bounded AND parse as JSON, so a crafted file
    // cannot stuff arbitrary/oversized blobs into localStorage.
    if (typeof value === 'string' && value.length <= MAX_SETTING_BYTES) {
      try {
        JSON.parse(value);
      } catch {
        logger.app.warn(`restore: setting "${lsKey}" is not valid JSON; skipping`);
        continue;
      }
      try {
        localStorage.setItem(lsKey, value);
        settings++;
      } catch (err) {
        logger.app.warn(`restore: failed to set localStorage "${lsKey}"`, err);
      }
    }
  }

  return { records, settings };
}

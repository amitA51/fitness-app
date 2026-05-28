/**
 * Cloud Merge Service
 *
 * Shared, non-destructive merge helpers for syncing cloud records into local
 * IndexedDB, plus the generic merge/replace operations for record types that do
 * not have a dedicated CRUD module (measurements, personal records, recovery
 * logs, nutrition logs, user settings, AI conversations).
 */

import { LOCAL_STORAGE_KEYS as LS } from '../constants';
import { STORES, dbClear, dbGetAll, dbPut } from './indexedDBCore';

// ==================== REPLACE FROM CLOUD (for pullAllData) ====================
// These functions clear local IndexedDB and replace with cloud data

/**
 * Merge body measurements from cloud into local IndexedDB without dropping
 * local-only records. Name kept for backwards compatibility; the implementation
 * is now non-destructive (delegates to mergeGenericRecords defined below).
 */
export const replaceBodyMeasurementsFromCloud = async (measurements: unknown[]): Promise<void> => {
  await mergeGenericRecords(
    STORES.BODY_MEASUREMENTS,
    (measurements as { id?: string; createdAt?: string; updatedAt?: string }[]) ?? []
  );
};

/**
 * Merge personal records from cloud (non-destructive).
 */
export const replacePersonalRecordsFromCloud = async (records: unknown[]): Promise<void> => {
  await mergeGenericRecords(
    STORES.PERSONAL_RECORDS,
    (records as { id?: string; createdAt?: string; updatedAt?: string }[]) ?? []
  );
};

/**
 * Merge recovery logs from cloud (non-destructive).
 */
export const replaceRecoveryLogsFromCloud = async (logs: unknown[]): Promise<void> => {
  await mergeGenericRecords(
    LS.RECOVERY_LOGS,
    (logs as { id?: string; createdAt?: string; updatedAt?: string }[]) ?? []
  );
};

/**
 * Merge nutrition logs from cloud (non-destructive).
 */
export const replaceNutritionLogsFromCloud = async (logs: unknown[]): Promise<void> => {
  await mergeGenericRecords(
    LS.NUTRITION_LOGS,
    (logs as { id?: string; createdAt?: string; updatedAt?: string }[]) ?? []
  );
};

/**
 * Replace all user settings with cloud data.
 */
export const replaceUserSettingsFromCloud = async (settings: unknown[]): Promise<void> => {
  await dbClear(LS.USER_SETTINGS);
  await Promise.all(settings.map((s) => dbPut(LS.USER_SETTINGS, s as object)));
};

/**
 * Replace all AI conversations with cloud data.
 */
export const replaceAIConversationsFromCloud = async (conversations: unknown[]): Promise<void> => {
  await dbClear(STORES.AI_CONVERSATIONS);
  await Promise.all(conversations.map((c) => dbPut(STORES.AI_CONVERSATIONS, c as object)));
};

// ==================== MERGE FROM CLOUD (non-destructive) ====================

/**
 * Generic merge for simple timestamped records.
 */
export async function mergeGenericRecords<
  T extends { id?: string; createdAt?: string; updatedAt?: string },
>(storeName: string, cloudRecords: T[]): Promise<{ added: number; updated: number; kept: number }> {
  const localRecords = await dbGetAll<T>(storeName);
  const localMap = new Map(localRecords.map((r) => [String(r.id ?? ''), r]));

  let added = 0;
  let updated = 0;
  let kept = 0;

  for (const cloud of cloudRecords) {
    const local = localMap.get(String(cloud.id ?? ''));
    if (!local) {
      await dbPut(storeName, cloud);
      added++;
    } else {
      const localTime = new Date(local.updatedAt || local.createdAt || '').getTime();
      const cloudTime = new Date(cloud.updatedAt || cloud.createdAt || '').getTime();
      if (cloudTime > localTime) {
        await dbPut(storeName, cloud);
        updated++;
      } else {
        kept++;
      }
    }
  }

  return { added, updated, kept };
}

export const mergeBodyMeasurementsFromCloud = (
  measurements: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.BODY_MEASUREMENTS, measurements);
export const mergePersonalRecordsFromCloud = (
  records: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.PERSONAL_RECORDS, records);
export const mergeRecoveryLogsFromCloud = (
  logs: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.RECOVERY_LOGS, logs);
export const mergeNutritionLogsFromCloud = (
  logs: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.NUTRITION_LOGS, logs);
export const mergeUserSettingsFromCloud = (
  settings: { id?: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.USER_SETTINGS, settings);
export const mergeAIConversationsFromCloud = (
  conversations: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.AI_CONVERSATIONS, conversations);

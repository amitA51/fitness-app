/**
 * Cloud Merge Service
 *
 * Shared, non-destructive merge helpers for syncing cloud records into local
 * IndexedDB, plus the generic merge/replace operations for record types that do
 * not have a dedicated CRUD module (measurements, personal records, recovery
 * logs, nutrition logs, user settings, AI conversations).
 */

import { STORES, dbGetAll, dbPut } from './indexedDBCore';

// ==================== REPLACE FROM CLOUD (for pullAllData) ====================
// These functions merge cloud data into local IndexedDB non-destructively.

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
    STORES.RECOVERY_LOGS,
    (logs as { id?: string; createdAt?: string; updatedAt?: string }[]) ?? []
  );
};

/**
 * Merge nutrition logs from cloud (non-destructive).
 */
export const replaceNutritionLogsFromCloud = async (logs: unknown[]): Promise<void> => {
  await mergeGenericRecords(
    STORES.NUTRITION_LOGS,
    (logs as { id?: string; createdAt?: string; updatedAt?: string }[]) ?? []
  );
};

/**
 * Merge user settings from cloud (non-destructive).
 * USER_SETTINGS store uses keyPath 'key', not 'id'.
 */
export const replaceUserSettingsFromCloud = async (settings: unknown[]): Promise<void> => {
  await mergeGenericRecords(
    STORES.USER_SETTINGS,
    (settings as { id?: string; key?: string; createdAt?: string; updatedAt?: string }[]) ?? [],
    'key'
  );
};

/**
 * Merge AI conversations from cloud (non-destructive).
 */
export const replaceAIConversationsFromCloud = async (conversations: unknown[]): Promise<void> => {
  await mergeGenericRecords(
    STORES.AI_CONVERSATIONS,
    (conversations as { id?: string; createdAt?: string; updatedAt?: string }[]) ?? []
  );
};

// ==================== MERGE FROM CLOUD (non-destructive) ====================

interface TimestampedRecord {
  id?: string;
  key?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Parse a date string to epoch ms, returning 0 for invalid/missing values. */
const safeTimestamp = (value: string | undefined | null): number => {
  if (!value) return 0;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/**
 * Generic merge for simple timestamped records.
 * @param keyField  The field used as the IDB keyPath (default 'id', 'key' for USER_SETTINGS).
 */
export async function mergeGenericRecords<T extends TimestampedRecord>(
  storeName: string,
  cloudRecords: T[],
  keyField: 'id' | 'key' = 'id'
): Promise<{ added: number; updated: number; kept: number }> {
  const localRecords = await dbGetAll<T>(storeName);
  const localMap = new Map(
    localRecords.map((r) => [String((keyField === 'key' ? r.key : r.id) ?? ''), r])
  );

  let added = 0;
  let updated = 0;
  let kept = 0;

  const writes: T[] = [];

  for (const cloud of cloudRecords) {
    const cloudKey = String((keyField === 'key' ? cloud.key : cloud.id) ?? '');
    if (!cloudKey) continue; // skip records without a usable key
    const local = localMap.get(cloudKey);
    if (!local) {
      writes.push(cloud);
      added++;
    } else {
      const localTime = safeTimestamp(local.updatedAt) || safeTimestamp(local.createdAt);
      const cloudTime = safeTimestamp(cloud.updatedAt) || safeTimestamp(cloud.createdAt);
      // Cloud wins on strictly newer; on tie or both-zero, keep local (no-op).
      if (cloudTime > localTime) {
        writes.push(cloud);
        updated++;
      } else {
        kept++;
      }
    }
  }

  // Batch writes via Promise.all for better performance
  if (writes.length > 0) {
    await Promise.all(writes.map((record) => dbPut(storeName, record)));
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
  settings: { id?: string; key?: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.USER_SETTINGS, settings, 'key');
export const mergeAIConversationsFromCloud = (
  conversations: { id: string; createdAt?: string; updatedAt?: string }[]
) => mergeGenericRecords(STORES.AI_CONVERSATIONS, conversations);

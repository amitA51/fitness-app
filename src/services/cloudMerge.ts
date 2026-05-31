/**
 * Cloud Merge Service
 *
 * Shared, non-destructive merge helpers for syncing cloud records into local
 * IndexedDB, plus the generic merge/replace operations for record types that do
 * not have a dedicated CRUD module (measurements, personal records, recovery
 * logs, nutrition logs, user settings, AI conversations).
 */

import { STORES, dbGetAll, initDB } from './indexedDBCore';

interface AIMessageLike {
  id: string;
  role?: string;
  content?: string;
  timestamp?: string;
}

interface AIConversationLike {
  id?: string;
  title?: string;
  messages?: AIMessageLike[];
  context?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
}

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
  deletedAt?: string | null;
}

/** Parse a date string to epoch ms, returning 0 for invalid/missing values. */
export const safeTimestamp = (value: string | undefined | null): number => {
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
): Promise<{ added: number; updated: number; kept: number; deleted: number }> {
  const localRecords = await dbGetAll<T>(storeName);
  const localMap = new Map(
    localRecords.map((r) => [String((keyField === 'key' ? r.key : r.id) ?? ''), r])
  );

  let added = 0;
  let updated = 0;
  let kept = 0;
  let deleted = 0;

  const writes: T[] = [];
  const deletes: string[] = [];

  for (const cloud of cloudRecords) {
    const cloudKey = String((keyField === 'key' ? cloud.key : cloud.id) ?? '');
    if (!cloudKey) continue; // skip records without a usable key

    // DA-7: If cloud record is tombstoned, remove it locally
    if (cloud.deletedAt) {
      if (localMap.has(cloudKey)) {
        deletes.push(cloudKey);
        deleted++;
      }
      continue;
    }

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

  // DA-10: Atomic transaction — all writes and deletes succeed or none do
  if (writes.length > 0 || deletes.length > 0) {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      for (const record of writes) {
        store.put(record);
      }
      for (const key of deletes) {
        store.delete(key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('Merge transaction aborted'));
    });
  }

  return { added, updated, kept, deleted };
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

/**
 * Union two message lists by message id, keeping every unique message from
 * both sides and sorting chronologically by timestamp. When the same id
 * appears on both sides the newer (later timestamp) copy wins. Pure function.
 */
export const unionMessagesById = (
  local: AIMessageLike[] = [],
  cloud: AIMessageLike[] = []
): AIMessageLike[] => {
  const byId = new Map<string, AIMessageLike>();
  for (const msg of [...local, ...cloud]) {
    if (!msg || !msg.id) continue;
    const existing = byId.get(msg.id);
    if (!existing) {
      byId.set(msg.id, msg);
      continue;
    }
    // Same id on both sides: keep the one with the newer timestamp.
    if (safeTimestamp(msg.timestamp) >= safeTimestamp(existing.timestamp)) {
      byId.set(msg.id, msg);
    }
  }
  return Array.from(byId.values()).sort(
    (a, b) => safeTimestamp(a.timestamp) - safeTimestamp(b.timestamp)
  );
};

/**
 * Merge AI conversations from cloud with per-message reconciliation.
 *
 * Whole-array LWW (the generic merge) discards messages when two devices append
 * to the same conversation in parallel — the older write's messages vanish.
 * Instead we union messages by `message.id` (keeping both sides, sorted by
 * timestamp) and resolve conversation-level metadata (title/context) by LWW on
 * `updatedAt`. Tombstone-aware and atomic, like mergeGenericRecords.
 */
export async function mergeAIConversationsFromCloud(
  cloudConversations: AIConversationLike[]
): Promise<{ added: number; updated: number; kept: number; deleted: number }> {
  const localRecords = await dbGetAll<AIConversationLike>(STORES.AI_CONVERSATIONS);
  const localMap = new Map(localRecords.map((c) => [String(c.id ?? ''), c]));

  let added = 0;
  let updated = 0;
  let kept = 0;
  let deleted = 0;

  const writes: AIConversationLike[] = [];
  const deletes: string[] = [];

  for (const cloud of cloudConversations) {
    const cloudKey = String(cloud.id ?? '');
    if (!cloudKey) continue;

    if (cloud.deletedAt) {
      if (localMap.has(cloudKey)) {
        deletes.push(cloudKey);
        deleted++;
      }
      continue;
    }

    const local = localMap.get(cloudKey);
    if (!local) {
      writes.push(cloud);
      added++;
      continue;
    }

    const mergedMessages = unionMessagesById(local.messages, cloud.messages);
    const localTime = safeTimestamp(local.updatedAt) || safeTimestamp(local.createdAt);
    const cloudTime = safeTimestamp(cloud.updatedAt) || safeTimestamp(cloud.createdAt);
    const cloudIsNewer = cloudTime > localTime;

    // Conversation-level metadata follows LWW; messages are always unioned so
    // no side loses history. If nothing changed (cloud not newer and no new
    // messages), keep local untouched.
    const messagesChanged = mergedMessages.length !== (local.messages?.length ?? 0);
    if (!cloudIsNewer && !messagesChanged) {
      kept++;
      continue;
    }

    const base = cloudIsNewer ? cloud : local;
    writes.push({
      ...base,
      id: local.id ?? cloud.id,
      messages: mergedMessages,
      updatedAt:
        cloudTime > localTime
          ? (cloud.updatedAt ?? local.updatedAt)
          : (local.updatedAt ?? cloud.updatedAt),
    });
    updated++;
  }

  if (writes.length > 0 || deletes.length > 0) {
    const db = await initDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.AI_CONVERSATIONS, 'readwrite');
      const store = tx.objectStore(STORES.AI_CONVERSATIONS);
      for (const record of writes) {
        store.put(record);
      }
      for (const key of deletes) {
        store.delete(key);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error ?? new Error('AI merge transaction aborted'));
    });
  }

  return { added, updated, kept, deleted };
}

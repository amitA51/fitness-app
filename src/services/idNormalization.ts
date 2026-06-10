/**
 * One-time legacy local-id normalization.
 *
 * Cloud `id` columns are Postgres uuid, but older local creators minted
 * prefixed string ids (`session_<ts>`, `meal-…`, `bw-…`, `bm-…`, `rec-…`,
 * `conv-…`). PostgREST rejects those with 22P02, so such records could NEVER
 * sync — every push (single-record or bulk) failed forever.
 *
 * This pass rewrites every non-UUID id in the affected stores to a fresh
 * crypto.randomUUID() value, preserving all record data, and keeps internal
 * references consistent:
 *   - recovery logs carry a `sessionId` pointing at workout-session ids →
 *     remapped with the same old→new map (cloud column is TEXT, so an
 *     unmapped legacy value is tolerated and left as-is);
 *   - the `ai_current_conversation` localStorage pointer is remapped when the
 *     current conversation's id changes.
 *
 * Guarantees:
 *   - Idempotent: records whose id is already a UUID are untouched; a
 *     localStorage flag skips the pass entirely after one clean run.
 *   - Crash-safe direction: the new record is written BEFORE the old one is
 *     deleted, so an interruption can duplicate a record but never lose one.
 *   - Never throws: any failure is logged and startup/sync continues; the
 *     flag is only set after a fully successful pass so a failed run retries
 *     on the next sync.
 */

import { isUuid } from '../utils/id';
import { logger } from '../utils/logger';
import { STORES, dbDelete, dbGetAll, dbPut } from './indexedDBCore';

/** localStorage guard — bump the suffix if the pass ever needs to re-run. */
export const ID_NORMALIZATION_FLAG = 'sparkos_legacy_id_normalization_v1';

/** Must match CURRENT_CONVERSATION_KEY in services/ai/chat.ts. */
const CURRENT_CONVERSATION_KEY = 'ai_current_conversation';

interface IdRecord {
  id: string;
}

interface RecoveryLogRecord extends IdRecord {
  sessionId?: string;
}

const safeGetFlag = (): boolean => {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(ID_NORMALIZATION_FLAG) !== null;
  } catch {
    return false;
  }
};

const safeSetFlag = (): void => {
  try {
    localStorage.setItem(ID_NORMALIZATION_FLAG, new Date().toISOString());
  } catch {
    // Storage full/unavailable — the pass is idempotent, re-running is safe.
  }
};

/**
 * Rewrite every non-UUID id in `store` to a fresh UUID (new copy written
 * first, old row deleted after). Returns the oldId → newId map.
 */
const rewriteStoreIds = async (store: string): Promise<Map<string, string>> => {
  const map = new Map<string, string>();
  const records = await dbGetAll<IdRecord>(store);
  for (const record of records) {
    if (typeof record.id !== 'string' || record.id === '' || isUuid(record.id)) continue;
    const newId = crypto.randomUUID();
    await dbPut(store, { ...record, id: newId });
    await dbDelete(store, record.id);
    map.set(record.id, newId);
  }
  return map;
};

/**
 * Rewrite recovery-log ids AND remap their `sessionId` references using the
 * workout-session old→new map. A sessionId not present in the map (session
 * already deleted, or already a UUID) is left untouched — the cloud
 * recovery_logs.session_id column is TEXT, so it never 22P02s.
 */
const rewriteRecoveryLogs = async (sessionIdMap: Map<string, string>): Promise<number> => {
  const logs = await dbGetAll<RecoveryLogRecord>(STORES.RECOVERY_LOGS);
  let changed = 0;
  for (const log of logs) {
    const needsNewId = typeof log.id === 'string' && log.id !== '' && !isUuid(log.id);
    const remappedSessionId = log.sessionId ? sessionIdMap.get(log.sessionId) : undefined;
    if (!needsNewId && !remappedSessionId) continue;

    const updated: RecoveryLogRecord = {
      ...log,
      id: needsNewId ? crypto.randomUUID() : log.id,
      ...(remappedSessionId ? { sessionId: remappedSessionId } : {}),
    };
    await dbPut(STORES.RECOVERY_LOGS, updated);
    if (needsNewId) await dbDelete(STORES.RECOVERY_LOGS, log.id);
    changed++;
  }
  return changed;
};

/** Keep the "current conversation" pointer valid across the id rewrite. */
const remapCurrentConversationPointer = (conversationIdMap: Map<string, string>): void => {
  try {
    const current = localStorage.getItem(CURRENT_CONVERSATION_KEY);
    const remapped = current ? conversationIdMap.get(current) : undefined;
    if (remapped) localStorage.setItem(CURRENT_CONVERSATION_KEY, remapped);
  } catch {
    // Pointer repair is best-effort; a stale pointer just opens a new chat.
  }
};

const runNormalizationPass = async (): Promise<void> => {
  if (safeGetFlag()) return;
  if (typeof crypto === 'undefined' || typeof crypto.randomUUID !== 'function') {
    // No UUID source — leave legacy ids alone rather than minting more
    // non-UUID ids. (All supported runtimes have crypto.randomUUID.)
    return;
  }

  try {
    // Sessions FIRST so recovery logs can remap their sessionId references.
    const sessionMap = await rewriteStoreIds(STORES.WORKOUT_SESSIONS);
    const recoveryChanged = await rewriteRecoveryLogs(sessionMap);
    const nutritionMap = await rewriteStoreIds(STORES.NUTRITION_LOGS);
    const bodyWeightMap = await rewriteStoreIds(STORES.BODY_WEIGHT);
    const measurementMap = await rewriteStoreIds(STORES.BODY_MEASUREMENTS);
    const conversationMap = await rewriteStoreIds(STORES.AI_CONVERSATIONS);
    remapCurrentConversationPointer(conversationMap);

    safeSetFlag();

    const total =
      sessionMap.size +
      recoveryChanged +
      nutritionMap.size +
      bodyWeightMap.size +
      measurementMap.size +
      conversationMap.size;
    if (total > 0) {
      logger.sync.info('Normalized legacy local ids to UUIDs', {
        sessions: sessionMap.size,
        recoveryLogs: recoveryChanged,
        nutritionLogs: nutritionMap.size,
        bodyWeight: bodyWeightMap.size,
        bodyMeasurements: measurementMap.size,
        aiConversations: conversationMap.size,
      });
    }
  } catch (err) {
    // Must never brick startup or block a sync — log and continue. The flag
    // was not set, so the pass retries on the next sync entry.
    logger.sync.error('Legacy id normalization failed — continuing without it', err);
  }
};

// Coalesce concurrent callers (syncAllData and pullAllData can fire together
// on sign-in): two passes racing the same store would duplicate records.
let inFlight: Promise<void> | null = null;

/**
 * Run the one-time legacy-id normalization. Safe to call from every sync
 * entry point: no-ops after the first clean run (localStorage flag),
 * coalesces concurrent calls, and never rejects.
 */
export const normalizeLegacyLocalIds = (): Promise<void> => {
  if (!inFlight) {
    inFlight = runNormalizationPass().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
};

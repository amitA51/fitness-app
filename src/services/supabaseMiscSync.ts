/**
 * Supabase Misc Sync
 * SPARKOS Fitness App - User settings & AI conversations cloud sync
 *
 * Extracted from supabaseSync.ts to keep that module under the file-size cap.
 * Re-exported from supabaseSync.ts for backward compatibility.
 */

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import { fetchAllPages } from './supabaseSyncPagination';
import type { AIConversation, UserSetting } from './supabaseSyncMappers';

// ==================== USER SETTINGS ====================

export const syncUserSetting = async (userId: string, setting: UserSetting): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase.from('user_settings').upsert(
    {
      id: setting.id || `${userId}:${setting.key}`,
      user_id: userId,
      key: setting.key,
      value: setting.value,
      created_at: setting.createdAt || new Date().toISOString(),
      updated_at: setting.updatedAt || new Date().toISOString(),
    },
    { onConflict: 'user_id,key' }
  );

  if (error) {
    logger.sync.error('Error syncing user setting', error);
    throw error;
  }
};

export const fetchUserSettings = async (userId: string): Promise<UserSetting[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const data = await fetchAllPages('user_settings', (from, to) =>
    supabase!
      .from('user_settings')
      .select('id, key, value, created_at, updated_at, deleted_at')
      .eq('user_id', userId)
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    key: row.key,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

export const deleteCloudUserSetting = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  // INTENTIONAL hard delete (no tombstone). Unlike sessions/templates/water,
  // user_settings rows are keyed by (user_id, key) and treated as upsert-only
  // state — a setting is overwritten via `syncUserSetting`, not deleted, during
  // normal use. There is therefore no local delete path that needs to propagate
  // to other devices, and the `UserSetting` shape carries no `deletedAt`.
  // mergeUserSettingsFromCloud already routes through the tombstone-aware
  // generic merge, so if a `deleted_at` column is added server-side later, a
  // soft-delete here would propagate without further merge changes.
  const { error } = await supabase
    .from('user_settings')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error deleting cloud user setting', error);
    throw error;
  }
};

// ==================== AI CONVERSATIONS ====================

export const syncAIConversation = async (
  userId: string,
  conversation: AIConversation
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase.from('ai_conversations').upsert({
    id: conversation.id,
    user_id: userId,
    title: conversation.title || null,
    messages: conversation.messages,
    context: conversation.context || {},
    created_at: conversation.createdAt || new Date().toISOString(),
    updated_at: conversation.updatedAt || conversation.createdAt || new Date().toISOString(),
  });

  if (error) {
    logger.sync.error('Error syncing AI conversation', error);
    throw error;
  }
};

export const fetchAIConversations = async (userId: string): Promise<AIConversation[]> => {
  if (!isSupabaseConfigured() || !supabase) return [];

  const data = await fetchAllPages('ai_conversations', (from, to) =>
    supabase!
      .from('ai_conversations')
      .select('id, title, messages, context, created_at, updated_at, deleted_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .range(from, to)
  );

  return data.map((row) => ({
    id: row.id,
    title: row.title,
    messages: row.messages || [],
    context: row.context || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  }));
};

/**
 * HARD delete — physically removes the row. Reserved for the account-wipe flow
 * (`deleteAllCloudData`), which intends to erase everything. For a single
 * user-initiated conversation delete use `softDeleteCloudAIConversation` so the
 * deletion propagates across devices instead of resurrecting on the next pull.
 */
export const deleteCloudAIConversation = async (userId: string, id: string): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const { error } = await supabase
    .from('ai_conversations')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error deleting cloud AI conversation', error);
    throw error;
  }
};

/**
 * Soft-delete an AI conversation by setting `deleted_at`. The tombstone-aware
 * merge (mergeAIConversationsFromCloud) removes the row on every other device's
 * next pull, and the bulk/single push paths preserve the tombstone (they omit
 * deleted_at, which a PostgREST upsert leaves untouched on conflict). This is
 * the propagating delete used by the single-conversation delete UX.
 */
export const softDeleteCloudAIConversation = async (
  userId: string,
  id: string
): Promise<void> => {
  if (!isSupabaseConfigured() || !supabase) return;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from('ai_conversations')
    .update({ deleted_at: now, updated_at: now })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) {
    logger.sync.error('Error soft-deleting cloud AI conversation', error);
    throw error;
  }
};

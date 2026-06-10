// ============================================================================
// COACH PLATFORM — Group / segment service
// ============================================================================

import type { ClientGroup } from '../../types/coach';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { requireClient, toGroup } from './mappers';

export const listGroups = async (): Promise<ClientGroup[]> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('client_groups')
    .select('*')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false });
  if (error) {
    logger.db.error('listGroups failed', error);
    // Throw so callers' error states fire instead of a fake "no groups" empty.
    throw new Error(error.message);
  }
  return (data ?? []).map(toGroup);
};

export const createGroup = async (name: string): Promise<ClientGroup> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('unauthenticated');
  const { data, error } = await supabase
    .from('client_groups')
    .insert({ coach_id: user.id, name: name.trim() })
    .select('*')
    .single();
  if (error) throw error;
  return toGroup(data);
};

export const deleteGroup = async (id: string): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const { error } = await supabase.from('client_groups').delete().eq('id', id);
  return { error: error?.message ?? null };
};

export const getGroupMemberIds = async (groupId: string): Promise<string[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('client_group_members')
    .select('client_id')
    .eq('group_id', groupId);
  if (error) {
    logger.db.error('getGroupMemberIds failed', error);
    // Throw — a silent [] here makes the group editor look empty and a save
    // would then wipe the real membership.
    throw new Error(error.message);
  }
  return (data ?? []).map((r: { client_id: string }) => r.client_id);
};

export const getGroupMemberCounts = async (groupIds: string[]): Promise<Map<string, number>> => {
  if (groupIds.length === 0) return new Map();
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('client_group_members')
    .select('group_id')
    .in('group_id', groupIds);
  if (error) {
    logger.db.error('getGroupMemberCounts failed', error);
    return new Map();
  }
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = (row as { group_id: string }).group_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
};

export const setGroupMembers = async (
  groupId: string,
  clientIds: string[]
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  // ONE transactional RPC (migration 20260614000000): the server diffs and
  // applies inserts+deletes atomically, so a mid-failure can never leave the
  // group half-updated. Ownership + active-client checks run server-side.
  const { error } = await supabase.rpc('set_group_members', {
    _group_id: groupId,
    _client_ids: clientIds,
  });
  return { error: error?.message ?? null };
};

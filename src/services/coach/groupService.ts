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
    return [];
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
    return [];
  }
  return (data ?? []).map((r: { client_id: string }) => r.client_id);
};

export const setGroupMembers = async (
  groupId: string,
  clientIds: string[]
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  // Replace membership: clear then insert the new set.
  const del = await supabase.from('client_group_members').delete().eq('group_id', groupId);
  if (del.error) return { error: del.error.message };
  if (clientIds.length === 0) return { error: null };
  const rows = clientIds.map((client_id) => ({ group_id: groupId, client_id }));
  const { error } = await supabase.from('client_group_members').insert(rows);
  return { error: error?.message ?? null };
};

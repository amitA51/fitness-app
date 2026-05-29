// ============================================================================
// COACH PLATFORM — Profile service
// ============================================================================
// Thin online accessor for the `profiles` table (display name shown across the
// coach/trainee surfaces). Safe to call when Supabase is unconfigured: reads
// return null and writes no-op, mirroring the rest of the app's offline grace.

import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { Profile } from '../../types/coach';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { toProfile } from './mappers';

/** Fetch the current user's profile, or null when offline/unauthenticated. */
export const getMyProfile = async (): Promise<Profile | null> => {
  if (!isSupabaseConfigured() || !supabase) return null;
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    logger.db.error('getMyProfile failed', error);
    return null;
  }
  return data ? toProfile(data) : null;
};

/** Update the current user's display name (and optional avatar). */
export const updateMyProfile = async (
  updates: Partial<Pick<Profile, 'displayName' | 'avatarUrl'>>
): Promise<{ error: string | null }> => {
  if (!isSupabaseConfigured() || !supabase) return { error: 'offline' };
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' };

  const row: Record<string, unknown> = { id: user.id };
  if (updates.displayName !== undefined) row.display_name = updates.displayName;
  if (updates.avatarUrl !== undefined) row.avatar_url = updates.avatarUrl;

  const { error } = await supabase.from('profiles').upsert(row);
  if (error) {
    logger.db.error('updateMyProfile failed', error);
    return { error: error.message };
  }
  return { error: null };
};

/** Fetch profiles for a set of user ids (used to label roster rows). */
export const getProfilesByIds = async (ids: string[]): Promise<Map<string, Profile>> => {
  const map = new Map<string, Profile>();
  if (!isSupabaseConfigured() || !supabase || ids.length === 0) return map;

  const { data, error } = await supabase.from('profiles').select('*').in('id', ids);
  if (error) {
    logger.db.error('getProfilesByIds failed', error);
    return map;
  }
  for (const row of data ?? []) {
    const p = toProfile(row);
    map.set(p.id, p);
  }
  return map;
};

// ============================================================================
// COACH PLATFORM — Relationship service
// ============================================================================
// Coach-mode enablement, entitlements/seats, and the coach<->client links
// (roster, consent, disconnect). All online (direct Supabase).

import type { CoachClient, CoachProfile, CoachSubscription } from '../../types/coach';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { requireClient, toCoachClient, toCoachProfile, toSubscription } from './mappers';

const CLIENT_WITH_PROFILE = '*, client_profile:profiles!coach_clients_client_id_fkey(*)';
const COACH_WITH_PROFILE = '*, coach_profile:profiles!coach_clients_coach_id_fkey(*)';

// ---- Coach mode (coach_profiles) -------------------------------------------

/** Whether the current user has enabled coach mode. */
export const isCoachEnabled = async (): Promise<boolean> => {
  return (await getMyCoachProfile()) !== null;
};

export const getMyCoachProfile = async (): Promise<CoachProfile | null> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('coach_profiles')
    .select('id, business_name, bio, settings, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) {
    logger.db.error('getMyCoachProfile failed', error);
    return null;
  }
  return data ? toCoachProfile(data) : null;
};

/**
 * Enable coach mode via the atomic `become_coach` RPC: creates the
 * coach_profiles row + default subscription AND flips profiles.role to
 * 'coach' (the server-side role SSOT) in one transaction. Idempotent.
 * Returns the (possibly pre-existing) coach profile.
 */
export const enableCoachMode = async (businessName?: string): Promise<CoachProfile> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('unauthenticated');

  const { error } = await supabase.rpc('become_coach', {
    _business_name: businessName ?? null,
  });
  if (error) throw error;

  const profile = await getMyCoachProfile();
  if (!profile) throw new Error('coach_profile_missing_after_become_coach');
  return profile;
};

// ---- Entitlements ----------------------------------------------------------

export const getMySubscription = async (): Promise<CoachSubscription | null> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('coach_subscriptions')
    .select('coach_id, plan, seat_limit, status, created_at')
    .eq('coach_id', user.id)
    .maybeSingle();
  if (error) {
    logger.db.error('getMySubscription failed', error);
    return null;
  }
  return data ? toSubscription(data) : null;
};

/** Active-client count vs. seat limit, for gating the invite UI. */
export const getSeatUsage = async (): Promise<{ used: number; limit: number; full: boolean }> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return { used: 0, limit: 0, full: true };

  const [{ count }, sub] = await Promise.all([
    supabase
      .from('coach_clients')
      .select('id', { count: 'exact', head: true })
      .eq('coach_id', user.id)
      .eq('status', 'active'),
    getMySubscription(),
  ]);
  const used = count ?? 0;
  const limit = sub?.seatLimit ?? 1;
  return { used, limit, full: used >= limit };
};

// ---- Roster (coach side) ---------------------------------------------------

export const listClients = async (
  status: CoachClient['status'] | 'all' = 'active'
): Promise<CoachClient[]> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return [];

  let query = supabase.from('coach_clients').select(CLIENT_WITH_PROFILE).eq('coach_id', user.id);
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    logger.db.error('listClients failed', error);
    return [];
  }
  return (data ?? []).map(toCoachClient);
};

export const getClientLink = async (clientId: string): Promise<CoachClient | null> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('coach_clients')
    .select(CLIENT_WITH_PROFILE)
    .eq('coach_id', user.id)
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) {
    logger.db.error('getClientLink failed', error);
    return null;
  }
  return data ? toCoachClient(data) : null;
};

/** Coach changes a link status (pause/resume/end). */
export const setClientStatus = async (
  linkId: string,
  status: CoachClient['status']
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const { error } = await supabase.from('coach_clients').update({ status }).eq('id', linkId);
  if (error) return { error: error.message };
  return { error: null };
};

// ---- Trainee side ----------------------------------------------------------

/** The coaches linked to the current user (trainee's "My Coach" view). */
export const listMyCoaches = async (
  status: CoachClient['status'] | 'all' = 'active'
): Promise<CoachClient[]> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return [];

  let query = supabase.from('coach_clients').select(COACH_WITH_PROFILE).eq('client_id', user.id);
  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) {
    logger.db.error('listMyCoaches failed', error);
    return [];
  }
  return (data ?? []).map(toCoachClient);
};

/** Trainee disconnects from a coach — instantly revokes the coach's access. */
export const disconnectCoach = async (linkId: string): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const { error } = await supabase
    .from('coach_clients')
    .update({ status: 'ended' })
    .eq('id', linkId);
  if (error) return { error: error.message };
  return { error: null };
};

// ============================================================================
// waitlistService — public.waitlist RPC wrappers
//
// join_waitlist(_source)  → void  (raises 'rate_limited' on >1 call/user)
// hasJoinedWaitlist()     → boolean (select from waitlist for current user)
//
// Both functions are FAIL-SAFE: they never throw to the caller and always
// return a safe default on any network / auth failure.
// ============================================================================

import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { getCurrentUser } from '../supabaseAuth';

// --------------------------------------------------------------------------
// joinWaitlist
// --------------------------------------------------------------------------

/**
 * Call the join_waitlist RPC.
 * Returns { error: null } on success (including "already joined" — the DB
 * upserts on the PK so re-calling is idempotent at the SQL level; the RPC
 * may also short-circuit with 'rate_limited', which we surface as an error).
 */
export async function joinWaitlist(source?: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured() || !supabase) {
    return { error: 'לא ניתן להתחבר לשרת כרגע. נסה שוב מאוחר יותר.' };
  }

  try {
    const { error } = await supabase.rpc('join_waitlist', {
      _source: source ?? 'paywall',
    });

    if (error) {
      // Postgres RAISE with code 'rate_limited' or any other DB-level message
      return { error: error.message ?? 'שגיאה בהצטרפות לרשימת ההמתנה.' };
    }

    return { error: null };
  } catch {
    return { error: 'שגיאה בהצטרפות לרשימת ההמתנה. נסה שוב.' };
  }
}

// --------------------------------------------------------------------------
// hasJoinedWaitlist
// --------------------------------------------------------------------------

/**
 * Check whether the current user is already in the waitlist.
 * Returns false on any failure (not logged in, network error, RLS rejection).
 */
export async function hasJoinedWaitlist(): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;

  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const { data, error } = await supabase
      .from('waitlist')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) return false;
    return data !== null;
  } catch {
    return false;
  }
}

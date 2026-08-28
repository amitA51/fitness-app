// ============================================================================
// useIsAppAdmin — "is the signed-in user an operator?"
//
// app_admins (20260828000000_admin_coach_assignment.sql) is RLS-locked to
// SELECT of the caller's OWN row and has no write policy at all, so the whole
// check is: read your own row and see whether it came back. A non-member gets
// zero rows rather than an error, and membership can only be granted by
// service_role / superuser SQL — nothing on the client can fake it.
//
// `loading` is part of the contract: the route guard must render nothing (not a
// redirect) until the answer is known, or an admin gets bounced home on every
// cold load. Resolved once per mount — AppShell is keyed on the user id, so a
// sign-in/sign-out remounts this and re-resolves.
// ============================================================================

import { useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { getCurrentUser } from '../services/supabaseAuth';
import { logger } from '../utils/logger';

export interface AppAdminState {
  isAdmin: boolean;
  /** True until the app_admins lookup has settled. Never redirect while true. */
  loading: boolean;
}

/** Fail-closed: any failure resolves to "not an admin", never to admin. */
async function resolveIsAppAdmin(): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;

  const user = await getCurrentUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('app_admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    logger.db.error('app_admins lookup failed', error);
    return false;
  }

  return data !== null;
}

export function useIsAppAdmin(): AppAdminState {
  const [state, setState] = useState<AppAdminState>({ isAdmin: false, loading: true });

  useEffect(() => {
    let cancelled = false;

    resolveIsAppAdmin()
      .catch((err) => {
        logger.db.error('app_admins lookup threw', err);
        return false;
      })
      .then((isAdmin) => {
        if (!cancelled) setState({ isAdmin, loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

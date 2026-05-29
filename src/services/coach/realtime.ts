// ============================================================================
// COACH PLATFORM — Realtime reflection
// ============================================================================
// Lets a trainee's screen react live when a coach acts on their data. Used for
// the assignments inbox today; the same channel pattern reflects coach edits to
// other trainee-owned tables. No-ops gracefully when Supabase is unconfigured.

import { isSupabaseConfigured, supabase } from '../../lib/supabase';

type Unsubscribe = () => void;

/**
 * Subscribe to changes on a trainee-owned table for the given user and invoke
 * `onChange` on any insert/update/delete. Returns an unsubscribe function.
 */
export function subscribeToUserTable(
  table: string,
  userId: string,
  onChange: () => void
): Unsubscribe {
  if (!isSupabaseConfigured() || !supabase || !userId) return () => {};

  const channel = supabase
    .channel(`rt:${table}:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
      () => onChange()
    )
    .subscribe();

  return () => {
    void supabase?.removeChannel(channel);
  };
}

/**
 * Subscribe to assignments addressed to a trainee (direct) so the inbox updates
 * the moment a coach sends a program/note/announcement.
 */
export function subscribeToAssignments(clientId: string, onChange: () => void): Unsubscribe {
  if (!isSupabaseConfigured() || !supabase || !clientId) return () => {};

  const channel = supabase
    .channel(`rt:assignments:${clientId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'assignments', filter: `client_id=eq.${clientId}` },
      () => onChange()
    )
    .subscribe();

  return () => {
    void supabase?.removeChannel(channel);
  };
}

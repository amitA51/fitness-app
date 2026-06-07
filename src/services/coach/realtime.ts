// ============================================================================
// COACH PLATFORM — Realtime reflection
// ============================================================================
// Lets a trainee's screen react live when a coach acts on their data. Used for
// the assignments inbox today; the same channel pattern reflects coach edits to
// other trainee-owned tables. No-ops gracefully when Supabase is unconfigured.

import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import type { GroupMessage, Message } from '../../types/coach';
import { toGroupMessage, toMessage } from './mappers';

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
 * Subscribe to a single coach<->client message thread. Fires `onMessage` with
 * each newly inserted message so an open thread can append it live. Filters on
 * `client_id` (a single realtime filter) and scopes to the coach in-callback.
 */
export function subscribeToThread(
  coachId: string,
  clientId: string,
  onMessage: (message: Message) => void
): Unsubscribe {
  if (!isSupabaseConfigured() || !supabase || !coachId || !clientId) return () => {};

  const channel = supabase
    .channel(`rt:messages:${coachId}:${clientId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${clientId}` },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        if (row.coach_id === coachId) onMessage(toMessage(row));
      }
    )
    .subscribe();

  return () => {
    void supabase?.removeChannel(channel);
  };
}
/**
 * Subscribe to new messages in a group thread. Fires `onMessage` with each
 * newly inserted message so an open group chat can append it live.
 */
export function subscribeToGroupThread(
  groupId: string,
  onMessage: (m: GroupMessage) => void
): Unsubscribe {
  if (!isSupabaseConfigured() || !supabase || !groupId) return () => {};

  const channel = supabase
    .channel(`rt:group_messages:${groupId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      },
      (payload) => {
        const row = payload.new as Record<string, unknown>;
        onMessage(toGroupMessage(row));
      }
    )
    .subscribe();

  return () => {
    void supabase?.removeChannel(channel);
  };
}

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

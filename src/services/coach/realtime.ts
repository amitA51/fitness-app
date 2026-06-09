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

// Monotonic suffix so each subscription gets a UNIQUE channel name. A fixed
// name (`rt:table:user`) collides on React StrictMode remount: supabase returns
// the still-subscribed previous channel and `.on()` after `.subscribe()` throws
// ("cannot add postgres_changes callbacks ... after subscribe()"), which used to
// bubble up and blank out surfaces like TodaysWorkoutCard. Unique names never
// return a stale channel; each subscription removes exactly its own.
let channelSeq = 0;

/**
 * Subscribe to changes on a trainee-owned table for the given user and invoke
 * `onChange` on any insert/update/delete. Returns an unsubscribe function.
 * Never throws — a realtime failure must not break the calling surface.
 */
export function subscribeToUserTable(
  table: string,
  userId: string,
  onChange: () => void
): Unsubscribe {
  if (!isSupabaseConfigured() || !supabase || !userId) return () => {};

  try {
    const channel = supabase
      .channel(`rt:${table}:${userId}:${++channelSeq}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `user_id=eq.${userId}` },
        () => onChange()
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  } catch {
    // Realtime is an enhancement; the caller's initial fetch still works.
    return () => {};
  }
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

  try {
    const channel = supabase
      .channel(`rt:messages:${coachId}:${clientId}:${++channelSeq}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          if (row.coach_id === coachId) onMessage(toMessage(row));
        }
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  } catch {
    // Realtime is an enhancement; the caller's initial fetch still works.
    return () => {};
  }
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

  try {
    const channel = supabase
      .channel(`rt:group_messages:${groupId}:${++channelSeq}`)
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
  } catch {
    // Realtime is an enhancement; the caller's initial fetch still works.
    return () => {};
  }
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

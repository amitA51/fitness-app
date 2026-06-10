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

/**
 * Hub-level: subscribe to ALL newly inserted 1:1 messages addressed to this
 * coach (any client). Lets the messages hub refresh previews/unread badges
 * live instead of waiting for the next poll. Filters on `coach_id` — one
 * realtime filter, mirroring subscribeToThread's single-filter approach.
 */
export function subscribeToCoachClientMessages(coachId: string, onActivity: () => void): Unsubscribe {
  if (!isSupabaseConfigured() || !supabase || !coachId) return () => {};

  try {
    const channel = supabase
      .channel(`rt:messages:inbox:${coachId}:${++channelSeq}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `coach_id=eq.${coachId}`,
        },
        () => onActivity()
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  } catch {
    // Realtime is an enhancement; the caller's poll/initial fetch still works.
    return () => {};
  }
}

/**
 * Hub-level: subscribe to newly inserted group messages across ALL of the
 * viewer's groups. `group_messages` has no coach_id column and the group set
 * is dynamic, so no server-side filter is possible here — we subscribe broadly
 * and rely on RLS (WALRUS) to deliver only rows the signed-in user may read,
 * i.e. messages in their own groups.
 */
export function subscribeToCoachGroupMessages(onActivity: () => void): Unsubscribe {
  if (!isSupabaseConfigured() || !supabase) return () => {};

  try {
    const channel = supabase
      .channel(`rt:group_messages:inbox:${++channelSeq}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_messages' },
        () => onActivity()
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  } catch {
    // Realtime is an enhancement; the caller's poll/initial fetch still works.
    return () => {};
  }
}

/** Minimum spacing between summary refreshes triggered by realtime events. */
export const INBOX_REFRESH_MIN_INTERVAL_MS = 1_000;

export interface ThrottledRefresh {
  /** Invoke `fn` now if the interval elapsed, otherwise schedule one trailing call. */
  run: () => void;
  /** Drop any pending trailing call (use on unmount). */
  cancel: () => void;
}

/**
 * Leading + trailing throttle for realtime-driven refreshes: the first event
 * fires immediately, a burst collapses into at most one call per
 * `intervalMs`, and the last event in a burst is never lost (trailing call).
 * Pure timer logic — exported for tests.
 */
export function createThrottledRefresh(
  fn: () => void,
  intervalMs: number = INBOX_REFRESH_MIN_INTERVAL_MS
): ThrottledRefresh {
  let lastRun = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const invoke = () => {
    lastRun = Date.now();
    fn();
  };

  return {
    run: () => {
      const elapsed = Date.now() - lastRun;
      if (elapsed >= intervalMs) {
        invoke();
      } else if (timer === null) {
        timer = setTimeout(() => {
          timer = null;
          invoke();
        }, intervalMs - elapsed);
      }
    },
    cancel: () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
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

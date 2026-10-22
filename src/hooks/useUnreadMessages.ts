import { useEffect, useState } from 'react';
import { COACH_LINK_STATE_EVENT } from '../services/coach/coachLinkEvents';
import { getGroupUnreadCount } from '../services/coach/groupMessageService';
import {
  getCoachLinkState,
  getUnreadCount,
  hasMessagingPeers,
  invalidateCoachLinkStateIfNoLinks,
} from '../services/coach/messageService';
import { getCurrentUser } from '../services/supabaseAuth';

/**
 * How often the badge is refreshed while the app is on screen. It was 30 s, in
 * every open tab, visible or not — 3–5 queries a tick per user on a database
 * that was overloaded. Opening or reading a thread still refreshes it at once
 * (`coach:unread-refresh`), so a slower poll only delays news from OTHER people.
 */
export const UNREAD_POLL_MS = 150_000;

/**
 * Shared by every mounted instance and kept across remounts (BottomNav unmounts
 * during each workout): one request in flight, and the last answer per user.
 */
let cached: { userId: string; count: number; at: number } | null = null;
let inFlight: { userId: string; promise: Promise<number> } | null = null;

const countFor = async (userId: string): Promise<number> => {
  const link = await getCoachLinkState();
  // Not known (offline, server struggling): keep showing what we had.
  if (link === null) return cached?.userId === userId ? cached.count : 0;
  // Nobody to hear from — the common case for a self-guided user. No queries.
  if (!hasMessagingPeers(link)) return 0;

  const [direct, group] = await Promise.all([
    link.links.length > 0 ? getUnreadCount(link.links).catch(() => 0) : 0,
    link.hasGroups ? getGroupUnreadCount().catch(() => 0) : 0,
  ]);
  return direct + group;
};

/**
 * The unread count, reusing the last answer when it is younger than `maxAgeMs`.
 * Exported for tests.
 */
export async function readUnreadCount(maxAgeMs: number): Promise<number> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) return 0;
  const userId = user.id;

  if (cached?.userId === userId && Date.now() - cached.at < maxAgeMs) return cached.count;
  if (inFlight?.userId === userId) return inFlight.promise;

  const promise: Promise<number> = countFor(userId)
    .catch(() => (cached?.userId === userId ? cached.count : 0))
    .then((count) => {
      cached = { userId, count, at: Date.now() };
      return count;
    })
    .finally(() => {
      if (inFlight?.promise === promise) inFlight = null;
    });
  inFlight = { userId, promise };
  return promise;
}

/** Tests only: forget the shared answer. */
export function resetUnreadMessagesCache(): void {
  cached = null;
  inFlight = null;
}

const isVisible = (): boolean =>
  typeof document === 'undefined' || document.visibilityState !== 'hidden';

/**
 * Unread coach<->client message count for the current user, including both
 * 1-to-1 thread messages and group-chat messages.
 *
 * - Polls every `pollMs` only while the page is visible; on return to the
 *   foreground it refreshes at once if the last answer is older than `pollMs`.
 * - Skips the queries entirely for a user with no coach link and no group
 *   (see getCoachLinkState, cached), which is most users.
 * - Refreshes instantly when a thread is opened/read (the
 *   `coach:unread-refresh` window event).
 * Degrades to 0 offline or pre-migration; each source is caught independently
 * so one failure does not zero the other.
 */
export function useUnreadMessages(pollMs = UNREAD_POLL_MS): number {
  // Starts at 0, not at the shared answer: which user that answer belongs to is
  // only known asynchronously, and a cached hit resolves within a microtask.
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const refresh = (maxAgeMs: number) => {
      void readUnreadCount(maxAgeMs).then((next) => {
        if (active) setCount(next);
      });
    };
    const startPolling = () => {
      if (timer !== undefined) return;
      // Half the period as the freshness bar, so a tick is never skipped
      // because the previous answer is a few milliseconds short of `pollMs`.
      timer = window.setInterval(() => refresh(pollMs / 2), pollMs);
    };
    const stopPolling = () => {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    };
    const onVisibilityChange = () => {
      if (isVisible()) {
        refresh(pollMs);
        startPolling();
      } else {
        stopPolling();
      }
    };
    const onExplicitRefresh = () => {
      // A thread was opened or read, or a message arrived in one: there IS a
      // link, and the count changed. A cached "no links" answer is therefore
      // stale; one that lists links is not, and dropping it here re-probed the
      // server on every incoming message.
      invalidateCoachLinkStateIfNoLinks();
      refresh(0);
    };
    // Links made or ended on this device, or a failed probe that now has an
    // answer (see getCoachLinkState): count again with the new state.
    const onLinkStateChange = () => refresh(0);

    if (isVisible()) {
      refresh(pollMs);
      startPolling();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('coach:unread-refresh', onExplicitRefresh);
    window.addEventListener(COACH_LINK_STATE_EVENT, onLinkStateChange);
    return () => {
      active = false;
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('coach:unread-refresh', onExplicitRefresh);
      window.removeEventListener(COACH_LINK_STATE_EVENT, onLinkStateChange);
    };
  }, [pollMs]);

  return count;
}

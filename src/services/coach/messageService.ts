// ============================================================================
// COACH PLATFORM — Message service (async threads)
// ============================================================================
// One thread per coach<->client pair. RLS restricts rows to the two parties;
// either side may send (sender_id = self) and mark received messages read.

import { readStoredAuthSession } from '../../lib/supabase';
import type { Message } from '../../types/coach';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { announceCoachLinkState, coachLinksGeneration } from './coachLinkEvents';
import { requireClient, toMessage } from './mappers';
import { sendCoachPush } from './pushService';
import { listClients } from './relationshipService';

export interface ClientThreadSummary {
  clientId: string;
  displayName: string;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
}

/** Most recent messages fetched per thread (desc + limit, reversed to asc). */
const THREAD_PAGE_SIZE = 200;

export interface ThreadPage {
  /** Chronological (oldest → newest) page of messages. */
  messages: Message[];
  /** True when an older page likely exists (the query returned a full page). */
  hasMore: boolean;
}

/**
 * One page of a thread, newest-first under the hood then reversed to
 * chronological order. Pass `before` (the createdAt of the oldest message you
 * already have) to fetch the previous page for "load earlier".
 */
export const getThreadPage = async (
  coachId: string,
  clientId: string,
  before?: string
): Promise<ThreadPage> => {
  const supabase = requireClient();
  let query = supabase
    .from('messages')
    .select('*')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(THREAD_PAGE_SIZE);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) {
    logger.db.error('getThreadPage failed', error);
    // Throw so the caller's catch can flip to an error/retry state — a failed
    // load must be distinguishable from an empty thread.
    throw new Error(error.message);
  }
  const rows = data ?? [];
  return { messages: rows.map(toMessage).reverse(), hasMore: rows.length === THREAD_PAGE_SIZE };
};

export const getThread = async (coachId: string, clientId: string): Promise<Message[]> =>
  (await getThreadPage(coachId, clientId)).messages;

export const sendMessage = async (
  coachId: string,
  clientId: string,
  body: string
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' };
  const trimmed = body.trim();
  if (!trimmed) return { error: 'empty' };
  if (trimmed.length > 5000) return { error: 'message_too_long' };

  const { error } = await supabase.from('messages').insert({
    coach_id: coachId,
    client_id: clientId,
    sender_id: user.id,
    body: trimmed,
  });
  if (!error) {
    // Notify the other party with the app closed; deep-link to their thread view.
    const senderIsCoach = user.id === coachId;
    const recipient = senderIsCoach ? clientId : coachId;
    const url = senderIsCoach ? `/my-coach/messages/${coachId}` : `/coach/messages/${clientId}`;
    void sendCoachPush(recipient, 'הודעה חדשה', trimmed.slice(0, 140), url);
  }
  return { error: error?.message ?? null };
};

/** Outcome of a bulk-nudge send: which clients succeeded vs failed. */
export interface BulkSendResult {
  sent: string[];
  failed: { clientId: string; error: string }[];
}

/** Hard cap on a single bulk-nudge to avoid a runaway fan-out of inserts. */
export const BULK_NUDGE_MAX = 30;

/**
 * Send the SAME message to several clients (a roster "nudge"). The current user
 * is the coach side of every thread. Runs the inserts concurrently and reports
 * per-client success/failure so the UI can surface a partial-failure summary —
 * one failed client never aborts the rest. No new endpoint: reuses sendMessage.
 */
export const sendBulkMessage = async (
  clientIds: readonly string[],
  body: string
): Promise<BulkSendResult> => {
  const trimmed = body.trim();
  const result: BulkSendResult = { sent: [], failed: [] };
  if (!trimmed) {
    for (const clientId of clientIds) result.failed.push({ clientId, error: 'empty' });
    return result;
  }
  const user = await getCurrentUser();
  if (!user) {
    for (const clientId of clientIds) result.failed.push({ clientId, error: 'unauthenticated' });
    return result;
  }
  const targets = clientIds.slice(0, BULK_NUDGE_MAX);
  const outcomes = await Promise.all(
    targets.map(async (clientId) => {
      const { error } = await sendMessage(user.id, clientId, trimmed);
      return { clientId, error };
    })
  );
  for (const o of outcomes) {
    if (o.error) result.failed.push({ clientId: o.clientId, error: o.error });
    else result.sent.push(o.clientId);
  }
  return result;
};

/** Mark all messages in a thread that were NOT sent by me as read. */
export const markThreadRead = async (coachId: string, clientId: string): Promise<void> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return;
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .neq('sender_id', user.id)
    .is('read_at', null);
  if (error) logger.db.error('markThreadRead failed', error);
};

/** Per-thread reduction shape shared by the RPC path and the JS fallback. */
interface ThreadReduction {
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
}

/**
 * Fallback reduction: ONE bounded messages query reduced in JS. Only used when
 * the `coach_thread_summaries` RPC is unavailable (e.g. migration not applied);
 * preview/unread become approximate past the 500-row window. Returns null when
 * the query itself fails so the caller can bail instead of rendering a roster
 * of fake "no messages" rows.
 */
const reduceThreadsFallback = async (
  supabase: ReturnType<typeof requireClient>,
  userId: string,
  nameMap: Map<string, string>
): Promise<Map<string, ThreadReduction> | null> => {
  const { data: rows, error } = await supabase
    .from('messages')
    .select('client_id, sender_id, body, created_at, read_at')
    .eq('coach_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    logger.db.error('listClientThreads fallback failed', error);
    return null;
  }

  // Iterate newest-first so the first message per client is the latest one.
  const seen = new Map<string, ThreadReduction>();
  for (const row of rows ?? []) {
    const cid = row.client_id as string;
    if (!nameMap.has(cid)) continue; // skip rows for inactive/removed clients
    const existing = seen.get(cid);
    if (!existing) {
      seen.set(cid, {
        lastBody: (row.body as string | null) ?? null,
        lastAt: (row.created_at as string | null) ?? null,
        unread: row.sender_id !== userId && row.read_at === null ? 1 : 0,
      });
    } else if (row.sender_id !== userId && row.read_at === null) {
      existing.unread += 1;
    }
  }
  return seen;
};

/**
 * Return one summary row per active client thread, sorted: unread first, then
 * lastAt desc, then displayName. ONE roster fetch + ONE `coach_thread_summaries`
 * RPC (exact last-message/unread computed in the DB, no row-window cap); falls
 * back to a bounded scan when the RPC is unavailable.
 */
export const listClientThreads = async (): Promise<ClientThreadSummary[]> => {
  let supabase: ReturnType<typeof requireClient>;
  try {
    supabase = requireClient();
  } catch {
    return [];
  }
  const user = await getCurrentUser();
  if (!user) return [];

  // ONE roster fetch — reuses the established listClients pattern.
  const clients = await listClients('active');
  if (clients.length === 0) return [];

  // Build a map: clientId -> displayName for fast lookup during reduction.
  const nameMap = new Map<string, string>();
  for (const c of clients) {
    nameMap.set(c.clientId, c.clientProfile?.displayName ?? 'מתאמן');
  }

  let seen: Map<string, ThreadReduction>;
  const { data: rpcRows, error: rpcError } = await supabase.rpc('coach_thread_summaries');
  if (!rpcError && Array.isArray(rpcRows)) {
    seen = new Map(
      (
        rpcRows as {
          client_id: string;
          last_body: string | null;
          last_at: string | null;
          unread: number | string | null;
        }[]
      )
        .filter((r) => nameMap.has(r.client_id))
        .map((r) => [
          r.client_id,
          {
            lastBody: r.last_body ?? null,
            lastAt: r.last_at ?? null,
            unread: Number(r.unread) || 0,
          },
        ])
    );
  } else {
    logger.db.error('coach_thread_summaries RPC failed, using fallback', rpcError);
    const fallback = await reduceThreadsFallback(supabase, user.id, nameMap);
    if (fallback === null) return []; // both paths failed — surface emptiness, not fake rows
    seen = fallback;
  }

  // Build the result list, including clients with no messages yet.
  const result: ClientThreadSummary[] = [];
  for (const [clientId, displayName] of nameMap) {
    const summary = seen.get(clientId);
    result.push({
      clientId,
      displayName,
      lastBody: summary?.lastBody ?? null,
      lastAt: summary?.lastAt ?? null,
      unread: summary?.unread ?? 0,
    });
  }

  // Sort: unread first, then lastAt desc (nulls last), then displayName.
  result.sort((a, b) => {
    if (b.unread !== a.unread) return b.unread - a.unread;
    if (a.lastAt && b.lastAt) return b.lastAt.localeCompare(a.lastAt);
    if (a.lastAt) return -1;
    if (b.lastAt) return 1;
    return a.displayName.localeCompare(b.displayName, 'he');
  });

  return result;
};

/**
 * Per-client unread counts for the current coach: messages where this user is
 * the recipient (sender is the other party) and read_at is null, grouped by
 * client_id. ONE bounded query reduced in JS — mirrors getUnreadCount's filter,
 * no N+1. Clients with zero unread are simply absent from the map.
 */
export const getUnreadCountByClient = async (): Promise<Record<string, number>> => {
  let supabase: ReturnType<typeof requireClient>;
  try {
    supabase = requireClient();
  } catch {
    return {};
  }
  const user = await getCurrentUser();
  if (!user) return {};

  const { data, error } = await supabase
    .from('messages')
    .select('client_id')
    .eq('coach_id', user.id)
    .neq('sender_id', user.id)
    .is('read_at', null)
    .limit(1000);
  if (error) {
    logger.db.error('getUnreadCountByClient failed', error);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const cid = (row as { client_id: string }).client_id;
    counts[cid] = (counts[cid] ?? 0) + 1;
  }
  return counts;
};

// ---------------------------------------------------------------------------
// Coach-link state — can anyone else reach this user?
// ---------------------------------------------------------------------------
//
// Several background features only make sense when somebody else can write to
// this user's data or message them: the unread-messages poll, and the Realtime
// channels that reflect a coach's edits. For a self-guided user — most users —
// they were pure load on an overloaded database (a 30 s poll of 3–5 queries, and
// eight Realtime channels). This answers "is there anyone?" once, cheaply, and
// caches it.

/** One ACTIVE coach-client link, in either role. */
export interface CoachLink {
  coachId: string;
  clientId: string;
}

export interface CoachLinkState {
  /** Every active link this user is part of, as coach or as client. */
  links: readonly CoachLink[];
  /** Coaches with an active link where this user is the CLIENT — they can edit this user's data. */
  coachIds: readonly string[];
  /** True when this user coaches at least one active client. */
  hasClients: boolean;
  /** True when this user owns or belongs to at least one group chat. */
  hasGroups: boolean;
}

/** True when the user has anyone to exchange messages with. */
export const hasMessagingPeers = (state: CoachLinkState): boolean =>
  state.links.length > 0 || state.hasGroups;

/**
 * How long a known answer is reused. Links and groups change rarely, and a
 * change made on this device (an invite accepted, a disconnect) drops it at once
 * (notifyCoachLinksChanged in ./coachLinkEvents).
 */
const LINK_STATE_TTL_MS = 10 * 60_000;
/**
 * After failed probes in a row, how long before asking again: 1, 2, then every
 * 5 minutes — the server may be struggling. While the page is visible a timer
 * asks on its own, so a coach-linked user whose first probe failed still gets
 * live coach edits without having to leave and come back to the app.
 */
const LINK_STATE_RETRY_MS = [60_000, 120_000, 300_000] as const;
const LINK_STATE_MAX_RETRY_MS = 300_000;

const retryDelayFor = (failures: number): number =>
  LINK_STATE_RETRY_MS[Math.min(Math.max(failures, 1), LINK_STATE_RETRY_MS.length) - 1] ??
  LINK_STATE_MAX_RETRY_MS;

interface LinkStateCacheEntry {
  userId: string;
  state: CoachLinkState | null;
  at: number;
  /** coachLinksGeneration() when the probe STARTED: a link change since makes it stale. */
  generation: number;
}

let linkStateCache: LinkStateCacheEntry | null = null;
let linkStateInFlight: {
  userId: string;
  generation: number;
  promise: Promise<CoachLinkState | null>;
} | null = null;
/** Probes in a row that could not get an answer (failed, or auth could not name the user). */
let linkProbeFailures = 0;
let linkStateRetryTimer: ReturnType<typeof setTimeout> | null = null;

const clearLinkStateRetry = (): void => {
  if (linkStateRetryTimer !== null) clearTimeout(linkStateRetryTimer);
  linkStateRetryTimer = null;
};

/**
 * The state could not be learned: count it and ask again after the backoff, if
 * the page is on screen then. Counted once per retry, not once per caller — the
 * unread badge, the reflection hook and the day card all ask on mount, and
 * three "unknown"s at once must not jump the backoff to five minutes. A hidden
 * page is left alone: every surface re-reads the state when it comes back to
 * the foreground, and that read probes once the backoff has passed.
 */
const noteLinkStateUnknown = (): void => {
  if (typeof window === 'undefined' || linkStateRetryTimer !== null) return;
  linkProbeFailures++;
  linkStateRetryTimer = setTimeout(() => {
    linkStateRetryTimer = null;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    void getCoachLinkState();
  }, retryDelayFor(linkProbeFailures));
};

/** Forget the cached answer, so the next `getCoachLinkState()` asks the server. */
export const invalidateCoachLinkState = (): void => {
  linkStateCache = null;
  linkProbeFailures = 0;
  clearLinkStateRetry();
};

/**
 * Forget the cached answer only when it says this user has NO link. An open or
 * read thread proves a link exists, so a "nobody" answer is stale; a cached
 * answer that already lists links is right, and dropping it on every incoming
 * message only re-probed the server for nothing.
 */
export const invalidateCoachLinkStateIfNoLinks = (): void => {
  if (linkStateCache?.state && linkStateCache.state.links.length === 0) {
    invalidateCoachLinkState();
  }
};

/** A session is stored on this device, so a "no user" from auth is a lookup failure, not a sign-out. */
const isSignedInOnThisDevice = (): boolean => {
  try {
    return readStoredAuthSession() !== null;
  } catch {
    return false;
  }
};

/** Three tiny reads, no automatic retries (the cache decides when to ask again). */
const probeCoachLinkState = async (
  supabase: ReturnType<typeof requireClient>,
  userId: string
): Promise<CoachLinkState | null> => {
  const [links, ownedGroups, memberGroups] = await Promise.all([
    supabase
      .from('coach_clients')
      .select('coach_id, client_id')
      .or(`coach_id.eq.${userId},client_id.eq.${userId}`)
      .eq('status', 'active')
      .retry(false),
    supabase.from('client_groups').select('id').eq('coach_id', userId).limit(1).retry(false),
    supabase
      .from('client_group_members')
      .select('group_id')
      .eq('client_id', userId)
      .limit(1)
      .retry(false),
  ]);
  const failure = links.error ?? ownedGroups.error ?? memberGroups.error;
  if (failure) {
    logger.db.warn('Coach link probe failed', failure);
    return null;
  }

  const active: CoachLink[] = ((links.data ?? []) as { coach_id: string; client_id: string }[]).map(
    (row) => ({ coachId: row.coach_id, clientId: row.client_id })
  );
  return {
    links: active,
    coachIds: [...new Set(active.filter((l) => l.clientId === userId).map((l) => l.coachId))],
    hasClients: active.some((l) => l.coachId === userId),
    hasGroups: (ownedGroups.data?.length ?? 0) > 0 || (memberGroups.data?.length ?? 0) > 0,
  };
};

/**
 * This user's coach links and groups, cached for LINK_STATE_TTL_MS (per user)
 * and shared by every caller — one probe in flight at a time. Resolves null when
 * it is not known: signed out, offline, or the probe failed (then asked again
 * after 1, 2, 5 minutes — see LINK_STATE_RETRY_MS — and COACH_LINK_STATE_EVENT
 * fires once it is known). Callers treat null as "do nothing new now".
 */
export const getCoachLinkState = async (): Promise<CoachLinkState | null> => {
  let supabase: ReturnType<typeof requireClient>;
  try {
    supabase = requireClient();
  } catch {
    return null;
  }
  const user = await getCurrentUser().catch(() => null);
  if (!user) {
    // Signed in here but auth could not name the user (a refresh cooldown on an
    // overloaded server): unknown, not "nobody" — try again later.
    if (isSignedInOnThisDevice()) noteLinkStateUnknown();
    return null;
  }
  const userId = user.id;
  const generation = coachLinksGeneration();

  const cached = linkStateCache;
  if (cached?.userId === userId && cached.generation === generation) {
    const ttl = cached.state ? LINK_STATE_TTL_MS : retryDelayFor(linkProbeFailures);
    if (Date.now() - cached.at < ttl) return cached.state;
  }
  if (linkStateInFlight?.userId === userId && linkStateInFlight.generation === generation) {
    return linkStateInFlight.promise;
  }

  const promise: Promise<CoachLinkState | null> = probeCoachLinkState(supabase, userId)
    .catch((err) => {
      logger.db.warn('Coach link probe threw', err);
      return null;
    })
    .then((state) => {
      // A link changed while this probe was on the wire: its answer may predate
      // the change, so it must not overwrite the newer probe's.
      if (generation !== coachLinksGeneration()) return state;
      const recovered = state !== null && linkProbeFailures > 0;
      linkStateCache = { userId, state, at: Date.now(), generation };
      if (state === null) {
        noteLinkStateUnknown();
      } else {
        linkProbeFailures = 0;
        clearLinkStateRetry();
        // Surfaces that read null meanwhile are waiting for this answer.
        if (recovered) announceCoachLinkState();
      }
      return state;
    })
    .finally(() => {
      if (linkStateInFlight?.promise === promise) linkStateInFlight = null;
    });
  linkStateInFlight = { userId, generation, promise };
  return promise;
};

/**
 * Count of unread messages addressed to the current user across active
 * relationships only. Pass `knownLinks` (from getCoachLinkState) to skip the
 * links lookup. Background poll: no automatic retries.
 */
export const getUnreadCount = async (knownLinks?: readonly CoachLink[]): Promise<number> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return 0;

  let activeLinks: readonly CoachLink[] = knownLinks ?? [];
  if (!knownLinks) {
    // Fetch active relationship pairs for this user
    const { data, error: linksError } = await supabase
      .from('coach_clients')
      .select('coach_id, client_id')
      .or(`coach_id.eq.${user.id},client_id.eq.${user.id}`)
      .eq('status', 'active')
      .retry(false);
    if (linksError || !data?.length) return 0;
    activeLinks = (data as { coach_id: string; client_id: string }[]).map((l) => ({
      coachId: l.coach_id,
      clientId: l.client_id,
    }));
  }
  if (activeLinks.length === 0) return 0;

  // Build an OR filter for each active thread
  const threadFilters = activeLinks
    .map((l) => `and(coach_id.eq.${l.coachId},client_id.eq.${l.clientId})`)
    .join(',');

  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .neq('sender_id', user.id)
    .is('read_at', null)
    .or(threadFilters)
    .retry(false);
  if (error) {
    logger.db.error('getUnreadCount failed', error);
    return 0;
  }
  return count ?? 0;
};

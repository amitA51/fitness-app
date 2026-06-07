// ============================================================================
// COACH PLATFORM — Message service (async threads)
// ============================================================================
// One thread per coach<->client pair. RLS restricts rows to the two parties;
// either side may send (sender_id = self) and mark received messages read.

import type { Message } from '../../types/coach';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
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

export const getThread = async (coachId: string, clientId: string): Promise<Message[]> => {
  const supabase = requireClient();
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('coach_id', coachId)
    .eq('client_id', clientId)
    .order('created_at', { ascending: true });
  if (error) {
    logger.db.error('getThread failed', error);
    return [];
  }
  return (data ?? []).map(toMessage);
};

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

/**
 * Return one summary row per active client thread, sorted: unread first, then
 * lastAt desc, then displayName. Uses ONE roster fetch + ONE bounded messages
 * query — no N+1 queries.
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

  // ONE bounded messages query for all active threads belonging to this coach.
  // We only need the columns required for preview + unread computation.
  const { data: rows, error } = await supabase
    .from('messages')
    .select('client_id, sender_id, body, created_at, read_at')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    logger.db.error('listClientThreads failed', error);
    return [];
  }

  // Reduce in JS to per-client summary. We iterate newest-first so the first
  // message we encounter per client is already the latest one.
  const seen = new Map<
    string,
    { lastBody: string | null; lastAt: string | null; unread: number }
  >();

  for (const row of rows ?? []) {
    const cid = row.client_id as string;
    if (!nameMap.has(cid)) continue; // skip rows for inactive/removed clients
    const existing = seen.get(cid);
    if (!existing) {
      // First (= latest) message for this client.
      seen.set(cid, {
        lastBody: (row.body as string | null) ?? null,
        lastAt: (row.created_at as string | null) ?? null,
        unread: row.sender_id !== user.id && row.read_at === null ? 1 : 0,
      });
    } else {
      // Subsequent messages: only accumulate unread count.
      if (row.sender_id !== user.id && row.read_at === null) {
        existing.unread += 1;
      }
    }
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

/** Count of unread messages addressed to the current user across active relationships only. */
export const getUnreadCount = async (): Promise<number> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return 0;

  // Fetch active relationship pairs for this user
  const { data: activeLinks, error: linksError } = await supabase
    .from('coach_clients')
    .select('coach_id, client_id')
    .or(`coach_id.eq.${user.id},client_id.eq.${user.id}`)
    .eq('status', 'active');
  if (linksError || !activeLinks?.length) return 0;

  // Build an OR filter for each active thread
  const threadFilters = activeLinks
    .map(
      (l: { coach_id: string; client_id: string }) =>
        `and(coach_id.eq.${l.coach_id},client_id.eq.${l.client_id})`
    )
    .join(',');

  const { count, error } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .neq('sender_id', user.id)
    .is('read_at', null)
    .or(threadFilters);
  if (error) {
    logger.db.error('getUnreadCount failed', error);
    return 0;
  }
  return count ?? 0;
};

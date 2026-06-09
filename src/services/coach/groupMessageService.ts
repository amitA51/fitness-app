// ============================================================================
// COACH PLATFORM — Group message service
// ============================================================================
// One thread per client_group — coach and all members can read and post.
// Read-state: coach stamps client_groups.coach_last_read_at;
// each member stamps client_group_members.last_read_at.

import type { GroupMessage, GroupThreadSummary } from '../../types/coach';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import { requireClient, toGroupMessage } from './mappers';
import { sendCoachPush } from './pushService';

// ---------------------------------------------------------------------------
// getGroupThread
// ---------------------------------------------------------------------------

/** Most recent messages fetched per page (desc + limit, reversed to asc). */
const GROUP_PAGE_SIZE = 200;

export interface GroupThreadPage {
  /** Chronological (oldest → newest) page of messages. */
  messages: GroupMessage[];
  /** True when an older page likely exists (the query returned a full page). */
  hasMore: boolean;
}

/**
 * One page of a group thread, oldest first. Pass `before` (the createdAt of
 * the oldest message you already have) to fetch the previous page.
 */
export const getGroupThreadPage = async (
  groupId: string,
  before?: string
): Promise<GroupThreadPage> => {
  const supabase = requireClient();
  let query = supabase
    .from('group_messages')
    .select('*')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(GROUP_PAGE_SIZE);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) {
    logger.db.error('getGroupThreadPage failed', error);
    // Throw so GroupThread's catch reaches SectionError — a failed load must
    // not look like an empty thread. (listGroupThreads still returns [].)
    throw new Error(error.message);
  }
  const rows = (data ?? []) as Record<string, unknown>[];
  return { messages: rows.map(toGroupMessage).reverse(), hasMore: rows.length === GROUP_PAGE_SIZE };
};

/** All recent messages in a group thread, oldest first (latest page only). */
export const getGroupThread = async (groupId: string): Promise<GroupMessage[]> =>
  (await getGroupThreadPage(groupId)).messages;

// ---------------------------------------------------------------------------
// sendGroupMessage
// ---------------------------------------------------------------------------

/**
 * Insert a message into the group thread, then best-effort push all other
 * participants. Never throws — push failures are swallowed.
 */
export const sendGroupMessage = async (
  groupId: string,
  body: string
): Promise<{ error: string | null }> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' };

  const trimmed = body.trim();
  if (!trimmed) return { error: 'empty' };
  if (trimmed.length > 5000) return { error: 'message_too_long' };

  const { error } = await supabase
    .from('group_messages')
    .insert({ group_id: groupId, sender_id: user.id, body: trimmed });

  if (error) return { error: error.message };

  // Best-effort push — never throws, never awaited by caller.
  void (async () => {
    try {
      // Fetch the group's coach_id.
      const { data: groupRow } = await supabase
        .from('client_groups')
        .select('coach_id')
        .eq('id', groupId)
        .single();

      // Fetch all member ids.
      const { data: memberRows } = await supabase
        .from('client_group_members')
        .select('client_id')
        .eq('group_id', groupId);

      const coachId = (groupRow as { coach_id: string } | null)?.coach_id ?? null;
      const memberIds = ((memberRows ?? []) as { client_id: string }[]).map((r) => r.client_id);

      const title = 'הודעה חדשה בקבוצה';
      const preview = trimmed.slice(0, 140);
      const senderIsCoach = user.id === coachId;

      if (senderIsCoach) {
        // Coach sent → push every member (skip self).
        for (const memberId of memberIds) {
          if (memberId === user.id) continue;
          void sendCoachPush(memberId, title, preview, `/my-coach/groups/${groupId}/chat`);
        }
      } else {
        // Member sent → push the coach (if any, skip if sender is the coach).
        if (coachId && coachId !== user.id) {
          void sendCoachPush(coachId, title, preview, `/coach/groups/${groupId}/chat`);
        }
      }
    } catch (err) {
      logger.app.warn('sendGroupMessage push failed', err);
    }
  })();

  return { error: null };
};

// ---------------------------------------------------------------------------
// markGroupThreadRead
// ---------------------------------------------------------------------------

/**
 * Stamp the read cursor for the viewer.
 * coach  → updates client_groups.coach_last_read_at
 * member → updates client_group_members.last_read_at for their own row
 */
export const markGroupThreadRead = async (
  groupId: string,
  viewer: 'coach' | 'member'
): Promise<void> => {
  const supabase = requireClient();
  const user = await getCurrentUser();
  if (!user) return;

  const now = new Date().toISOString();

  if (viewer === 'coach') {
    const { error } = await supabase
      .from('client_groups')
      .update({ coach_last_read_at: now })
      .eq('id', groupId);
    if (error) logger.db.error('markGroupThreadRead (coach) failed', error);
  } else {
    const { error } = await supabase
      .from('client_group_members')
      .update({ last_read_at: now })
      .eq('group_id', groupId)
      .eq('client_id', user.id);
    if (error) logger.db.error('markGroupThreadRead (member) failed', error);
  }
};

// ---------------------------------------------------------------------------
// listGroupThreads
// ---------------------------------------------------------------------------

/**
 * Return one summary row per group the viewer participates in.
 * Uses ONE bounded group_messages query for all groups — no N+1 queries.
 * Sort: unread desc, lastAt desc, name he.
 */
export const listGroupThreads = async (
  viewer: 'coach' | 'member'
): Promise<GroupThreadSummary[]> => {
  let supabase: ReturnType<typeof requireClient>;
  try {
    supabase = requireClient();
  } catch {
    return [];
  }
  const user = await getCurrentUser();
  if (!user) return [];

  // ------------------------------------------------------------------
  // 1. Fetch the groups relevant to this viewer + their lastRead stamp.
  // ------------------------------------------------------------------
  interface GroupMeta {
    groupId: string;
    name: string;
    lastRead: string | null;
  }

  const groupMetas: GroupMeta[] = [];

  if (viewer === 'coach') {
    const { data, error } = await supabase
      .from('client_groups')
      .select('id, name, coach_last_read_at')
      .eq('coach_id', user.id);
    if (error) {
      logger.db.error('listGroupThreads (coach) groups fetch failed', error);
      return [];
    }
    for (const row of (data ?? []) as {
      id: string;
      name: string;
      coach_last_read_at: string | null;
    }[]) {
      groupMetas.push({ groupId: row.id, name: row.name, lastRead: row.coach_last_read_at });
    }
  } else {
    // Member: fetch their membership rows then resolve group names.
    const { data: memberRows, error: memberErr } = await supabase
      .from('client_group_members')
      .select('group_id, last_read_at')
      .eq('client_id', user.id);
    if (memberErr) {
      logger.db.error('listGroupThreads (member) memberships fetch failed', memberErr);
      return [];
    }

    const rows = (memberRows ?? []) as { group_id: string; last_read_at: string | null }[];
    if (rows.length === 0) return [];

    const ids = rows.map((r) => r.group_id);
    const { data: groupRows, error: groupErr } = await supabase
      .from('client_groups')
      .select('id, name')
      .in('id', ids);
    if (groupErr) {
      logger.db.error('listGroupThreads (member) group names fetch failed', groupErr);
      return [];
    }

    const nameMap = new Map<string, string>();
    for (const g of (groupRows ?? []) as { id: string; name: string }[]) {
      nameMap.set(g.id, g.name);
    }

    for (const r of rows) {
      groupMetas.push({
        groupId: r.group_id,
        name: nameMap.get(r.group_id) ?? r.group_id,
        lastRead: r.last_read_at,
      });
    }
  }

  if (groupMetas.length === 0) return [];

  // ------------------------------------------------------------------
  // 2. Per-group aggregate: ONE `group_thread_summaries` RPC (exact
  //    last-message/unread computed in the DB, per read-cursor role);
  //    falls back to a bounded scan + JS reduction if unavailable.
  // ------------------------------------------------------------------
  const seen = new Map<
    string,
    { lastBody: string | null; lastAt: string | null; unread: number }
  >();

  const { data: rpcRows, error: rpcError } = await supabase.rpc('group_thread_summaries');
  if (!rpcError && Array.isArray(rpcRows)) {
    for (const row of rpcRows as {
      group_id: string;
      role: string;
      last_body: string | null;
      last_at: string | null;
      unread: number | string | null;
    }[]) {
      // The RPC returns one row per (group, role) — keep only the viewer's role
      // so the unread count uses the right read cursor.
      if (row.role !== viewer) continue;
      seen.set(row.group_id, {
        lastBody: row.last_body ?? null,
        lastAt: row.last_at ?? null,
        unread: Number(row.unread) || 0,
      });
    }
  } else {
    logger.db.error('group_thread_summaries RPC failed, using fallback', rpcError);

    const groupIds = groupMetas.map((g) => g.groupId);
    const { data: msgRows, error: msgErr } = await supabase
      .from('group_messages')
      .select('group_id, sender_id, body, created_at')
      .in('group_id', groupIds)
      .order('created_at', { ascending: false })
      .limit(500);

    if (msgErr) {
      logger.db.error('listGroupThreads messages fetch failed', msgErr);
      return [];
    }

    // Reduce in JS — newest-first, so first hit per group = preview.
    const lastReadMap = new Map<string, string | null>(
      groupMetas.map((g) => [g.groupId, g.lastRead])
    );

    for (const row of (msgRows ?? []) as {
      group_id: string;
      sender_id: string;
      body: string;
      created_at: string;
    }[]) {
      const gid = row.group_id;
      const lastRead = lastReadMap.get(gid) ?? null;
      const isIncoming = row.sender_id !== user.id;
      const isUnread = isIncoming && (lastRead === null || row.created_at > lastRead);

      const existing = seen.get(gid);
      if (!existing) {
        seen.set(gid, {
          lastBody: row.body,
          lastAt: row.created_at,
          unread: isUnread ? 1 : 0,
        });
      } else if (isUnread) {
        existing.unread += 1;
      }
    }
  }

  // ------------------------------------------------------------------
  // 4. Build result list (include groups with no messages).
  // ------------------------------------------------------------------
  const result: GroupThreadSummary[] = groupMetas.map((g) => {
    const s = seen.get(g.groupId);
    return {
      groupId: g.groupId,
      name: g.name,
      lastBody: s?.lastBody ?? null,
      lastAt: s?.lastAt ?? null,
      unread: s?.unread ?? 0,
    };
  });

  result.sort((a, b) => {
    if (b.unread !== a.unread) return b.unread - a.unread;
    if (a.lastAt && b.lastAt) return b.lastAt.localeCompare(a.lastAt);
    if (a.lastAt) return -1;
    if (b.lastAt) return 1;
    return a.name.localeCompare(b.name, 'he');
  });

  return result;
};

// ---------------------------------------------------------------------------
// getGroupUnreadCount
// ---------------------------------------------------------------------------

/**
 * Total unread group messages for the current user across both roles
 * (owned groups + group memberships). Groups where the user appears in both
 * roles are deduplicated by groupId — each relation uses its own lastRead cursor.
 */
export const getGroupUnreadCount = async (): Promise<number> => {
  let supabase: ReturnType<typeof requireClient>;
  try {
    supabase = requireClient();
  } catch {
    return 0;
  }
  const user = await getCurrentUser();
  if (!user) return 0;

  // Collect (groupId → lastRead) for each role independently.
  // A user can appear as both coach (owns the group) and member (rare but
  // possible in tests/dev). We keep them separate: the coach cursor differs
  // from the member cursor so we compute each and then deduplicate by groupId,
  // summing only the first occurrence we encounter (coach role wins if both).

  const coachEntries = new Map<string, string | null>();
  const memberEntries = new Map<string, string | null>();

  const [coachResult, memberResult] = await Promise.all([
    supabase.from('client_groups').select('id, coach_last_read_at').eq('coach_id', user.id),
    supabase.from('client_group_members').select('group_id, last_read_at').eq('client_id', user.id),
  ]);

  for (const row of (coachResult.data ?? []) as {
    id: string;
    coach_last_read_at: string | null;
  }[]) {
    coachEntries.set(row.id, row.coach_last_read_at);
  }
  for (const row of (memberResult.data ?? []) as {
    group_id: string;
    last_read_at: string | null;
  }[]) {
    memberEntries.set(row.group_id, row.last_read_at);
  }

  // Merge: coach role takes priority when both exist for the same group.
  const merged = new Map<string, string | null>(coachEntries);
  for (const [gid, lastRead] of memberEntries) {
    if (!merged.has(gid)) merged.set(gid, lastRead);
  }

  if (merged.size === 0) return 0;

  const groupIds = [...merged.keys()];

  const { data: msgRows, error } = await supabase
    .from('group_messages')
    .select('group_id, sender_id, created_at')
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    logger.db.error('getGroupUnreadCount failed', error);
    return 0;
  }

  let total = 0;
  for (const row of (msgRows ?? []) as {
    group_id: string;
    sender_id: string;
    created_at: string;
  }[]) {
    if (row.sender_id === user.id) continue;
    const lastRead = merged.get(row.group_id) ?? null;
    if (lastRead === null || row.created_at > lastRead) total += 1;
  }

  return total;
};

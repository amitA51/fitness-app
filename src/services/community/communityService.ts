// ============================================================================
// COMMUNITY SERVICE — CRUD + feed for the trainee social layer.
//
// Schema: 20260611000000_community.sql (posts, post_comments, post_reactions,
// post_reports, user_blocks, follows). RPCs: create_post, create_comment
// (rate-limited; direct INSERT policy dropped), toggle_like, report_content,
// block_user.
//
// FAIL-SAFE-INERT: every call is wrapped so a missing table/RPC returns safe
// defaults (empty list / no-op) without throwing to the UI. The app keeps
// running before this migration is applied.
// ============================================================================

import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import type {
  BlockedUser,
  CreatePostInput,
  FeedItem,
  Post,
  PostComment,
  ReportInput,
} from './types';

const log = logger.db;

type Row = Record<string, unknown>;

// ── Mappers ──────────────────────────────────────────────────────────────────

const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const asNumber = (v: unknown): number => (typeof v === 'number' ? v : 0);
const asBool = (v: unknown): boolean => v === true;

/**
 * True when a PostgREST error is the app-layer rate limit raised by the
 * create_post / create_comment RPCs (`RAISE EXCEPTION 'rate_limited'`). The
 * message carries the literal; PostgREST surfaces a raised exception as code
 * 'P0001', so we also treat that as rate-limited when the message matches.
 */
function isRateLimited(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = error.message ?? '';
  if (message.includes('rate_limited')) return true;
  return error.code === 'rate_limited';
}

/** Dedupes and drops null ids from a list of nullable string ids. */
const uniqueIds = (ids: (string | null)[]): string[] => [
  ...new Set(ids.filter((id): id is string => id !== null)),
];

function toPost(r: Row, myId: string | null): Post {
  return {
    id: asString(r.id) ?? '',
    authorId: asString(r.author_id) ?? '',
    authorName: asString(r.author_name) ?? undefined,
    body: asString(r.body) ?? '',
    topic: asString(r.topic),
    imageUrl: asString(r.image_url),
    likeCount: asNumber(r.like_count),
    commentCount: asNumber(r.comment_count),
    createdAt: asString(r.created_at) ?? '',
    likedByMe: myId ? asBool(r.liked_by_me) : false,
  };
}

function toComment(r: Row): PostComment {
  return {
    id: asString(r.id) ?? '',
    postId: asString(r.post_id) ?? '',
    authorId: asString(r.author_id) ?? '',
    authorName: asString(r.author_name) ?? undefined,
    body: asString(r.body) ?? '',
    createdAt: asString(r.created_at) ?? '',
  };
}

// ── Name resolution ───────────────────────────────────────────────────────────

/**
 * Batch-resolves author display names. posts.author_id / post_comments.author_id
 * FK auth.users (not profiles), so a PostgREST embed does not resolve — we map
 * id→display_name with a single `in(...)` query. Fail-safe: any failure yields an
 * empty map (names fall back to undefined at the UI layer), never throws.
 */
async function resolveAuthorNames(authorIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (!supabase || authorIds.length === 0) return names;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', authorIds);
    if (error) {
      log.error('resolveAuthorNames failed', error);
      return names;
    }
    for (const row of (data ?? []) as Row[]) {
      const id = asString(row.id);
      const name = asString(row.display_name);
      if (id && name) names.set(id, name);
    }
    return names;
  } catch (err) {
    log.error('resolveAuthorNames threw', err);
    return names;
  }
}

/**
 * The subset of postIds the given user has liked, resolved with a single query
 * scoped to that user's own reactions (no O(N) full-table read, no cross-user
 * data leak). Fail-safe: any failure yields an empty set (likedByMe = false).
 */
async function resolveLikedPostIds(myId: string, postIds: string[]): Promise<Set<string>> {
  const liked = new Set<string>();
  if (!supabase || postIds.length === 0) return liked;
  try {
    const { data, error } = await supabase
      .from('post_reactions')
      .select('post_id')
      .eq('user_id', myId)
      .in('post_id', postIds);
    if (error) {
      log.error('resolveLikedPostIds failed', error);
      return liked;
    }
    for (const row of (data ?? []) as Row[]) {
      const id = asString(row.post_id);
      if (id) liked.add(id);
    }
    return liked;
  } catch (err) {
    log.error('resolveLikedPostIds threw', err);
    return liked;
  }
}

// ── Feed ─────────────────────────────────────────────────────────────────────

/**
 * Latest posts for the feed, excluding content from blocked users (enforced by
 * RLS on the posts table). Display names are batch-resolved against profiles and
 * likedByMe is computed from the viewer's own reactions only. Returns an empty
 * array on any failure.
 */
export async function listFeedPosts(opts?: { limit?: number; before?: string }): Promise<
  FeedItem[]
> {
  if (!supabase) return [];
  try {
    const user = await getCurrentUser();
    const myId = user?.id ?? null;

    // RLS already filters blocked authors. We deliberately avoid embeds: the
    // author_id FK targets auth.users (not profiles) so profiles!… would not
    // resolve, and an unscoped post_reactions embed would read every reaction.
    let query = supabase
      .from('posts')
      .select('id, author_id, body, topic, image_url, like_count, comment_count, created_at')
      .order('created_at', { ascending: false })
      .limit(opts?.limit ?? 30);

    if (opts?.before) {
      query = query.lt('created_at', opts.before);
    }

    const { data, error } = await query;
    if (error) {
      log.error('listFeedPosts failed', error);
      return [];
    }

    const rows = (data ?? []) as Row[];
    const authorIds = uniqueIds(rows.map((r) => asString(r.author_id)));
    const postIds = rows.map((r) => asString(r.id)).filter((id): id is string => id !== null);

    const [names, likedIds] = await Promise.all([
      resolveAuthorNames(authorIds),
      myId ? resolveLikedPostIds(myId, postIds) : Promise.resolve(new Set<string>()),
    ]);

    return rows.map((raw) =>
      toPost(
        {
          ...raw,
          author_name: names.get(asString(raw.author_id) ?? '') ?? null,
          liked_by_me: likedIds.has(asString(raw.id) ?? ''),
        },
        myId
      )
    );
  } catch (err) {
    log.error('listFeedPosts threw', err);
    return [];
  }
}

// ── Create post ───────────────────────────────────────────────────────────────

export async function createPost(
  input: CreatePostInput
): Promise<{ post: Post | null; error: string | null }> {
  if (!supabase) return { post: null, error: 'unconfigured' };
  const user = await getCurrentUser();
  if (!user) return { post: null, error: 'unauthenticated' };

  try {
    // Direct INSERT policy was dropped — posts MUST be created via the
    // rate-limited create_post RPC, which returns the inserted row.
    const { data, error } = await supabase.rpc('create_post', {
      _body: input.body.trim(),
      _topic: input.topic ?? null,
      _image_url: input.imageUrl ?? null,
    });

    if (error) {
      if (isRateLimited(error)) return { post: null, error: 'rate_limited' };
      log.error('createPost failed', error);
      return { post: null, error: error.message };
    }

    return {
      post: toPost({ ...(data as Row), author_name: null, liked_by_me: false }, user.id),
      error: null,
    };
  } catch (err) {
    log.error('createPost threw', err);
    return { post: null, error: err instanceof Error ? err.message : 'create_failed' };
  }
}

// ── Toggle like (RPC) ─────────────────────────────────────────────────────────

/**
 * Calls the toggle_like RPC. Returns the new liked state (true = now liked).
 * Returns null on any failure (caller should treat as no-op).
 */
export async function toggleLike(postId: string): Promise<boolean | null> {
  if (!supabase || !postId) return null;
  try {
    const { data, error } = await supabase.rpc('toggle_like', { _post_id: postId });
    if (error) {
      log.error('toggleLike failed', error);
      return null;
    }
    return data as boolean;
  } catch (err) {
    log.error('toggleLike threw', err);
    return null;
  }
}

// ── Comments ──────────────────────────────────────────────────────────────────

export async function listComments(postId: string): Promise<PostComment[]> {
  if (!supabase || !postId) return [];
  try {
    // author_id FKs auth.users, not profiles — resolve names in one batch query.
    const { data, error } = await supabase
      .from('post_comments')
      .select('id, post_id, author_id, body, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      log.error('listComments failed', error);
      return [];
    }

    const rows = (data ?? []) as Row[];
    const authorIds = uniqueIds(rows.map((r) => asString(r.author_id)));
    const names = await resolveAuthorNames(authorIds);

    return rows.map((raw) =>
      toComment({ ...raw, author_name: names.get(asString(raw.author_id) ?? '') ?? null })
    );
  } catch (err) {
    log.error('listComments threw', err);
    return [];
  }
}

export async function addComment(
  postId: string,
  body: string
): Promise<{ comment: PostComment | null; error: string | null }> {
  if (!supabase) return { comment: null, error: 'unconfigured' };
  const user = await getCurrentUser();
  if (!user) return { comment: null, error: 'unauthenticated' };

  try {
    // Direct INSERT goes through the rate-limited create_comment RPC, which
    // returns the inserted post_comments row.
    const { data, error } = await supabase.rpc('create_comment', {
      _post_id: postId,
      _body: body.trim(),
    });

    if (error) {
      if (isRateLimited(error)) return { comment: null, error: 'rate_limited' };
      log.error('addComment failed', error);
      return { comment: null, error: error.message };
    }

    return {
      comment: toComment({ ...(data as Row), author_name: null }),
      error: null,
    };
  } catch (err) {
    log.error('addComment threw', err);
    return { comment: null, error: err instanceof Error ? err.message : 'comment_failed' };
  }
}

// ── Report (Apple Guideline 1.2, RPC) ────────────────────────────────────────

export async function reportContent(input: ReportInput): Promise<{ error: string | null }> {
  if (!supabase) return { error: null }; // silent no-op
  try {
    const { error } = await supabase.rpc('report_content', {
      _post_id: input.postId ?? null,
      _comment_id: input.commentId ?? null,
      _reason: input.reason ?? '',
    });
    if (error) {
      log.error('reportContent failed', error);
      return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    log.error('reportContent threw', err);
    return { error: null }; // fail-safe: don't surface to user
  }
}

// ── Block user (Apple Guideline 1.2, RPC) ────────────────────────────────────

export async function blockUser(blockedId: string): Promise<{ error: string | null }> {
  if (!supabase || !blockedId) return { error: null };
  try {
    const { error } = await supabase.rpc('block_user', { _blocked: blockedId });
    if (error) {
      log.error('blockUser failed', error);
      return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    log.error('blockUser threw', err);
    return { error: null }; // fail-safe
  }
}

/**
 * The users the current viewer has blocked, with display names batch-resolved
 * against profiles (blocked_id FKs auth.users, not profiles). RLS scopes
 * user_blocks to the caller's own rows. Returns [] on any failure (fail-safe).
 */
export async function listBlockedUsers(): Promise<BlockedUser[]> {
  if (!supabase) return [];
  try {
    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('user_blocks')
      .select('blocked_id, created_at')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      log.error('listBlockedUsers failed', error);
      return [];
    }

    const rows = (data ?? []) as Row[];
    const blockedIds = uniqueIds(rows.map((r) => asString(r.blocked_id)));
    if (blockedIds.length === 0) return [];

    const names = await resolveAuthorNames(blockedIds);

    return blockedIds.map((userId) => ({
      userId,
      displayName: names.get(userId) ?? undefined,
    }));
  } catch (err) {
    log.error('listBlockedUsers threw', err);
    return [];
  }
}

/**
 * Removes a block so the viewer sees that user's content again. RLS allows the
 * owner (blocker) to delete their own block rows. Fail-safe envelope.
 */
export async function unblockUser(blockedId: string): Promise<{ error: string | null }> {
  if (!supabase || !blockedId) return { error: null };
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' };
  try {
    const { error } = await supabase
      .from('user_blocks')
      .delete()
      .eq('blocker_id', user.id)
      .eq('blocked_id', blockedId);
    if (error) {
      log.error('unblockUser failed', error);
      return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    log.error('unblockUser threw', err);
    return { error: null }; // fail-safe
  }
}

// ── Follow / unfollow ─────────────────────────────────────────────────────────

export async function followUser(followeeId: string): Promise<{ error: string | null }> {
  if (!supabase || !followeeId) return { error: null };
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' };
  try {
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, followee_id: followeeId });
    if (error && error.code !== '23505') {
      // 23505 = unique_violation (already following) — treat as no-op
      log.error('followUser failed', error);
      return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    log.error('followUser threw', err);
    return { error: null };
  }
}

export async function unfollowUser(followeeId: string): Promise<{ error: string | null }> {
  if (!supabase || !followeeId) return { error: null };
  const user = await getCurrentUser();
  if (!user) return { error: 'unauthenticated' };
  try {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('followee_id', followeeId);
    if (error) {
      log.error('unfollowUser failed', error);
      return { error: error.message };
    }
    return { error: null };
  } catch (err) {
    log.error('unfollowUser threw', err);
    return { error: null };
  }
}

// ============================================================================
// COMMUNITY SERVICE — CRUD + feed for the trainee social layer.
//
// Schema: 20260611000000_community.sql (posts, post_comments, post_reactions,
// post_reports, user_blocks, follows). RPCs: toggle_like, report_content,
// block_user.
//
// FAIL-SAFE-INERT: every call is wrapped so a missing table/RPC returns safe
// defaults (empty list / no-op) without throwing to the UI. The app keeps
// running before this migration is applied.
// ============================================================================

import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import { getCurrentUser } from '../supabaseAuth';
import type { CreatePostInput, FeedItem, Post, PostComment, ReportInput } from './types';

const log = logger.db;

type Row = Record<string, unknown>;

// ── Mappers ──────────────────────────────────────────────────────────────────

const asString = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const asNumber = (v: unknown): number => (typeof v === 'number' ? v : 0);
const asBool = (v: unknown): boolean => v === true;

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

// ── Feed ─────────────────────────────────────────────────────────────────────

/**
 * Latest posts for the feed, excluding content from blocked users (enforced
 * by RLS on the posts table). Resolves display names via a left-join to the
 * profiles table. Returns an empty array on any failure.
 */
export async function listFeedPosts(opts?: { limit?: number; before?: string }): Promise<
  FeedItem[]
> {
  if (!supabase) return [];
  try {
    const user = await getCurrentUser();
    const myId = user?.id ?? null;

    // Build base query with a left join to profiles for display names.
    // RLS already filters blocked authors; we select the liked_by_me flag
    // via a correlated sub-select so we don't need a second round-trip.
    let query = supabase
      .from('posts')
      .select(
        `id, author_id, body, topic, image_url, like_count, comment_count, created_at,
         profiles!posts_author_id_fkey(display_name),
         post_reactions!left(user_id)`
      )
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

    return (data ?? []).map((r) => {
      const raw = r as unknown as Row & {
        profiles?: Row | null;
        post_reactions?: Row[] | null;
      };
      const reactions = raw.post_reactions ?? [];
      const likedByMe = myId ? reactions.some((rx) => rx.user_id === myId) : false;
      return toPost(
        {
          ...raw,
          author_name: raw.profiles?.display_name ?? null,
          liked_by_me: likedByMe,
        },
        myId
      );
    });
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
    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        body: input.body.trim(),
        topic: input.topic ?? null,
        image_url: input.imageUrl ?? null,
      })
      .select('id, author_id, body, topic, image_url, like_count, comment_count, created_at')
      .single();

    if (error) {
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
    const { data, error } = await supabase
      .from('post_comments')
      .select(
        `id, post_id, author_id, body, created_at,
         profiles!post_comments_author_id_fkey(display_name)`
      )
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      log.error('listComments failed', error);
      return [];
    }

    return (data ?? []).map((r) => {
      const raw = r as unknown as Row & { profiles?: Row | null };
      return toComment({ ...raw, author_name: raw.profiles?.display_name ?? null });
    });
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
    const { data, error } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, author_id: user.id, body: body.trim() })
      .select('id, post_id, author_id, body, created_at')
      .single();

    if (error) {
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

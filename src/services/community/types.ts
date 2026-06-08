// ============================================================================
// COMMUNITY — shared types for the trainee community layer.
// Kept deliberately separate from src/types/coach.ts: the community layer has a
// different permission model (public-read among trainees) and must not couple
// to the consent-gated coach-groups domain.
// ============================================================================

/** A single community post (text body + optional image), feed-ready. */
export interface Post {
  id: string;
  authorId: string;
  /** Resolved display name for the author; falls back at the UI layer. */
  authorName?: string;
  body: string;
  topic: string | null;
  imageUrl: string | null;
  likeCount: number;
  commentCount: number;
  /** ISO timestamp. */
  createdAt: string;
  /** Whether the current viewer has liked this post. */
  likedByMe: boolean;
}

/** A flat comment under a post. */
export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
}

/** A feed entry — currently 1:1 with Post; a wrapper so the feed list can grow
 *  (pinned announcements, suggested follows) without changing call sites. */
export type FeedItem = Post;

/** Input for creating a post. */
export interface CreatePostInput {
  body: string;
  topic?: string;
  imageUrl?: string;
}

/** Input for filing a moderation report (post OR comment). */
export interface ReportInput {
  postId?: string;
  commentId?: string;
  reason?: string;
}

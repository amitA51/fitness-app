// ============================================================================
// CommunityFeed — /community (authed)
// Composer at top, paginated PostCard list. All 4 UI states.
// Fresh Steel / Obsidian. RTL Hebrew-first.
// ============================================================================

import { Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CommentSheet } from '../../components/community/CommentSheet';
import { PostCard } from '../../components/community/PostCard';
import { PostComposer } from '../../components/community/PostComposer';
import {
  blockUser,
  createPost,
  listFeedPosts,
  reportContent,
  toggleLike,
} from '../../services/community/communityService';
import type { FeedItem } from '../../services/community/types';

const PAGE_LIMIT = 30;

// ── Skeleton card ─────────────────────────────────────────────────────────────
function PostSkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        background: 'var(--fs-surface)',
        borderRadius: 'var(--radius-asymmetric)',
        border: '1px solid var(--fs-surface-2)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          className="skeleton-pulse"
          style={{ width: 80, height: 12, borderRadius: 6, background: 'var(--fs-surface-2)' }}
        />
        <div
          className="skeleton-pulse"
          style={{ width: 48, height: 10, borderRadius: 6, background: 'var(--fs-surface-2)' }}
        />
      </div>
      <div
        className="skeleton-pulse"
        style={{ width: '100%', height: 14, borderRadius: 6, background: 'var(--fs-surface-2)' }}
      />
      <div
        className="skeleton-pulse"
        style={{ width: '75%', height: 14, borderRadius: 6, background: 'var(--fs-surface-2)' }}
      />
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <div
      role="status"
      aria-label="אין פוסטים עדיין"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <Users size={40} aria-hidden="true" style={{ color: 'var(--fs-muted)', opacity: 0.5 }} />
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 18,
          color: 'var(--fs-ink)',
        }}
      >
        עדיין אין פוסטים
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--fs-muted)',
          maxWidth: 260,
          lineHeight: 1.5,
        }}
      >
        היו הראשונים לשתף — כתבו פוסט למעלה והתחילו את השיחה.
      </p>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────
function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '48px 24px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          color: 'var(--fs-warn)',
        }}
      >
        לא ניתן לטעון את הפיד כרגע.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="focus-ring"
        style={{
          padding: '10px 20px',
          background: 'var(--fs-accent)',
          color: 'var(--color-ink-on-accent)',
          border: 'none',
          borderRadius: 10,
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          fontWeight: 700,
          cursor: 'pointer',
          minHeight: 44,
        }}
      >
        נסו שוב
      </button>
    </div>
  );
}

// ── Toast notification ─────────────────────────────────────────────────────────
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 2800);
    return () => clearTimeout(id);
  }, [onDone]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 'max(96px, calc(5rem + env(safe-area-inset-bottom)))',
        insetInlineStart: '50%',
        transform: 'translateX(-50%)',
        zIndex: 60,
        background: 'var(--fs-primary)',
        color: 'var(--color-ink-on-dark)',
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        fontWeight: 600,
        padding: '10px 18px',
        borderRadius: 999,
        boxShadow: 'var(--shadow-card)',
        whiteSpace: 'nowrap',
      }}
    >
      {message}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CommunityFeed() {
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // ids of posts/authors hidden client-side after block (complement to RLS)
  const [hiddenAuthorIds, setHiddenAuthorIds] = useState<Set<string>>(new Set());
  const clearToast = useCallback(() => setToast(null), []);
  const loadedRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setError(false);
    setLoading(true);
    try {
      const items = await listFeedPosts({ limit: PAGE_LIMIT });
      setPosts(items);
      setHasMore(items.length === PAGE_LIMIT);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      load();
    }
  }, [load]);

  // ── Load more (cursor pagination) ──────────────────────────────────────────
  const loadMore = useCallback(async () => {
    if (loadingMoreRef.current) return;
    const last = posts[posts.length - 1];
    if (!last) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await listFeedPosts({ limit: PAGE_LIMIT, before: last.createdAt });
      setPosts((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_LIMIT);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [posts]);

  // Observe a sentinel near the list end and fetch the next page when it enters.
  useEffect(() => {
    if (!hasMore || loading || error) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, error, loadMore]);

  // ── Composer ──────────────────────────────────────────────────────────────
  const handleCreate = useCallback(async (body: string) => {
    const { post, error: err } = await createPost({ body });
    if (err || !post) throw new Error(err ?? 'create_failed');
    setPosts((prev) => [post, ...prev]);
  }, []);

  // ── Like (optimistic) ─────────────────────────────────────────────────────
  const handleLike = useCallback(
    async (postId: string) => {
      // Capture the original post snapshot up front so a failed toggle restores the
      // exact pre-tap state — robust against rapid double-tap stale-closure reverts.
      const snapshot = posts.find((p) => p.id === postId);
      if (!snapshot) return;

      // Optimistic update
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                likedByMe: !p.likedByMe,
                likeCount: p.likedByMe ? Math.max(0, p.likeCount - 1) : p.likeCount + 1,
              }
            : p
        )
      );
      const nowLiked = await toggleLike(postId);
      if (nowLiked === null) {
        // RPC failed — restore the captured snapshot exactly.
        setPosts((prev) => prev.map((p) => (p.id === postId ? snapshot : p)));
      }
    },
    [posts]
  );

  // ── Report ────────────────────────────────────────────────────────────────
  const handleReport = useCallback(async (postId: string) => {
    const { error: err } = await reportContent({ postId });
    if (err) {
      setToast('הדיווח נכשל. נסו שוב.');
      return;
    }
    setToast('הדיווח נשלח. תודה על שמירת הקהילה.');
  }, []);

  // ── Block ─────────────────────────────────────────────────────────────────
  const handleBlock = useCallback(async (authorId: string) => {
    const { error: err } = await blockUser(authorId);
    if (err) {
      setToast('החסימה נכשלה. נסו שוב.');
      return;
    }
    setHiddenAuthorIds((prev) => new Set([...prev, authorId]));
    setToast('המשתמש נחסם. תוכן שלהם לא יוצג יותר.');
  }, []);

  // ── Comment sheet ─────────────────────────────────────────────────────────
  const [openCommentPostId, setOpenCommentPostId] = useState<string | null>(null);

  const handleCommentOpen = useCallback((postId: string) => {
    setOpenCommentPostId(postId);
  }, []);

  // Keep the post's comment count fresh after a successful comment add.
  const handleCommentAdded = useCallback((postId: string) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p))
    );
  }, []);

  // ── Filtered feed (client-side block complement to RLS) ───────────────────
  const visiblePosts = useMemo(
    () => posts.filter((p) => !hiddenAuthorIds.has(p.authorId)),
    [posts, hiddenAuthorIds]
  );

  return (
    <div
      dir="rtl"
      style={{
        background: 'var(--fs-bg)',
        minHeight: '100dvh',
        paddingBottom: 'max(7rem, calc(4rem + env(safe-area-inset-bottom)))',
      }}
    >
      {/* Sticky header */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--fs-bg)',
          borderBottom: '2px solid var(--fs-accent)',
          padding:
            'max(16px, env(safe-area-inset-top, 16px)) max(20px, env(safe-area-inset-right, 20px)) 14px max(20px, env(safe-area-inset-left, 20px))',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: '-0.01em',
            color: 'var(--fs-ink)',
          }}
        >
          קהילה
        </h1>
      </header>

      {/* Content */}
      <main
        style={{
          maxWidth: 640,
          margin: '0 auto',
          padding: '16px 16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* Composer — always visible */}
        <PostComposer onSubmit={handleCreate} />

        {/* Feed states */}
        {loading ? (
          <section
            aria-label="טוען פוסטים"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <PostSkeleton />
            <PostSkeleton />
            <PostSkeleton />
          </section>
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : visiblePosts.length === 0 ? (
          <EmptyState />
        ) : (
          <section
            aria-label="פוסטים בקהילה"
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {visiblePosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onLike={handleLike}
                onReport={handleReport}
                onBlock={handleBlock}
                onCommentOpen={handleCommentOpen}
              />
            ))}

            {/* Load-more: IntersectionObserver sentinel + accessible button fallback */}
            {hasMore && (
              <>
                <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="focus-ring"
                  style={{
                    alignSelf: 'center',
                    padding: '10px 20px',
                    background: 'var(--fs-surface)',
                    color: 'var(--fs-ink)',
                    border: '1px solid var(--fs-surface-2)',
                    borderRadius: 10,
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: loadingMore ? 'wait' : 'pointer',
                    minHeight: 44,
                  }}
                >
                  {loadingMore ? 'טוען…' : 'טען עוד'}
                </button>
              </>
            )}
          </section>
        )}
      </main>

      {/* Transient toast */}
      {toast && <Toast message={toast} onDone={clearToast} />}

      {/* Comment sheet */}
      <CommentSheet
        postId={openCommentPostId}
        isOpen={openCommentPostId !== null}
        onClose={() => setOpenCommentPostId(null)}
        onCommentAdded={handleCommentAdded}
      />
    </div>
  );
}

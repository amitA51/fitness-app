// ============================================================================
// CommentSheet — bottom-sheet that renders threaded comments for a given post.
//
// Props: postId (null = closed), isOpen, onClose.
// When open, fetches listComments(postId) — all 4 UI states (loading skeleton,
// empty, error + retry, success list). Composer at bottom: label-above textarea,
// char counter dir=ltr, submit via addComment, optimistic append on success.
// FAIL-SAFE-INERT: service errors never throw to UI. RTL Hebrew-first.
// Fresh Steel / Obsidian design system.
// ============================================================================

import { MessageCircle, Send } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { addComment, listComments } from '../../services/community/communityService';
import type { PostComment } from '../../services/community/types';
import { Sheet } from '../ui/Sheet';

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_CHARS = 500;
const SCROLL_TO_BOTTOM_DELAY_MS = 50;

// ── Relative time formatter ───────────────────────────────────────────────────

function relativeTime(isoString: string): string {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) return 'עכשיו';
    if (diffMin < 60) return `לפני ${diffMin} דק'`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `לפני ${diffHr} שע'`;
    const diffDay = Math.floor(diffHr / 24);
    // Hebrew day pluralization: 1 → יום, 2 → יומיים, n → ${n} ימים.
    if (diffDay === 1) return 'לפני יום';
    if (diffDay === 2) return 'לפני יומיים';
    return `לפני ${diffDay} ימים`;
  } catch {
    return '';
  }
}

// ── Skeleton row ──────────────────────────────────────────────────────────────

function CommentSkeleton() {
  return (
    <div
      aria-hidden="true"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 0',
      }}
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          className="skeleton-pulse"
          style={{ width: 72, height: 11, borderRadius: 6, background: 'var(--fs-surface-2)' }}
        />
        <div
          className="skeleton-pulse"
          style={{ width: 44, height: 10, borderRadius: 6, background: 'var(--fs-surface-2)' }}
        />
      </div>
      <div
        className="skeleton-pulse"
        style={{ width: '90%', height: 13, borderRadius: 6, background: 'var(--fs-surface-2)' }}
      />
      <div
        className="skeleton-pulse"
        style={{ width: '60%', height: 13, borderRadius: 6, background: 'var(--fs-surface-2)' }}
      />
    </div>
  );
}

// ── Single comment row ────────────────────────────────────────────────────────

interface CommentRowProps {
  comment: PostComment;
}

function CommentRow({ comment }: CommentRowProps) {
  const displayName = comment.authorName ?? 'משתמש';
  return (
    <article
      aria-label={`תגובה מאת ${displayName}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '10px 0',
        borderBottom: '1px solid var(--fs-surface-2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 13,
            color: 'var(--fs-ink)',
          }}
        >
          {displayName}
        </span>
        <time
          dateTime={comment.createdAt}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fs-muted)',
          }}
        >
          {relativeTime(comment.createdAt)}
        </time>
      </div>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--fs-ink)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {comment.body}
      </p>
    </article>
  );
}

// ── Composer ──────────────────────────────────────────────────────────────────

interface ComposerProps {
  postId: string;
  onOptimisticAppend: (comment: PostComment) => void;
  onRemoveOptimistic: (commentId: string) => void;
  onCommentAdded: (postId: string) => void;
  /** Surfaced as a toast by the host when the hourly comment limit is hit. */
  onRateLimited: () => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

function CommentComposer({
  postId,
  onOptimisticAppend,
  onRemoveOptimistic,
  onCommentAdded,
  onRateLimited,
  textareaRef,
}: ComposerProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const charCount = text.length;
  const overLimit = charCount > MAX_CHARS;
  const canSubmit = charCount > 0 && !overLimit && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setSubmitError(null);

    // Optimistic append with a temporary id
    const optimisticId = `opt-${Date.now()}`;
    const optimisticComment: PostComment = {
      id: optimisticId,
      postId,
      authorId: '',
      authorName: undefined,
      body: trimmed,
      createdAt: new Date().toISOString(),
    };
    onOptimisticAppend(optimisticComment);
    setText('');

    try {
      const { error } = await addComment(postId, trimmed);
      if (error) {
        // Roll back the optimistic row and restore the draft text.
        onRemoveOptimistic(optimisticId);
        setText(trimmed);
        if (error === 'rate_limited') {
          // Friendly limit message goes to a toast at the host, not inline.
          onRateLimited();
        } else if (error === 'blocked') {
          // The RPC refuses when either side has blocked the other.
          setSubmitError('לא ניתן להגיב לפוסט הזה.');
        } else {
          setSubmitError('שליחת התגובה נכשלה. נסו שוב.');
        }
      } else {
        onCommentAdded(postId);
      }
    } catch {
      onRemoveOptimistic(optimisticId);
      setText(trimmed);
      setSubmitError('שגיאה בלתי צפויה. נסו שוב.');
    } finally {
      setSubmitting(false);
    }
  }, [
    canSubmit,
    text,
    postId,
    onOptimisticAppend,
    onRemoveOptimistic,
    onCommentAdded,
    onRateLimited,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Label above input */}
      <label
        htmlFor="comment-input"
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--fs-ink)',
        }}
      >
        הוספת תגובה
      </label>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          id="comment-input"
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          dir="rtl"
          placeholder="כתבו תגובה…"
          rows={2}
          aria-describedby="comment-counter comment-error"
          style={{
            flex: 1,
            resize: 'none',
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            lineHeight: 1.5,
            color: 'var(--fs-ink)',
            background: 'var(--fs-surface-2)',
            border: `1.5px solid ${overLimit ? 'var(--fs-warn)' : 'var(--fs-surface-2)'}`,
            borderRadius: 10,
            padding: '8px 12px',
            outline: 'none',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => {
            if (!overLimit) {
              e.currentTarget.style.borderColor = 'var(--fs-accent)';
            }
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = overLimit
              ? 'var(--fs-warn)'
              : 'var(--fs-surface-2)';
          }}
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-label="שליחת תגובה"
          className="focus-ring active:scale-[0.93]"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 10,
            border: 'none',
            background: canSubmit ? 'var(--fs-accent)' : 'var(--fs-surface-2)',
            color: canSubmit ? 'var(--color-ink-on-accent)' : 'var(--fs-muted)',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s, color 0.15s, transform 0.1s',
            flexShrink: 0,
          }}
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </div>

      {/* Char counter — dir=ltr per rule (numbers) */}
      <div
        id="comment-counter"
        dir="ltr"
        aria-live="polite"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: overLimit ? 'var(--fs-warn)' : 'var(--fs-muted)',
          textAlign: 'left',
        }}
      >
        {charCount} / {MAX_CHARS}
      </div>

      {/* Inline error below input */}
      {submitError && (
        <p
          id="comment-error"
          role="alert"
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            color: 'var(--fs-warn)',
          }}
        >
          {submitError}
        </p>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function CommentsEmpty() {
  return (
    <div
      role="status"
      aria-label="אין תגובות עדיין"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '32px 0 16px',
        textAlign: 'center',
      }}
    >
      <MessageCircle
        size={36}
        aria-hidden="true"
        style={{ color: 'var(--fs-muted)', opacity: 0.4 }}
      />
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-display)',
          fontWeight: 700,
          fontSize: 16,
          color: 'var(--fs-ink)',
        }}
      >
        היו הראשונים להגיב
      </p>
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--fs-muted)',
          maxWidth: 220,
          lineHeight: 1.5,
        }}
      >
        שתפו מחשבה, שאלה או עידוד למטה.
      </p>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function CommentsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '32px 0 16px',
        textAlign: 'center',
      }}
    >
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: 'var(--fs-warn)',
        }}
      >
        לא ניתן לטעון תגובות כרגע.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="focus-ring"
        style={{
          padding: '8px 18px',
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

// ── Main component ────────────────────────────────────────────────────────────

interface CommentSheetProps {
  postId: string | null;
  isOpen: boolean;
  onClose: () => void;
  /** Notifies the parent feed to increment the post's comment count. */
  onCommentAdded?: (postId: string) => void;
  /** Lets the host show the friendly hourly-limit toast for comments. */
  onRateLimited?: () => void;
}

export function CommentSheet({
  postId,
  isOpen,
  onClose,
  onCommentAdded,
  onRateLimited,
}: CommentSheetProps) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch comments whenever the sheet opens for a specific post
  const fetchComments = useCallback(async (id: string) => {
    setFetchError(false);
    setLoading(true);
    try {
      const result = await listComments(id);
      setComments(result);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && postId) {
      setComments([]);
      fetchComments(postId);
    }
  }, [isOpen, postId, fetchComments]);

  // Focus the composer textarea when the sheet opens (not the close button).
  useEffect(() => {
    if (isOpen && postId) {
      const focusId = setTimeout(() => composerTextareaRef.current?.focus(), 0);
      return () => clearTimeout(focusId);
    }
  }, [isOpen, postId]);

  // Clear any pending scroll timeout on unmount.
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, []);

  const handleRetry = useCallback(() => {
    if (postId) fetchComments(postId);
  }, [postId, fetchComments]);

  const handleOptimisticAppend = useCallback((comment: PostComment) => {
    setComments((prev) => [...prev, comment]);
    // Scroll to bottom after append — tracked so it can be cleared on unmount.
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, SCROLL_TO_BOTTOM_DELAY_MS);
  }, []);

  const handleRemoveOptimistic = useCallback((commentId: string) => {
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }, []);

  const handleCommentAdded = useCallback(
    (id: string) => {
      onCommentAdded?.(id);
    },
    [onCommentAdded]
  );

  const handleRateLimited = useCallback(() => {
    onRateLimited?.();
  }, [onRateLimited]);

  // Composer footer — only when postId is present
  const composerFooter = postId ? (
    <CommentComposer
      postId={postId}
      onOptimisticAppend={handleOptimisticAppend}
      onRemoveOptimistic={handleRemoveOptimistic}
      onCommentAdded={handleCommentAdded}
      onRateLimited={handleRateLimited}
      textareaRef={composerTextareaRef}
    />
  ) : null;

  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="תגובות" footer={composerFooter ?? undefined}>
      <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', minHeight: 180 }}>
        {loading ? (
          <section aria-label="טוען תגובות" style={{ display: 'flex', flexDirection: 'column' }}>
            <CommentSkeleton />
            <CommentSkeleton />
            <CommentSkeleton />
          </section>
        ) : fetchError ? (
          <CommentsError onRetry={handleRetry} />
        ) : comments.length === 0 ? (
          <CommentsEmpty />
        ) : (
          <section aria-label="רשימת תגובות" style={{ display: 'flex', flexDirection: 'column' }}>
            {comments.map((comment) => (
              <CommentRow key={comment.id} comment={comment} />
            ))}
            <div ref={listEndRef} aria-hidden="true" />
          </section>
        )}
      </div>
    </Sheet>
  );
}

export default CommentSheet;

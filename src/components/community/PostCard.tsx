// ============================================================================
// PostCard — one feed post: author, body, like, comments, and the MANDATORY
// overflow menu with "דיווח" (report) and "חסימה" (block) per Apple Guideline 1.2.
// Fresh Steel / Obsidian. RTL Hebrew-first.
// ============================================================================

import { Flag, Heart, MessageCircle, MoreHorizontal, UserX } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import type { Post } from '../../services/community/types';

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => Promise<void>;
  onReport: (postId: string) => Promise<void>;
  onBlock: (authorId: string) => Promise<void>;
  onCommentOpen: (postId: string) => void;
}

export function PostCard({ post, onLike, onReport, onBlock, onCommentOpen }: PostCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = post.authorName ?? 'משתמש';

  const handleLike = useCallback(async () => {
    if (likePending) return;
    setLikePending(true);
    try {
      await onLike(post.id);
    } finally {
      setLikePending(false);
    }
  }, [likePending, onLike, post.id]);

  const handleReport = useCallback(async () => {
    if (actionPending) return;
    setMenuOpen(false);
    setActionPending(true);
    try {
      await onReport(post.id);
    } finally {
      setActionPending(false);
    }
  }, [actionPending, onReport, post.id]);

  const handleBlock = useCallback(async () => {
    if (actionPending) return;
    setMenuOpen(false);
    setActionPending(true);
    try {
      await onBlock(post.authorId);
    } finally {
      setActionPending(false);
    }
  }, [actionPending, onBlock, post.authorId]);

  const handleMenuBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    // Close menu when focus leaves the menu container
    if (!menuRef.current?.contains(e.relatedTarget as Node)) {
      setMenuOpen(false);
    }
  }, []);

  const formattedDate = new Intl.DateTimeFormat('he-IL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(post.createdAt));

  return (
    <article
      dir="rtl"
      aria-label={`פוסט מאת ${displayName}`}
      style={{
        background: 'var(--fs-surface)',
        borderRadius: 'var(--radius-asymmetric)',
        border: '1px solid var(--fs-surface-2)',
        boxShadow: 'var(--shadow-card)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        position: 'relative',
      }}
    >
      {/* Header: author + date + overflow menu */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--fs-ink)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {displayName}
          </span>
          <time
            dateTime={post.createdAt}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fs-muted)',
            }}
          >
            {formattedDate}
          </time>
        </div>

        {/* Overflow menu — mandatory for Apple UGC moderation */}
        <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }} onBlur={handleMenuBlur}>
          <button
            type="button"
            aria-label="אפשרויות נוספות"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="focus-ring"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: 8,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: 'var(--fs-muted)',
              transition: 'background 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--fs-surface-2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            <MoreHorizontal size={18} aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              aria-label="אפשרויות פוסט"
              style={{
                position: 'absolute',
                top: '100%',
                insetInlineStart: 0,
                zIndex: 50,
                background: 'var(--fs-surface)',
                border: '1px solid var(--fs-surface-2)',
                borderRadius: 10,
                boxShadow: 'var(--shadow-card)',
                minWidth: 160,
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                role="menuitem"
                disabled={actionPending}
                onClick={handleReport}
                className="focus-ring"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: 'var(--fs-warn)',
                  textAlign: 'right',
                  minHeight: 44,
                }}
              >
                <Flag size={15} aria-hidden="true" />
                דיווח
              </button>

              <button
                type="button"
                role="menuitem"
                disabled={actionPending}
                onClick={handleBlock}
                className="focus-ring"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '10px 14px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  color: 'var(--fs-warn)',
                  textAlign: 'right',
                  borderTop: '1px solid var(--fs-surface-2)',
                  minHeight: 44,
                }}
              >
                <UserX size={15} aria-hidden="true" />
                חסימה
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Optional topic pill */}
      {post.topic && (
        <span
          style={{
            display: 'inline-flex',
            alignSelf: 'flex-start',
            padding: '2px 8px',
            background: 'var(--fs-surface-2)',
            borderRadius: 999,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fs-accent)',
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          {post.topic}
        </span>
      )}

      {/* Body */}
      <p
        style={{
          margin: 0,
          fontFamily: 'var(--font-body)',
          fontSize: 15,
          lineHeight: 1.6,
          color: 'var(--fs-ink)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {post.body}
      </p>

      {/* Optional image */}
      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          style={{
            width: '100%',
            borderRadius: 10,
            objectFit: 'cover',
            maxHeight: 320,
          }}
        />
      )}

      {/* Action row: like + comment */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          borderTop: '1px solid var(--fs-surface-2)',
          paddingTop: 8,
          marginTop: 2,
        }}
      >
        {/* Like button */}
        <button
          type="button"
          onClick={handleLike}
          disabled={likePending}
          aria-label={post.likedByMe ? 'בטל לייק' : 'לייק'}
          aria-pressed={post.likedByMe}
          className="focus-ring"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 10px',
            border: 'none',
            borderRadius: 8,
            background: 'none',
            cursor: likePending ? 'wait' : 'pointer',
            color: post.likedByMe ? 'var(--fs-accent)' : 'var(--fs-muted)',
            transition: 'color 0.15s, transform 0.1s',
            minHeight: 44,
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'scale(0.93)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <Heart size={18} aria-hidden="true" fill={post.likedByMe ? 'var(--fs-accent)' : 'none'} />
          <span
            dir="ltr"
            className="kinetic-number"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {post.likeCount}
          </span>
        </button>

        {/* Comment button */}
        <button
          type="button"
          onClick={() => onCommentOpen(post.id)}
          aria-label={`תגובות (${post.commentCount})`}
          className="focus-ring"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '6px 10px',
            border: 'none',
            borderRadius: 8,
            background: 'none',
            cursor: 'pointer',
            color: 'var(--fs-muted)',
            minHeight: 44,
          }}
        >
          <MessageCircle size={18} aria-hidden="true" />
          <span
            dir="ltr"
            className="kinetic-number"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {post.commentCount}
          </span>
        </button>
      </div>
    </article>
  );
}

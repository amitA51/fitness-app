// ============================================================================
// PostCard — one feed post: author, body, like, comments, and the MANDATORY
// overflow menu with "דיווח" (report) and "חסימה" (block) per Apple Guideline 1.2.
// Fresh Steel / Obsidian. RTL Hebrew-first.
// ============================================================================

import { Flag, Heart, MessageCircle, MoreHorizontal, UserX } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Post } from '../../services/community/types';
import { Sheet } from '../ui/Sheet';
import { ReportReasonSheet } from './ReportReasonSheet';

// Hoisted formatter — constructed once per module, not per render.
const HE_DATE_FMT = new Intl.DateTimeFormat('he-IL', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

interface PostCardProps {
  post: Post;
  onLike: (postId: string) => Promise<void>;
  /** Files a moderation report with the picked reason. */
  onReport: (postId: string, reason: string) => Promise<void>;
  onBlock: (authorId: string) => Promise<void>;
  onCommentOpen: (postId: string) => void;
}

function PostCardComponent({ post, onLike, onReport, onBlock, onCommentOpen }: PostCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  // Moderation sheets — opened from the overflow menu, never fired instantly.
  const [reportOpen, setReportOpen] = useState(false);
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuItemsRef = useRef<Array<HTMLButtonElement | null>>([]);
  // Sync guard against double-tap: set before await, cleared in finally.
  const likeInFlightRef = useRef(false);

  const displayName = post.authorName ?? 'משתמש';

  const handleLike = useCallback(async () => {
    if (likeInFlightRef.current || likePending) return;
    likeInFlightRef.current = true;
    setLikePending(true);
    try {
      await onLike(post.id);
    } finally {
      likeInFlightRef.current = false;
      setLikePending(false);
    }
  }, [likePending, onLike, post.id]);

  // "דיווח" no longer fires instantly — it opens the reason picker. The actual
  // report is filed once a reason chip is chosen (handleReportPick).
  const handleReport = useCallback(() => {
    setMenuOpen(false);
    setReportOpen(true);
  }, []);

  const handleReportPick = useCallback(
    async (reason: string) => {
      await onReport(post.id, reason);
    },
    [onReport, post.id]
  );

  // "חסימה" opens a confirm sheet first — destructive, so never one-tap.
  const handleBlock = useCallback(() => {
    setMenuOpen(false);
    setBlockConfirmOpen(true);
  }, []);

  const handleBlockConfirm = useCallback(async () => {
    if (actionPending) return;
    setActionPending(true);
    try {
      await onBlock(post.authorId);
      setBlockConfirmOpen(false);
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

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Roving tabindex: ArrowDown/Up cycle menu items, Escape closes + returns focus.
  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const items = menuItemsRef.current.filter((el): el is HTMLButtonElement => el !== null);
      if (items.length === 0) return;
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
        items[next]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev =
          currentIndex < 0 ? items.length - 1 : (currentIndex - 1 + items.length) % items.length;
        items[prev]?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu();
      }
    },
    [closeMenu]
  );

  // Focus the first menu item when the menu opens.
  useEffect(() => {
    if (menuOpen) {
      menuItemsRef.current[0]?.focus();
    }
  }, [menuOpen]);

  const formattedDate = HE_DATE_FMT.format(new Date(post.createdAt));

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
          <Link
            to={`/u/${post.authorId}`}
            aria-label={`צפייה בפרופיל של ${displayName}`}
            className="focus-ring"
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 14,
              color: 'var(--fs-ink)',
              textDecoration: 'none',
              display: 'block',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              borderRadius: 4,
            }}
          >
            {displayName}
          </Link>
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
        <div
          ref={menuRef}
          style={{ position: 'relative', flexShrink: 0 }}
          onBlur={handleMenuBlur}
          onKeyDown={menuOpen ? handleMenuKeyDown : undefined}
        >
          <button
            type="button"
            ref={triggerRef}
            aria-label="אפשרויות נוספות"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="focus-ring active:scale-[0.92]"
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
              transition: 'background 0.12s, transform 0.1s',
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
                tabIndex={-1}
                ref={(el) => {
                  menuItemsRef.current[0] = el;
                }}
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
                tabIndex={-1}
                ref={(el) => {
                  menuItemsRef.current[1] = el;
                }}
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

      {/* Optional image — explicit dimensions + aspectRatio prevent CLS.
          alt is decorative (empty) only when the post body carries the meaning. */}
      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt={post.body.trim() ? '' : `תמונה מאת ${displayName}`}
          aria-hidden={post.body.trim() ? true : undefined}
          loading="lazy"
          width={640}
          height={320}
          style={{
            width: '100%',
            height: 'auto',
            aspectRatio: '640 / 320',
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
          className="focus-ring active:scale-[0.93]"
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
          className="focus-ring active:scale-[0.93]"
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
            transition: 'transform 0.1s',
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

      {/* Report reason picker — opens from the overflow "דיווח" item. */}
      <ReportReasonSheet
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        onPick={handleReportPick}
      />

      {/* Block confirmation — destructive, never one-tap. */}
      <Sheet
        isOpen={blockConfirmOpen}
        onClose={() => setBlockConfirmOpen(false)}
        title="חסימת משתמש"
        footer={
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => setBlockConfirmOpen(false)}
              disabled={actionPending}
              className="focus-ring active:scale-[0.98]"
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 12,
                border: '1px solid var(--fs-surface-2)',
                background: 'var(--fs-bg)',
                color: 'var(--fs-ink)',
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                fontWeight: 600,
                cursor: actionPending ? 'default' : 'pointer',
              }}
            >
              ביטול
            </button>
            <button
              type="button"
              onClick={handleBlockConfirm}
              disabled={actionPending}
              className="focus-ring active:scale-[0.98]"
              style={{
                flex: 1,
                minHeight: 44,
                borderRadius: 12,
                border: 'none',
                background: 'var(--fs-error)',
                color: 'var(--color-ink-on-error)',
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                fontWeight: 700,
                cursor: actionPending ? 'default' : 'pointer',
                opacity: actionPending ? 0.7 : 1,
              }}
            >
              {actionPending ? 'חוסם…' : 'חסימה'}
            </button>
          </div>
        }
      >
        <p
          dir="rtl"
          style={{
            margin: 0,
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--fs-ink)',
          }}
        >
          לחסום את {displayName}? התוכן שלו לא יוצג לך.
        </p>
      </Sheet>
    </article>
  );
}

export const PostCard = React.memo(PostCardComponent);

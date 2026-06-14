// ============================================================================
// MESSAGE THREAD — async coach<->client conversation (shared by both roles)
// ============================================================================

import { m } from 'framer-motion';
import { Check, CheckCheck, Plus, Send } from 'lucide-react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EASE_OUT } from '../../components/motion/easings';
import { Button } from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { showToast } from '../../components/ui/GlobalToast';
import { useAuth } from '../../contexts/AuthContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import {
  getThreadPage,
  markThreadRead,
  sendMessage,
  subscribeToThread,
} from '../../services/coach';
import type { Message } from '../../types/coach';
import { TypingDots } from './TypingDots';
import { CoachPage, ListSkeleton } from './_shared';
import { formatDayLabel, formatTime, isSameLocalDay } from './messageTime';

/** Grow a single-row composer to fit its content, capped by its CSS max-height. */
function autoGrow(el: HTMLTextAreaElement): void {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

// ── Quick-reply chips (coach view) ──────────────────────────────────────────────
// Seeded Hebrew phrases the coach taps to INSERT into the composer (never auto-
// send). Coach-added custom phrases persist in localStorage. One consistent
// register — gender-neutral plural, matching the app voice.
const SEED_QUICK_REPLIES: readonly string[] = [
  'כל הכבוד!',
  'איך הרגשתם באימון?',
  'תזכרו לשתות מספיק מים היום',
  'נתראה באימון הבא',
  'איך התזונה היום?',
  'יש לי שאלה אליכם — נדבר?',
];

const QUICK_REPLY_STORAGE_KEY = 'coach:quick-replies';
/** Cap stored custom phrases so the strip stays scannable and storage bounded. */
const MAX_CUSTOM_REPLIES = 12;

/** Read the coach's saved custom quick-replies (best-effort; [] on any failure). */
function loadCustomReplies(): string[] {
  try {
    const raw = localStorage.getItem(QUICK_REPLY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export default function MessageThread({ viewer }: { viewer: 'coach' | 'trainee' }) {
  const { otherId = '' } = useParams<{ otherId: string }>();
  const { user } = useAuth();
  const me = user?.id ?? '';
  const coachId = viewer === 'coach' ? me : otherId;
  const clientId = viewer === 'coach' ? otherId : me;

  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const didScrollRef = useRef(false);
  // Set while prepending an older page so the scroll-to-bottom effect skips —
  // "load earlier" must keep the user anchored, not yank them to the newest.
  const prependingRef = useRef(false);
  const reduced = useReducedMotion();

  // Coach-only quick-reply phrases (seeded + custom-from-localStorage). Loaded
  // once on mount; new phrases persist immediately. Trainees never see these.
  const [customReplies, setCustomReplies] = useState<string[]>(() =>
    viewer === 'coach' ? loadCustomReplies() : []
  );

  // Insert a phrase into the composer (append with a separating space when the
  // field already has text) — NEVER auto-send. Re-grows + focuses the textarea.
  const insertQuickReply = useCallback((phrase: string) => {
    setBody((prev) => (prev.trim() ? `${prev.trimEnd()} ${phrase}` : phrase));
    const el = composerRef.current;
    if (el) {
      requestAnimationFrame(() => {
        autoGrow(el);
        el.focus();
      });
    }
  }, []);

  // Persist a new custom phrase (de-duped, capped). Best-effort write.
  const addCustomReply = useCallback((phrase: string) => {
    const trimmed = phrase.trim();
    if (!trimmed) return;
    setCustomReplies((prev) => {
      if (prev.includes(trimmed) || SEED_QUICK_REPLIES.includes(trimmed)) return prev;
      const next = [trimmed, ...prev].slice(0, MAX_CUSTOM_REPLIES);
      try {
        localStorage.setItem(QUICK_REPLY_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage unavailable (private mode / quota) — keep the in-session list.
      }
      return next;
    });
  }, []);

  // Collapse the auto-grown composer back to one row after a successful send.
  useEffect(() => {
    if (body === '' && composerRef.current) composerRef.current.style.height = 'auto';
  }, [body]);

  // `isStale` lets the mount/param-change effect cancel an in-flight load:
  // switching thread A→B must not let a slow A response overwrite B's messages
  // (or markThreadRead stamp the wrong thread). Defaults to never-stale for
  // direct calls (retry button).
  const load = async (isStale: () => boolean = () => false) => {
    setError(false);
    try {
      const page = await getThreadPage(coachId, clientId);
      if (isStale()) return;
      setMessages(page.messages);
      setHasMore(page.hasMore);
      setLoading(false);
      await markThreadRead(coachId, clientId);
      window.dispatchEvent(new Event('coach:unread-refresh'));
    } catch {
      if (isStale()) return;
      // Network/RLS failure: surface a retry instead of an endless skeleton.
      setError(true);
      setLoading(false);
    }
  };

  // Prepend the previous page, preserving the reader's scroll position (the
  // viewport must not jump when content is inserted above it).
  const loadEarlier = async () => {
    const oldest = messages.find((m) => !m.id.startsWith('temp-'))?.createdAt;
    if (!oldest || loadingEarlier) return;
    setLoadingEarlier(true);
    prependingRef.current = true;
    const prevHeight = document.documentElement.scrollHeight;
    const prevY = window.scrollY;
    try {
      const page = await getThreadPage(coachId, clientId, oldest);
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const fresh = page.messages.filter((m) => !ids.has(m.id));
        return [...fresh, ...prev];
      });
      setHasMore(page.hasMore);
      // Re-anchor after React commits the prepended content (double rAF —
      // the first fires before paint, the second after layout settles).
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const delta = document.documentElement.scrollHeight - prevHeight;
          if (delta > 0) window.scrollTo({ top: prevY + delta });
        })
      );
    } catch {
      prependingRef.current = false;
      showToast('טעינת ההודעות הקודמות נכשלה', 'error');
    } finally {
      setLoadingEarlier(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-load only when the thread participants change
  useEffect(() => {
    if (!coachId || !clientId) return;
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [coachId, clientId]);

  // Live-append messages as they arrive; mark them read since the thread is open.
  // Announce incoming messages (not my own) to screen readers via the live region.
  useEffect(() => {
    if (!coachId || !clientId) return;
    return subscribeToThread(coachId, clientId, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      // Only incoming messages need a read-stamp + badge refresh. Gating on the
      // sender avoids a no-op write + event churn on my own echoed insert.
      if (m.senderId !== me) {
        setLiveAnnouncement('הודעה חדשה התקבלה');
        void markThreadRead(coachId, clientId).then(() =>
          window.dispatchEvent(new Event('coach:unread-refresh'))
        );
      }
    });
  }, [coachId, clientId, me]);

  useEffect(() => {
    if (messages.length === 0) return;
    // Skip when an older page was just prepended — loadEarlier re-anchors the
    // viewport itself; scrolling to the newest here would lose the reader.
    if (prependingRef.current) {
      prependingRef.current = false;
      return;
    }
    // Jump instantly on the first populated render (and under reduced-motion);
    // smooth-scroll only for subsequent live appends.
    const behavior: ScrollBehavior = reduced || !didScrollRef.current ? 'auto' : 'smooth';
    didScrollRef.current = true;
    endRef.current?.scrollIntoView({ behavior });
  }, [messages, reduced]);

  const handleSend = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(false);
    setBody('');

    // Optimistic append: show the message immediately with a temp id so the
    // composer feels instant. Reconciled by a single getThread on success
    // (real ids replace the temp); removed + text restored on failure.
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      coachId,
      clientId,
      senderId: me,
      body: text,
      attachments: [],
      readAt: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const { error } = await sendMessage(coachId, clientId, text);
    if (error) {
      // Roll back the optimistic bubble, restore the unsent text, surface inline.
      setMessages((prev) => prev.filter((x) => x.id !== tempId));
      setBody(text);
      setSendError(true);
      setSending(false);
      return;
    }
    // Reconcile temp → persisted rows without a full reload (no read churn).
    // Merge, don't replace: earlier pages the user already loaded must survive.
    try {
      const page = await getThreadPage(coachId, clientId);
      setMessages((prev) => {
        const ids = new Set(page.messages.map((m) => m.id));
        const firstAt = page.messages[0]?.createdAt ?? '';
        const older = prev.filter(
          (m) => !ids.has(m.id) && !m.id.startsWith('temp-') && (m.createdAt ?? '') < firstAt
        );
        return [...older, ...page.messages];
      });
    } catch {
      // Keep the optimistic bubble; the realtime subscription will catch up.
    }
    setSending(false);
  };

  return (
    <CoachPage title="הודעות" subtitle="Messages">
      {/* Stable live region — must be outside any container that can unmount.
          Announces incoming messages to screen readers without visual change. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>
      {/* Pad the scroll area so the last bubble / empty state clears the fixed
          composer below (its height + iOS home-indicator inset). */}
      <div
        className="flex flex-col gap-2"
        style={{ minHeight: '50dvh', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}
      >
        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <EmptyState
            illustration="error"
            title="טעינת ההודעות נכשלה"
            description="בדקו את החיבור ונסו שוב."
            action={{ label: 'נסו שוב', onClick: () => void load() }}
          />
        ) : messages.length === 0 ? (
          <EmptyState
            illustration="notes"
            title="אין הודעות עדיין"
            description="כתבו את ההודעה הראשונה."
          />
        ) : (
          <>
            {hasMore && (
              <Button
                variant="secondary"
                size="sm"
                isLoading={loadingEarlier}
                onClick={() => void loadEarlier()}
                className="self-center"
                aria-label="טעינת הודעות קודמות"
              >
                הצגת הודעות קודמות
              </Button>
            )}
            {messages.map((msg, i) => {
              const prev = i > 0 ? messages[i - 1] : null;
              const showDivider =
                !prev || !isSameLocalDay(msg.createdAt ?? '', prev.createdAt ?? '');
              return (
                <Fragment key={msg.id}>
                  {showDivider && <DayDivider iso={msg.createdAt} />}
                  <Bubble message={msg} mine={msg.senderId === me} reduced={reduced} />
                </Fragment>
              );
            })}
            {/* "Delivering" indicator on my in-flight send — backed by real
                `sending` state, aligned to the inline-end like my bubbles. */}
            {sending && (
              <div style={{ marginInlineStart: 'auto', marginInlineEnd: 0 }}>
                <TypingDots />
              </div>
            )}
          </>
        )}
        <div ref={endRef} />
      </div>

      <div
        className="fixed inset-x-0 bottom-0 px-5 pt-3"
        style={{
          background: 'var(--fs-bg)',
          borderTop: '1px solid var(--fs-surface-2)',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Inline send error — field-level failures belong beside the composer,
            not in a transient toast. Clears on the next keystroke. */}
        {sendError && (
          <div
            role="alert"
            style={{
              marginBottom: 6,
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--fs-error)',
            }}
          >
            שליחת ההודעה נכשלה. בדקו את החיבור ונסו שוב.
          </div>
        )}
        {viewer === 'coach' && (
          <QuickReplyBar
            replies={[...SEED_QUICK_REPLIES, ...customReplies]}
            onInsert={insertQuickReply}
            onAdd={addCustomReply}
          />
        )}
        <div className="flex gap-2 items-end">
          {/* Compact chat composer — auto-grows up to a few rows on input; the
              form <Textarea> (88px min) is intentionally not used here. Enter
              sends, Shift+Enter inserts a newline. Labelled + RTL via text-align:start. */}
          <textarea
            ref={composerRef}
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              if (sendError) setSendError(false);
              autoGrow(e.target);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={1}
            placeholder="הקלד הודעה…"
            aria-label="כתיבת הודעה"
            className="flex-1 px-3 py-2"
            style={{
              background: 'var(--fs-surface)',
              border: '1px solid var(--fs-surface-2)',
              color: 'var(--fs-ink)',
              fontFamily: 'var(--font-body)',
              fontSize: 16,
              textAlign: 'start',
              resize: 'none',
              minHeight: 44,
              maxHeight: 120,
              overflowY: 'auto',
            }}
          />
          {/* 44×44 send control (foundation Button icon size) tinted primary. */}
          <Button
            variant="primary"
            size="icon"
            aria-label="שלח"
            onClick={handleSend}
            disabled={!body.trim() || sending}
            className="shrink-0 motion-safe:active:scale-[0.98]"
            style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }}
          >
            <Send size={18} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </CoachPage>
  );
}

// ── QuickReplyBar ───────────────────────────────────────────────────────────────
// Horizontally-scrollable row of tap-to-insert phrase chips (coach view only).
// Mono-label chips mirror the CoachClients tag chips: --fs-surface-2 border,
// active:scale-[0.98], 44px hit target, dir="auto" for mixed Hebrew/emoji. A
// trailing "+" chip reveals an inline input to save a new phrase to localStorage.

function QuickReplyBar({
  replies,
  onInsert,
  onAdd,
}: {
  replies: string[];
  onInsert: (phrase: string) => void;
  onAdd: (phrase: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const addInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (adding) addInputRef.current?.focus();
  }, [adding]);

  const commitAdd = () => {
    const trimmed = draft.trim();
    if (trimmed) onAdd(trimmed);
    setDraft('');
    setAdding(false);
  };

  const chipStyle: React.CSSProperties = {
    flexShrink: 0,
    padding: '0 12px',
    minHeight: 44,
    fontFamily: 'var(--font-mono)',
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 999,
    border: '1px solid var(--fs-surface-2)',
    background: 'var(--fs-surface)',
    color: 'var(--fs-ink)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <div
      className="flex items-center gap-2 mb-2"
      style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 2 }}
    >
      {replies.map((phrase) => (
        <button
          key={phrase}
          type="button"
          dir="auto"
          onClick={() => onInsert(phrase)}
          aria-label={`הוספת "${phrase}" להודעה`}
          className="active:scale-[0.98] inline-flex items-center"
          style={chipStyle}
        >
          {phrase}
        </button>
      ))}
      {adding ? (
        <input
          ref={addInputRef}
          type="text"
          dir="auto"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitAdd}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitAdd();
            } else if (e.key === 'Escape') {
              setDraft('');
              setAdding(false);
            }
          }}
          placeholder="ביטוי חדש…"
          aria-label="ביטוי מהיר חדש"
          className="flex-shrink-0"
          style={{
            ...chipStyle,
            minWidth: 140,
            cursor: 'text',
            color: 'var(--fs-ink)',
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label="הוספת ביטוי מהיר"
          className="active:scale-[0.98] inline-flex items-center justify-center"
          style={{ ...chipStyle, padding: 0, width: 44, color: 'var(--fs-accent)' }}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ── Bubble ──────────────────────────────────────────────────────────────────────
// One message bubble with a mount entrance (opacity:0,y:8 → settled). My own
// bubbles carry a read receipt: a single check = delivered, a double check
// (accent) = read, derived from the existing `readAt` field. prefers-reduced-
// motion renders instantly with no transform.

function Bubble({ message, mine, reduced }: { message: Message; mine: boolean; reduced: boolean }) {
  const read = message.readAt !== null;
  const time = formatTime(message.createdAt);
  const bubbleStyle = {
    // Logical alignment: `margin-inline-start:auto` pushes a flex item to the
    // inline-END (right in RTL) for MY messages; `margin-inline-end:auto`
    // pushes received ones to inline-START.
    marginInlineStart: mine ? 'auto' : 0,
    marginInlineEnd: mine ? 0 : 'auto',
    maxWidth: '80%',
    background: mine ? 'var(--fs-primary)' : 'var(--fs-surface)',
    color: mine ? 'var(--fs-accent)' : 'var(--fs-ink)',
    // Received bubbles keep the surface hairline; mine sits on the primary fill,
    // where --fs-surface-2 is near-invisible — use a low-alpha edge instead.
    border: mine
      ? '1px solid color-mix(in srgb, var(--fs-accent) 22%, transparent)'
      : '1px solid var(--fs-surface-2)',
    padding: '8px 12px',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    textAlign: 'start' as const,
  };

  // Fold the read/sent state into the article's accessible name so SR users
  // hear it as part of the message, not via a separate labelled icon span.
  const ariaLabel = mine ? (read ? 'הודעה שנשלחה, נקראה' : 'הודעה שנשלחה') : 'הודעה שהתקבלה';

  const inner = (
    <>
      {/* dir="auto" lets each bubble resolve its own base direction for
          user-generated content that may be Hebrew or English. */}
      <span dir="auto" style={{ display: 'block', textAlign: 'start' }}>
        {message.body}
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          justifyContent: 'flex-start',
          marginTop: 3,
        }}
      >
        {/* Per-message time — LTR numerals, mono, muted. */}
        {time && (
          <span
            dir="ltr"
            style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fs-muted)' }}
          >
            {time}
          </span>
        )}
        {mine &&
          (read ? (
            <CheckCheck
              size={13}
              strokeWidth={2.5}
              aria-hidden="true"
              style={{ color: 'var(--fs-accent)' }}
            />
          ) : (
            <Check
              size={13}
              strokeWidth={2.5}
              aria-hidden="true"
              style={{ color: 'var(--fs-muted)' }}
            />
          ))}
      </span>
    </>
  );

  if (reduced) {
    return (
      <div role="article" aria-label={ariaLabel} style={bubbleStyle}>
        {inner}
      </div>
    );
  }

  return (
    <m.div
      role="article"
      aria-label={ariaLabel}
      style={bubbleStyle}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
    >
      {inner}
    </m.div>
  );
}

// ── DayDivider ────────────────────────────────────────────────────────────────
// A centered date label rendered when the calendar day changes between bubbles.

function DayDivider({ iso }: { iso?: string }) {
  const label = formatDayLabel(iso);
  if (!label) return null;
  return (
    <div
      style={{
        alignSelf: 'center',
        margin: '6px 0',
        padding: '2px 10px',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: 999,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--fs-muted)',
        letterSpacing: '0.04em',
      }}
    >
      {label}
    </div>
  );
}

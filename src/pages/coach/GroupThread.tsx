// ============================================================================
// GROUP THREAD — group chat screen (shared by coach and member roles)
// ============================================================================
// Mirrors MessageThread's bubble/composer/realtime pattern but extends it for
// group participants: sender names float above received bubbles, resolved once
// after load and lazily for live arrivals from previously-unseen senders.

import { m } from 'framer-motion';
import { Send } from 'lucide-react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EASE_OUT } from '../../components/motion/easings';
import { Button } from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { showToast } from '../../components/ui/GlobalToast';
import { useAuth } from '../../contexts/AuthContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import {
  getGroupThreadPage,
  listGroupThreads,
  markGroupThreadRead,
  sendGroupMessage,
} from '../../services/coach/groupMessageService';
import { getProfilesByIds } from '../../services/coach/profileService';
import { subscribeToGroupThread } from '../../services/coach/realtime';
import type { GroupMessage } from '../../types/coach';
import { TypingDots } from './TypingDots';
import { CoachPage, ListSkeleton, SectionError } from './_shared';
import { formatDayLabel, formatTime, isSameLocalDay } from './messageTime';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  viewer: 'coach' | 'member';
}

/** Grow a single-row composer to fit its content, capped by its CSS max-height. */
function autoGrow(el: HTMLTextAreaElement): void {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GroupThread({ viewer }: Props) {
  const { groupId = '' } = useParams<{ groupId: string }>();
  const { user } = useAuth();
  const me = user?.id ?? '';

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [groupName, setGroupName] = useState<string>('קבוצה');
  const [senderNames, setSenderNames] = useState<Map<string, string>>(new Map());
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

  // Collapse the auto-grown composer back to one row after a successful send.
  useEffect(() => {
    if (body === '' && composerRef.current) composerRef.current.style.height = 'auto';
  }, [body]);
  // Debounce markRead on incoming realtime messages: avoid hammering the DB
  // for a burst of arriving messages in a short window.
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Sender ids whose names were already requested — checked OUTSIDE the
  // setSenderNames updater so a live arrival never fires resolveNames from
  // within a state updater (which double-fires under StrictMode).
  const knownSendersRef = useRef<Set<string>>(new Set());

  // -------------------------------------------------------------------------
  // Resolve sender display names for a set of ids.
  // -------------------------------------------------------------------------
  const resolveNames = async (ids: string[]) => {
    if (ids.length === 0) return;
    const map = await getProfilesByIds(ids);
    setSenderNames((prev) => {
      const next = new Map(prev);
      for (const [id, profile] of map) {
        next.set(id, profile.displayName ?? 'משתתף');
      }
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Load: fetch thread + group name + resolve initial sender names.
  // -------------------------------------------------------------------------
  // `isStale` lets the mount/param-change effect cancel an in-flight load:
  // switching group A→B must not let a slow A response overwrite B's messages
  // (or markGroupThreadRead stamp the wrong thread). Defaults to never-stale
  // for direct calls (retry button).
  const load = async (isStale: () => boolean = () => false) => {
    setError(false);
    try {
      // Fetch messages and group name in parallel.
      const [page, summaries] = await Promise.all([
        getGroupThreadPage(groupId),
        listGroupThreads(viewer),
      ]);
      if (isStale()) return;
      const msgs = page.messages;

      setMessages(msgs);
      setHasMore(page.hasMore);

      const summary = summaries.find((s) => s.groupId === groupId);
      if (summary) setGroupName(summary.name);

      setLoading(false);

      // Resolve all distinct sender names in one call (exclude self — we
      // never show a name label above our own bubbles).
      const distinctSenderIds = [...new Set(msgs.map((m) => m.senderId).filter((id) => id !== me))];
      knownSendersRef.current = new Set(distinctSenderIds);
      void resolveNames(distinctSenderIds);

      // Mark read + dispatch badge refresh.
      await markGroupThreadRead(groupId, viewer);
      window.dispatchEvent(new Event('coach:unread-refresh'));
    } catch {
      if (isStale()) return;
      setError(true);
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-load only when groupId or viewer changes
  useEffect(() => {
    if (!groupId) return;
    let cancelled = false;
    void load(() => cancelled);
    return () => {
      cancelled = true;
    };
  }, [groupId, viewer]);

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
      const page = await getGroupThreadPage(groupId, oldest);
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

  // -------------------------------------------------------------------------
  // Realtime: append live messages; announce incoming; debounce markRead.
  // -------------------------------------------------------------------------
  // biome-ignore lint/correctness/useExhaustiveDependencies: resolveNames only wraps setState — stable by construction
  useEffect(() => {
    if (!groupId) return;
    return subscribeToGroupThread(groupId, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));

      if (m.senderId !== me) {
        setLiveAnnouncement('הודעה חדשה התקבלה');

        // Lazily resolve unknown sender names (ref check, NOT inside a state
        // updater — updaters must stay pure and re-run under StrictMode).
        if (!knownSendersRef.current.has(m.senderId)) {
          knownSendersRef.current.add(m.senderId);
          void resolveNames([m.senderId]);
        }

        // Debounced markRead: at most one DB write per 1.5 s burst.
        if (markReadTimerRef.current !== null) clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = setTimeout(() => {
          void markGroupThreadRead(groupId, viewer).then(() =>
            window.dispatchEvent(new Event('coach:unread-refresh'))
          );
        }, 1500);
      }
    });
  }, [groupId, viewer, me]);

  // Cleanup debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (markReadTimerRef.current !== null) clearTimeout(markReadTimerRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Auto-scroll to bottom whenever messages change.
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // Send.
  // -------------------------------------------------------------------------
  const handleSend = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(false);
    setBody('');

    // Optimistic append: show the message immediately with a temp id, then
    // reconcile by a single getGroupThread on success. Rolled back on failure.
    const tempId = `temp-${Date.now()}`;
    const optimistic: GroupMessage = {
      id: tempId,
      groupId,
      senderId: me,
      body: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const { error: sendErr } = await sendGroupMessage(groupId, text);
    if (sendErr) {
      setMessages((prev) => prev.filter((x) => x.id !== tempId));
      setBody(text);
      setSendError(true);
      setSending(false);
      return;
    }
    // Reconcile temp → persisted rows without a full reload (no read churn).
    // Merge, don't replace: earlier pages the user already loaded must survive.
    try {
      const page = await getGroupThreadPage(groupId);
      setMessages((prev) => {
        const ids = new Set(page.messages.map((m) => m.id));
        const firstAt = page.messages[0]?.createdAt ?? '';
        const older = prev.filter(
          (m) => !ids.has(m.id) && !m.id.startsWith('temp-') && (m.createdAt ?? '') < firstAt
        );
        return [...older, ...page.messages];
      });
    } catch {
      // Keep the optimistic bubble; realtime will catch up.
    }
    setSending(false);
  };

  // -------------------------------------------------------------------------
  // Render.
  // -------------------------------------------------------------------------
  return (
    <CoachPage title={groupName} subtitle="צ׳אט קבוצתי">
      {/* Stable live region — must be outside containers that can unmount.
          Announces incoming messages to screen readers without visual change. */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {liveAnnouncement}
      </div>

      {/* Pad the scroll area so the last bubble clears the fixed composer. */}
      <div
        className="flex flex-col gap-2"
        style={{ minHeight: '50dvh', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}
      >
        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <SectionError onRetry={() => void load()} />
        ) : messages.length === 0 ? (
          <EmptyState
            illustration="notes"
            title="אין הודעות עדיין"
            description="כתבו את ההודעה הראשונה לקבוצה."
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
              const mine = msg.senderId === me;
              const senderLabel = !mine ? (senderNames.get(msg.senderId) ?? 'משתתף') : null;
              const time = formatTime(msg.createdAt);
              const prev = i > 0 ? messages[i - 1] : null;
              const showDivider =
                !prev || !isSameLocalDay(msg.createdAt ?? '', prev.createdAt ?? '');

              const itemStyle = {
                // Logical alignment: inline-start auto → inline-END for mine
                // (right in RTL); inline-end auto → inline-START for received.
                marginInlineStart: mine ? 'auto' : 0,
                marginInlineEnd: mine ? 0 : 'auto',
                maxWidth: '80%',
                display: 'flex',
                flexDirection: 'column' as const,
                gap: 2,
              };

              const inner = (
                <>
                  {/* Sender name label — only for messages not sent by me. */}
                  {senderLabel !== null && (
                    <span
                      aria-hidden="true"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--fs-muted)',
                        paddingInlineStart: 4,
                        display: 'block',
                      }}
                    >
                      <bdi>{senderLabel}</bdi>
                    </span>
                  )}

                  {/* Bubble */}
                  <div
                    style={{
                      background: mine ? 'var(--fs-primary)' : 'var(--fs-surface)',
                      color: mine ? 'var(--fs-accent)' : 'var(--fs-ink)',
                      // mine sits on the primary fill where --fs-surface-2 is
                      // near-invisible — use a low-alpha edge instead.
                      border: mine
                        ? '1px solid color-mix(in srgb, var(--fs-accent) 22%, transparent)'
                        : '1px solid var(--fs-surface-2)',
                      padding: '8px 12px',
                      fontFamily: 'var(--font-body)',
                      fontSize: 14,
                      textAlign: 'start',
                    }}
                  >
                    {/* dir="auto" resolves base direction per-bubble for mixed Hebrew/English content. */}
                    <span dir="auto" style={{ display: 'block', textAlign: 'start' }}>
                      {msg.body}
                    </span>
                    {/* Per-message time — LTR numerals, mono, muted. */}
                    {time && (
                      <span
                        dir="ltr"
                        style={{
                          display: 'block',
                          marginTop: 3,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          color: 'var(--fs-muted)',
                          textAlign: 'start',
                        }}
                      >
                        {time}
                      </span>
                    )}
                  </div>
                </>
              );

              const ariaLabel = mine ? 'הודעה שנשלחה' : `הודעה מ${senderLabel}`;

              // Mount entrance (opacity:0,y:8 → settled); static under reduced-motion.
              // Group messages have no per-message read state, so no read receipt.
              const bubble = reduced ? (
                <div role="article" aria-label={ariaLabel} style={itemStyle}>
                  {inner}
                </div>
              ) : (
                <m.div
                  role="article"
                  aria-label={ariaLabel}
                  style={itemStyle}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: EASE_OUT }}
                >
                  {inner}
                </m.div>
              );

              return (
                <Fragment key={msg.id}>
                  {showDivider && <DayDivider iso={msg.createdAt} />}
                  {bubble}
                </Fragment>
              );
            })}
            {/* "Delivering" indicator on my in-flight send — backed by `sending`. */}
            {sending && (
              <div style={{ marginInlineStart: 'auto', marginInlineEnd: 0 }}>
                <TypingDots />
              </div>
            )}
          </>
        )}
        <div ref={endRef} />
      </div>

      {/* Fixed composer — identical to MessageThread. */}
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
        <div className="flex gap-2 items-end">
          {/* Single-row chat composer that auto-grows on input. Enter sends;
              Shift+Enter inserts a newline. Deliberately not the form <Textarea>. */}
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
            placeholder="כתוב הודעה…"
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
          {/* 44×44 send control — tinted primary, matching MessageThread. */}
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

// ============================================================================
// GROUP THREAD — group chat screen (shared by coach and member roles)
// ============================================================================
// Mirrors MessageThread's bubble/composer/realtime pattern but extends it for
// group participants: sender names float above received bubbles, resolved once
// after load and lazily for live arrivals from previously-unseen senders.

import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { showToast } from '../../components/ui/GlobalToast';
import { useAuth } from '../../contexts/AuthContext';
import {
  getGroupThread,
  listGroupThreads,
  markGroupThreadRead,
  sendGroupMessage,
} from '../../services/coach/groupMessageService';
import { getProfilesByIds } from '../../services/coach/profileService';
import { subscribeToGroupThread } from '../../services/coach/realtime';
import type { GroupMessage } from '../../types/coach';
import { CoachPage, ListSkeleton, SectionError } from './_shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  viewer: 'coach' | 'member';
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
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  // Debounce markRead on incoming realtime messages: avoid hammering the DB
  // for a burst of arriving messages in a short window.
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const load = async () => {
    setError(false);
    try {
      // Fetch messages and group name in parallel.
      const [msgs, summaries] = await Promise.all([
        getGroupThread(groupId),
        listGroupThreads(viewer),
      ]);

      setMessages(msgs);

      const summary = summaries.find((s) => s.groupId === groupId);
      if (summary) setGroupName(summary.name);

      setLoading(false);

      // Resolve all distinct sender names in one call (exclude self — we
      // never show a name label above our own bubbles).
      const distinctSenderIds = [...new Set(msgs.map((m) => m.senderId).filter((id) => id !== me))];
      void resolveNames(distinctSenderIds);

      // Mark read + dispatch badge refresh.
      await markGroupThreadRead(groupId, viewer);
      window.dispatchEvent(new Event('coach:unread-refresh'));
    } catch {
      setError(true);
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-load only when groupId or viewer changes
  useEffect(() => {
    if (groupId) void load();
  }, [groupId, viewer]);

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

        // Lazily resolve unknown sender names.
        setSenderNames((prev) => {
          if (!prev.has(m.senderId)) {
            void resolveNames([m.senderId]);
          }
          return prev;
        });

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
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom whenever messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // -------------------------------------------------------------------------
  // Send.
  // -------------------------------------------------------------------------
  const handleSend = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setBody('');
    const { error: sendErr } = await sendGroupMessage(groupId, text);
    if (sendErr) {
      setBody(text);
      showToast('שליחת ההודעה נכשלה', 'error');
      setSending(false);
      return;
    }
    await load();
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
        style={{ minHeight: '50vh', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}
      >
        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <SectionError onRetry={() => void load()} />
        ) : messages.length === 0 ? (
          <div
            role="status"
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              color: 'var(--fs-muted)',
              lineHeight: 1.7,
            }}
          >
            אין הודעות עדיין — אפשר לפתוח את השיחה
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === me;
            const senderLabel = !mine ? (senderNames.get(m.senderId) ?? 'משתתף') : null;

            return (
              <div
                key={m.id}
                role="article"
                aria-label={mine ? 'הודעה שנשלחה' : `הודעה מ${senderLabel}`}
                style={{
                  // Logical alignment: inline-start auto → inline-END for mine
                  // (right in RTL); inline-end auto → inline-START for received.
                  marginInlineStart: mine ? 'auto' : 0,
                  marginInlineEnd: mine ? 0 : 'auto',
                  maxWidth: '80%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {/* Sender name label — only for messages not sent by me. */}
                {senderLabel !== null && (
                  <span
                    aria-hidden="true"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
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
                    border: '1px solid var(--fs-surface-2)',
                    padding: '8px 12px',
                    fontFamily: 'var(--font-body)',
                    fontSize: 14,
                    textAlign: 'start',
                  }}
                >
                  {/* dir="auto" resolves base direction per-bubble for mixed Hebrew/English content. */}
                  <span dir="auto" style={{ display: 'block', textAlign: 'start' }}>
                    {m.body}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Fixed composer — identical to MessageThread. */}
      <div
        className="flex gap-2 items-end fixed inset-x-0 bottom-0 px-5 pt-3"
        style={{
          background: 'var(--fs-bg)',
          borderTop: '1px solid var(--fs-surface-2)',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Single-row chat composer. Enter sends; Shift+Enter inserts a newline.
            Deliberately not the form <Textarea> — message bars stay one row tall. */}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
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
          }}
        />
        {/* 44×44 send control — tinted primary, matching MessageThread. */}
        <Button
          variant="primary"
          size="icon"
          aria-label="שלח"
          onClick={handleSend}
          disabled={!body.trim() || sending}
          className="shrink-0"
          style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }}
        >
          <Send size={18} aria-hidden="true" />
        </Button>
      </div>
    </CoachPage>
  );
}

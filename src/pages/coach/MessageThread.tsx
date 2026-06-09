// ============================================================================
// MESSAGE THREAD — async coach<->client conversation (shared by both roles)
// ============================================================================

import { m } from 'framer-motion';
import { Check, CheckCheck, Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { EASE_OUT } from '../../components/motion/easings';
import { Button } from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { showToast } from '../../components/ui/GlobalToast';
import { useAuth } from '../../contexts/AuthContext';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { getThread, markThreadRead, sendMessage, subscribeToThread } from '../../services/coach';
import type { Message } from '../../types/coach';
import { CoachPage, ListSkeleton } from './_shared';
import { TypingDots } from './TypingDots';

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
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  const load = async () => {
    setError(false);
    try {
      const thread = await getThread(coachId, clientId);
      setMessages(thread);
      setLoading(false);
      await markThreadRead(coachId, clientId);
      window.dispatchEvent(new Event('coach:unread-refresh'));
    } catch {
      // Network/RLS failure: surface a retry instead of an endless skeleton.
      setError(true);
      setLoading(false);
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-load only when the thread participants change
  useEffect(() => {
    if (coachId && clientId) void load();
  }, [coachId, clientId]);

  // Live-append messages as they arrive; mark them read since the thread is open.
  // Announce incoming messages (not my own) to screen readers via the live region.
  useEffect(() => {
    if (!coachId || !clientId) return;
    return subscribeToThread(coachId, clientId, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      if (m.senderId !== me) {
        setLiveAnnouncement('הודעה חדשה התקבלה');
      }
      void markThreadRead(coachId, clientId).then(() =>
        window.dispatchEvent(new Event('coach:unread-refresh'))
      );
    });
  }, [coachId, clientId, me]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom whenever messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    setBody('');
    const { error } = await sendMessage(coachId, clientId, text);
    if (error) {
      // Restore the unsent text so it isn't silently lost, and tell the user.
      setBody(text);
      showToast('שליחת ההודעה נכשלה', 'error');
      setSending(false);
      return;
    }
    await load();
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
        style={{ minHeight: '50vh', paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}
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
            {messages.map((msg) => (
              <Bubble key={msg.id} message={msg} mine={msg.senderId === me} reduced={reduced} />
            ))}
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
        className="flex gap-2 items-end fixed inset-x-0 bottom-0 px-5 pt-3"
        style={{
          background: 'var(--fs-bg)',
          borderTop: '1px solid var(--fs-surface-2)',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Compact single-line chat composer — the form <Textarea> (88px min)
            is intentionally not used here; a message bar must stay one row tall
            and auto-send on Enter. Still fully labelled + RTL via text-align:start. */}
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
          }}
        />
        {/* 44×44 send control (foundation Button icon size) tinted primary. */}
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

// ── Bubble ──────────────────────────────────────────────────────────────────────
// One message bubble with a mount entrance (opacity:0,y:8 → settled). My own
// bubbles carry a read receipt: a single check = delivered, a double check
// (accent) = read, derived from the existing `readAt` field. prefers-reduced-
// motion renders instantly with no transform.

function Bubble({ message, mine, reduced }: { message: Message; mine: boolean; reduced: boolean }) {
  const read = message.readAt !== null;
  const bubbleStyle = {
    // Logical alignment: `margin-inline-start:auto` pushes a flex item to the
    // inline-END (right in RTL) for MY messages; `margin-inline-end:auto`
    // pushes received ones to inline-START.
    marginInlineStart: mine ? 'auto' : 0,
    marginInlineEnd: mine ? 0 : 'auto',
    maxWidth: '80%',
    background: mine ? 'var(--fs-primary)' : 'var(--fs-surface)',
    color: mine ? 'var(--fs-accent)' : 'var(--fs-ink)',
    border: '1px solid var(--fs-surface-2)',
    padding: '8px 12px',
    fontFamily: 'var(--font-body)',
    fontSize: 14,
    textAlign: 'start' as const,
  };

  const inner = (
    <>
      {/* dir="auto" lets each bubble resolve its own base direction for
          user-generated content that may be Hebrew or English. */}
      <span dir="auto" style={{ display: 'block', textAlign: 'start' }}>
        {message.body}
      </span>
      {mine && (
        <span
          aria-label={read ? 'נקרא' : 'נשלח'}
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            marginTop: 3,
            color: read ? 'var(--fs-accent)' : 'var(--fs-muted)',
          }}
        >
          {read ? (
            <CheckCheck size={13} strokeWidth={2.5} aria-hidden="true" />
          ) : (
            <Check size={13} strokeWidth={2.5} aria-hidden="true" />
          )}
        </span>
      )}
    </>
  );

  if (reduced) {
    return (
      <div role="article" aria-label={mine ? 'הודעה שנשלחה' : 'הודעה שהתקבלה'} style={bubbleStyle}>
        {inner}
      </div>
    );
  }

  return (
    <m.div
      role="article"
      aria-label={mine ? 'הודעה שנשלחה' : 'הודעה שהתקבלה'}
      style={bubbleStyle}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE_OUT }}
    >
      {inner}
    </m.div>
  );
}

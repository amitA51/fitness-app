// ============================================================================
// MESSAGE THREAD — async coach<->client conversation (shared by both roles)
// ============================================================================

import { Send } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { useAuth } from '../../contexts/AuthContext';
import { getThread, markThreadRead, sendMessage, subscribeToThread } from '../../services/coach';
import type { Message } from '../../types/coach';
import { CoachPage, ListSkeleton } from './_shared';

export default function MessageThread({ viewer }: { viewer: 'coach' | 'trainee' }) {
  const { otherId = '' } = useParams<{ otherId: string }>();
  const { user } = useAuth();
  const me = user?.id ?? '';
  const coachId = viewer === 'coach' ? me : otherId;
  const clientId = viewer === 'coach' ? otherId : me;

  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const thread = await getThread(coachId, clientId);
    setMessages(thread);
    setLoading(false);
    await markThreadRead(coachId, clientId);
    window.dispatchEvent(new Event('coach:unread-refresh'));
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-load only when the thread participants change
  useEffect(() => {
    if (coachId && clientId) void load();
  }, [coachId, clientId]);

  // Live-append messages as they arrive; mark them read since the thread is open.
  useEffect(() => {
    if (!coachId || !clientId) return;
    return subscribeToThread(coachId, clientId, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      void markThreadRead(coachId, clientId).then(() =>
        window.dispatchEvent(new Event('coach:unread-refresh'))
      );
    });
  }, [coachId, clientId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom whenever messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = body.trim();
    if (!text) return;
    setBody('');
    const { error } = await sendMessage(coachId, clientId, text);
    if (!error) await load();
  };

  return (
    <CoachPage title="הודעות" subtitle="Messages">
      <div className="flex flex-col gap-2" style={{ minHeight: '50vh' }}>
        {loading ? (
          <ListSkeleton rows={4} />
        ) : messages.length === 0 ? (
          <EmptyState
            illustration="notes"
            title="אין הודעות עדיין"
            description="כתוב את ההודעה הראשונה."
          />
        ) : (
          messages.map((m) => {
            const mine = m.senderId === me;
            return (
              <div
                key={m.id}
                role="article"
                aria-label={mine ? 'הודעה שנשלחה' : 'הודעה שהתקבלה'}
                style={{
                  // Logical alignment: `margin-inline-start:auto` pushes a flex
                  // item to the inline-END (right in RTL) for MY messages;
                  // `margin-inline-end:auto` pushes received ones to inline-START.
                  marginInlineStart: mine ? 'auto' : 0,
                  marginInlineEnd: mine ? 0 : 'auto',
                  maxWidth: '80%',
                  background: mine ? 'var(--fs-primary)' : 'var(--fs-surface)',
                  color: mine ? 'var(--fs-accent)' : 'var(--fs-ink)',
                  border: '1px solid var(--fs-surface-2)',
                  padding: '8px 12px',
                  fontFamily: 'var(--font-body)',
                  fontSize: 14,
                  textAlign: 'start',
                }}
              >
                {m.body}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div
        className="flex gap-2 items-end fixed inset-x-0 bottom-0 px-5 py-3"
        style={{ background: 'var(--fs-bg)', borderTop: '1px solid var(--fs-surface-2)' }}
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
          className="shrink-0"
          style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }}
        >
          <Send size={18} aria-hidden="true" />
        </Button>
      </div>
    </CoachPage>
  );
}

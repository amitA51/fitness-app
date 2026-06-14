// ============================================================================
// TimelineBox — unified activity timeline for the coach's client detail screen
// Props-driven (no fetching): merges sessions + checkIns + assignments.
// Fresh Steel / Obsidian design system
// ============================================================================

import { ClipboardCheck, Dumbbell, Send } from 'lucide-react';
import type { CheckIn } from '../../../services/coach/checkInService';
import type { WorkoutSession } from '../../../types';
import type { Assignment } from '../../../types/coach';
import { HE_NOUNS, pluralizeHe } from '../../../utils/pluralizeHe';
import { InlineEmpty, formatDate } from '../_shared';

const MAX_ITEMS = 15;

// ---- unified event type -------------------------------------------------------

type SessionEvent = {
  kind: 'session';
  ts: number;
  id: string;
  title: string;
  meta: string;
};

type CheckInEvent = {
  kind: 'checkin';
  ts: number;
  id: string;
  meta: string;
};

type AssignmentEvent = {
  kind: 'assignment';
  ts: number;
  id: string;
  title: string;
};

type TimelineEvent = SessionEvent | CheckInEvent | AssignmentEvent;

// ---- merge + sort helper ------------------------------------------------------

function buildTimeline(
  sessions: WorkoutSession[],
  checkIns: CheckIn[],
  assignments: Assignment[]
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const s of sessions) {
    const ts = s.startTime ? new Date(s.startTime).getTime() : new Date(s.createdAt).getTime();
    if (!Number.isFinite(ts)) continue;
    const volume = Math.round(s.totalVolume);
    const parts: string[] = [];
    // The coach note becomes the row heading (see EventRow), so keep it OUT of the
    // meta line to avoid showing the same text twice.
    if (volume > 0) parts.push(`${volume} ק"ג נפח`);
    if (s.exercises.length > 0) parts.push(pluralizeHe(s.exercises.length, HE_NOUNS.exercise));
    events.push({
      kind: 'session',
      ts,
      id: s.id,
      title: s.notes?.trim() || 'אימון הושלם',
      meta: parts.join(' · ') || '—',
    });
  }

  for (const ci of checkIns) {
    const ts = ci.createdAt ? new Date(ci.createdAt).getTime() : new Date(ci.date).getTime();
    if (!Number.isFinite(ts)) continue;
    const parts: string[] = [];
    if (ci.weight != null) parts.push(`${ci.weight} ק"ג`);
    if (ci.mood != null) parts.push(`מצב רוח ${ci.mood}/5`);
    events.push({
      kind: 'checkin',
      ts,
      id: ci.id,
      meta: parts.join(' · ') || formatDate(ci.date),
    });
  }

  for (const a of assignments) {
    const ts = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    if (!Number.isFinite(ts)) continue;
    events.push({
      kind: 'assignment',
      ts,
      id: a.id,
      title: a.title || a.kind,
    });
  }

  // newest first, cap at MAX_ITEMS
  return events.sort((a, b) => b.ts - a.ts).slice(0, MAX_ITEMS);
}

// ---- icon square --------------------------------------------------------------

function IconCell({ children }: { children: React.ReactNode }) {
  return (
    <div
      aria-hidden="true"
      style={{
        width: 36,
        height: 36,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        color: 'var(--fs-accent)',
      }}
    >
      {children}
    </div>
  );
}

// ---- row per event type -------------------------------------------------------

function EventRow({ event }: { event: TimelineEvent }) {
  const dateStr = formatDate(new Date(event.ts).toISOString());

  if (event.kind === 'session') {
    return (
      <div
        className="flex items-start gap-3 px-4 py-3"
        style={{
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          marginBottom: 8,
        }}
      >
        <IconCell>
          <Dumbbell size={16} />
        </IconCell>
        <div className="flex-1 min-w-0">
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--fs-ink)',
            }}
          >
            <bdi>{event.title}</bdi>
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fs-muted)',
            }}
          >
            <bdi>{event.meta}</bdi>
          </div>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--fs-muted)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          dir="ltr"
        >
          {dateStr}
        </span>
      </div>
    );
  }

  if (event.kind === 'checkin') {
    return (
      <div
        className="flex items-start gap-3 px-4 py-3"
        style={{
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          marginBottom: 8,
        }}
      >
        <IconCell>
          <ClipboardCheck size={16} />
        </IconCell>
        <div className="flex-1 min-w-0">
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--fs-ink)',
            }}
          >
            צ׳ק-אין
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fs-muted)',
            }}
          >
            <bdi>{event.meta}</bdi>
          </div>
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            color: 'var(--fs-muted)',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
          dir="ltr"
        >
          {dateStr}
        </span>
      </div>
    );
  }

  // kind === 'assignment'
  return (
    <div
      className="flex items-start gap-3 px-4 py-3"
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        marginBottom: 8,
      }}
    >
      <IconCell>
        <Send size={16} />
      </IconCell>
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--fs-ink)',
          }}
        >
          שיוך נשלח
        </div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fs-muted)',
          }}
        >
          <bdi>{event.title}</bdi>
        </div>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--fs-muted)',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        dir="ltr"
      >
        {dateStr}
      </span>
    </div>
  );
}

// ---- exported component -------------------------------------------------------

interface TimelineBoxProps {
  sessions: WorkoutSession[];
  checkIns: CheckIn[];
  assignments: Assignment[];
}

export function TimelineBox({ sessions, checkIns, assignments }: TimelineBoxProps) {
  const events = buildTimeline(sessions, checkIns, assignments);

  if (events.length === 0) {
    return <InlineEmpty>אין פעילות עדיין.</InlineEmpty>;
  }

  return (
    <div>
      {events.map((event) => (
        <EventRow key={`${event.kind}-${event.id}`} event={event} />
      ))}
    </div>
  );
}

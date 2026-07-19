// ============================================================================
// COACH PLATFORM — roster building blocks shared by the command center
// (CoachHome) and the full roster page (CoachClients).
// ============================================================================

import { m } from 'framer-motion';
import { Check, MessageSquare, User } from 'lucide-react';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import {
  type ClientOverviewRow,
  type StatusDotShape,
  type TodayScheduleCount,
  clientStatusMeta,
  getRecentCheckInFlags,
  getScheduledTodayByClient,
  getUnreadCountByClient,
} from '../../services/coach';
import { ListRow, formatDate } from './_shared';

// ── Roster signals ────────────────────────────────────────────────────────────
// Per-client triage signals (unread messages, recent check-ins, today's plan)
// shared by the command center (CoachHome) and the full roster (CoachClients).

/** Command-center signals fetched once the roster resolves (best-effort). */
export interface RosterSignals {
  unreadByClient: Record<string, number>;
  recentCheckIns: Set<string>;
  scheduledToday: Record<string, TodayScheduleCount>;
}

const EMPTY_SIGNALS: RosterSignals = {
  unreadByClient: {},
  recentCheckIns: new Set(),
  scheduledToday: {},
};

/**
 * Fetch the roster signals for a set of client ids. Best-effort — each source
 * degrades to empty on failure without breaking the page. One batched query
 * per source (no N+1). `signalsLoading` is true while in flight so callers can
 * render placeholders instead of flashing hard zeros.
 */
export function useRosterSignals(clientIds: string[]): {
  signals: RosterSignals;
  signalsLoading: boolean;
} {
  // Stable join key — the effect derives the ids back from it so it never
  // closes over a separately-memoized array.
  const clientIdsKey = clientIds.join(',');
  const [signals, setSignals] = useState<RosterSignals>(EMPTY_SIGNALS);
  const [signalsLoading, setSignalsLoading] = useState(true);

  useEffect(() => {
    const ids = clientIdsKey ? clientIdsKey.split(',') : [];
    if (ids.length === 0) {
      setSignals(EMPTY_SIGNALS);
      setSignalsLoading(false);
      return;
    }
    let cancelled = false;
    setSignalsLoading(true);
    void Promise.allSettled([
      getUnreadCountByClient(),
      getRecentCheckInFlags(ids),
      getScheduledTodayByClient(ids),
    ]).then(([unreadRes, checkInRes, scheduleRes]) => {
      if (cancelled) return;
      setSignals({
        unreadByClient: unreadRes.status === 'fulfilled' ? unreadRes.value : {},
        recentCheckIns: checkInRes.status === 'fulfilled' ? checkInRes.value : new Set(),
        scheduledToday: scheduleRes.status === 'fulfilled' ? scheduleRes.value : {},
      });
      setSignalsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [clientIdsKey]);

  return { signals, signalsLoading };
}

/** 44×44 icon-only button. accent=true swaps color to --fs-accent. */
export function RowIconBtn({
  onClick,
  label,
  accent = false,
  children,
}: { onClick: () => void; label: string; accent?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
      style={{
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        height: 44,
        border: 'none',
        background: 'transparent',
        color: accent ? 'var(--fs-accent)' : 'var(--fs-muted)',
        cursor: 'pointer',
        borderRadius: 4,
      }}
    >
      {children}
    </button>
  );
}

/**
 * Severity dot — a NON-color cue distinguishing same-color status tiers:
 * `filled` = graver (inactive/active), `ring` = lighter (at_risk), `none` = no
 * dot. Mirrors WeekGrid's filled-vs-ring scheduled indicator. aria-hidden — the
 * tier is exposed to assistive tech via the row's sr-only / chip label text.
 */
function StatusDot({
  shape,
  color,
  size = 7,
}: { shape: StatusDotShape; color: string; size?: number }) {
  if (shape === 'none') return null;
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        flexShrink: 0,
        background: shape === 'filled' ? color : 'transparent',
        border: shape === 'ring' ? `1.5px solid ${color}` : 'none',
      }}
    />
  );
}

export function StatusChip({
  label,
  color,
  dot = 'filled',
}: { label: string; color: string; dot?: StatusDotShape }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
        color,
      }}
    >
      <StatusDot shape={dot} color={color} />
      {label}
    </span>
  );
}

/**
 * A command-center overview stat. `indicator` adds a small status glyph beside
 * the number: a pulse-free dot for "due today" and a check for "trained today",
 * tinted to the stat's own color so it reads as one unit. The dot is static
 * (no blinking) per the anti-slop no-animated-status-dot rule.
 */
export function OverviewStat({
  label,
  value,
  color,
  indicator,
  loading = false,
}: {
  label: string;
  value: number;
  color?: string;
  indicator?: 'due' | 'trained';
  /** While the underlying signal is in flight, render a dash, not a hard 0. */
  loading?: boolean;
}) {
  const tone = color ?? 'var(--fs-heading)';
  return (
    <div
      className="px-4 py-4"
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center gap-2">
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 24,
            fontWeight: 700,
            fontVariantNumeric: 'tabular-nums',
            color: loading ? 'var(--fs-muted)' : tone,
            lineHeight: 1,
          }}
        >
          {loading ? <span aria-hidden="true">—</span> : <span dir="ltr">{value}</span>}
        </div>
        {!loading && indicator === 'due' && value > 0 && (
          <span
            aria-hidden="true"
            style={{ width: 8, height: 8, borderRadius: 999, background: tone, flexShrink: 0 }}
          />
        )}
        {!loading && indicator === 'trained' && value > 0 && (
          <Check
            size={14}
            strokeWidth={3}
            style={{ color: tone, flexShrink: 0 }}
            aria-hidden="true"
          />
        )}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.06em',
          color: 'var(--fs-muted)',
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export function QuickLink({
  icon,
  label,
  onClick,
  badge,
}: { icon: React.ReactNode; label: string; onClick: () => void; badge?: number }) {
  const hasUnread = typeof badge === 'number' && badge > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hasUnread ? `${label}, ${badge} שלא נקראו` : label}
      className="flex flex-col items-center justify-center gap-1.5 py-3 min-h-[56px]"
      style={{
        position: 'relative',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        color: 'var(--fs-heading)',
      }}
    >
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        {icon}
        {hasUnread && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: -5,
              insetInlineEnd: -8,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--fs-primary)',
              color: 'var(--fs-accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              fontWeight: 700,
              borderRadius: 999,
              lineHeight: 1,
            }}
          >
            <span dir="ltr">{badge}</span>
          </span>
        )}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          letterSpacing: '-0.01em',
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ── AttentionRow ──────────────────────────────────────────────────────────────
// Renders as a plain <div> — NOT a <button> — so the two action buttons inside
// are never nested inside an interactive element (nested <button> = invalid HTML).

export function AttentionRow({
  row,
  onOpenClient,
  onMessage,
}: { row: ClientOverviewRow; onOpenClient: () => void; onMessage: () => void }) {
  const name = row.client.clientProfile?.displayName ?? 'מתאמן';
  const { color, label: statusLabel, dot } = clientStatusMeta(row.analytics.level);
  const days = row.analytics.daysSinceActivity;
  // Gender-neutral phrasing; number stays LTR inside RTL layout.
  const meta =
    days !== null && days > 0
      ? `ללא אימון ${days} ימים`
      : row.analytics.sessionsLast7 === 0
        ? 'ללא אימון השבוע'
        : clientStatusMeta(row.analytics.level).label;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        marginBottom: 8,
        minHeight: 56,
      }}
    >
      <StatusDot shape={dot} color={color} size={8} />
      <div className="flex-1 min-w-0">
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--fs-ink)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <bdi>{name}</bdi>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fs-warn)' }}>
          {/* The severity tier is conveyed visually only by the aria-hidden dot
              color, so expose it to assistive tech as visually-hidden text. */}
          <span className="sr-only">{statusLabel}: </span>
          <span dir="ltr">{meta}</span>
        </div>
      </div>
      <RowIconBtn onClick={onMessage} label={`שליחת הודעה ל${name}`}>
        <MessageSquare size={18} aria-hidden="true" />
      </RowIconBtn>
      <RowIconBtn onClick={onOpenClient} label={`פתח פרופיל של ${name}`} accent>
        <User size={18} aria-hidden="true" />
      </RowIconBtn>
    </div>
  );
}

// ── Signal chips ──────────────────────────────────────────────────────────────
// Non-interactive <span> badges rendered ABOVE a roster/attention row so they
// never nest inside the row's action buttons. Token-only; numbers stay dir="ltr".

function SignalChip({
  label,
  color,
  background,
}: {
  label: string;
  color: string;
  background: string;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color,
        background,
        border: `1px solid ${color}`,
        borderRadius: 999,
        padding: '2px 8px',
        lineHeight: 1.4,
      }}
    >
      {label}
    </span>
  );
}

// A trained-today WIN is a legit celebration: the chip goes --fs-signal (lime)
// and the check icon scale-pops once on appear. Any haptic celebration is the
// screen's responsibility (fired ONCE per page, not per chip).
// prefers-reduced-motion: no pop, no entrance — the lime chip still renders.
function WinChip({ label }: { label: string }) {
  const reduced = useReducedMotion();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.04em',
        color: 'var(--fs-signal)',
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-signal)',
        borderRadius: 999,
        padding: '2px 8px',
        lineHeight: 1.4,
      }}
    >
      {reduced ? (
        <Check size={11} strokeWidth={3} aria-hidden="true" />
      ) : (
        <m.span
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 520, damping: 16 }}
          style={{ display: 'inline-flex' }}
        >
          <Check size={11} strokeWidth={3} aria-hidden="true" />
        </m.span>
      )}
      {label}
    </span>
  );
}

export function RowSignalChips({
  unread,
  hasRecentCheckIn,
  today,
}: {
  unread: number;
  hasRecentCheckIn: boolean;
  today?: TodayScheduleCount;
}) {
  const trainedToday = (today?.done ?? 0) > 0;
  const dueToday = (today?.planned ?? 0) > 0;
  const hasAny = hasRecentCheckIn || unread > 0 || trainedToday || dueToday;
  if (!hasAny) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5"
      style={{ padding: '0 16px', marginBottom: 6 }}
    >
      {hasRecentCheckIn && (
        <SignalChip label="צ׳ק-אין חדש" color="var(--fs-accent)" background="var(--fs-surface)" />
      )}
      {unread > 0 && (
        <span
          aria-label={`${unread} הודעות שלא נקראו`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            color: 'var(--fs-accent)',
            background: 'var(--fs-primary)',
            borderRadius: 999,
            padding: '2px 8px',
            lineHeight: 1.4,
          }}
        >
          <MessageSquare size={11} aria-hidden="true" />
          <span dir="ltr">{unread}</span>
        </span>
      )}
      {trainedToday ? (
        <WinChip label="התאמן" />
      ) : dueToday ? (
        <SignalChip label="מתאמן היום" color="var(--fs-muted)" background="var(--fs-surface)" />
      ) : null}
    </div>
  );
}

// ── RosterRow ─────────────────────────────────────────────────────────────────
// ListRow renders as <button> when onClick is set — nesting a <button> inside
// would be invalid HTML. Solution: omit onClick on ListRow (renders as <div>)
// and handle all navigation via explicit buttons in the trailing slot.
//
// Signals: pass the optional unread / hasRecentCheckIn / today props (from ONE
// batched useRosterSignals fetch — never per-row) to render the same triage
// chips as CoachHome's attention list above the row. Omit them all for a quiet
// scan-and-sort row.

export function RosterRow({
  row,
  onOpen,
  onMessage,
  unread = 0,
  hasRecentCheckIn = false,
  today,
}: {
  row: ClientOverviewRow;
  onOpen: () => void;
  onMessage: () => void;
  unread?: number;
  hasRecentCheckIn?: boolean;
  today?: TodayScheduleCount;
}) {
  const { client, analytics } = row;
  const name = client.clientProfile?.displayName ?? 'מתאמן';
  const meta = analytics.lastActivity
    ? `פעילות אחרונה ${formatDate(analytics.lastActivity)} · ${analytics.sessionsLast7} אימונים השבוע`
    : `מחובר מאז ${formatDate(client.consentAt ?? client.createdAt)}`;

  const listRow = (
    <ListRow
      label={name}
      meta={meta}
      trailing={
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <RowIconBtn onClick={onMessage} label={`שליחת הודעה ל${name}`}>
            <MessageSquare size={16} aria-hidden="true" />
          </RowIconBtn>
          <button
            type="button"
            onClick={onOpen}
            aria-label={`פתח פרופיל של ${name}`}
            className="active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fs-accent)]"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              minHeight: 44,
              padding: '0 4px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            <StatusChip {...clientStatusMeta(analytics.level)} />
          </button>
        </div>
      }
    />
  );

  if (unread === 0 && !hasRecentCheckIn && !today) return listRow;
  return (
    <div>
      <RowSignalChips unread={unread} hasRecentCheckIn={hasRecentCheckIn} today={today} />
      {listRow}
    </div>
  );
}

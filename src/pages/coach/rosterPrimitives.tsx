// ============================================================================
// COACH PLATFORM — roster building blocks shared by the command center
// (CoachHome) and the full roster page (CoachClients).
// ============================================================================

import { Check, MessageSquare, UserPlus } from 'lucide-react';
import type React from 'react';
import { type ClientOverviewRow, clientStatusMeta } from '../../services/coach';
import { ListRow, formatDate } from './_shared';

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

export function StatusChip({ label, color }: { label: string; color: string }) {
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
      <span
        style={{ width: 7, height: 7, borderRadius: 999, background: color }}
        aria-hidden="true"
      />
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
}: {
  label: string;
  value: number;
  color?: string;
  indicator?: 'due' | 'trained';
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
            color: tone,
            lineHeight: 1,
          }}
        >
          <span dir="ltr">{value}</span>
        </div>
        {indicator === 'due' && value > 0 && (
          <span
            aria-hidden="true"
            style={{ width: 8, height: 8, borderRadius: 999, background: tone, flexShrink: 0 }}
          />
        )}
        {indicator === 'trained' && value > 0 && (
          <Check size={14} strokeWidth={3} style={{ color: tone, flexShrink: 0 }} aria-hidden="true" />
        )}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
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
      className="flex flex-col items-center justify-center gap-1.5 py-3"
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
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
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
  const { color } = clientStatusMeta(row.analytics.level);
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
      <span
        aria-hidden="true"
        style={{ flexShrink: 0, width: 8, height: 8, borderRadius: 999, background: color }}
      />
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
          <span dir="ltr">{meta}</span>
        </div>
      </div>
      <RowIconBtn onClick={onMessage} label={`שליחת הודעה ל${name}`}>
        <MessageSquare size={18} aria-hidden="true" />
      </RowIconBtn>
      <RowIconBtn onClick={onOpenClient} label={`פתח פרופיל של ${name}`} accent>
        <UserPlus size={18} aria-hidden="true" />
      </RowIconBtn>
    </div>
  );
}

// ── RosterRow ─────────────────────────────────────────────────────────────────
// ListRow renders as <button> when onClick is set — nesting a <button> inside
// would be invalid HTML. Solution: omit onClick on ListRow (renders as <div>)
// and handle all navigation via explicit buttons in the trailing slot.

export function RosterRow({
  row,
  onOpen,
  onMessage,
}: { row: ClientOverviewRow; onOpen: () => void; onMessage: () => void }) {
  const { client, analytics } = row;
  const name = client.clientProfile?.displayName ?? 'מתאמן';
  const meta = analytics.lastActivity
    ? `פעילות אחרונה ${formatDate(analytics.lastActivity)} · ${analytics.sessionsLast7} אימונים השבוע`
    : `מחובר מאז ${formatDate(client.consentAt ?? client.createdAt)}`;

  return (
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
}

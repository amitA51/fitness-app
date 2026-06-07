// ============================================================================
// COACH HOME — command center: attention triage, quick links, roster
// ============================================================================

import { MessageSquare, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { useCoach } from '../../contexts/CoachContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import {
  type ClientOverviewRow,
  clientStatusMeta,
  getClientsOverview,
  getSeatUsage,
  listClients,
  summarizeRoster,
} from '../../services/coach';
import {
  CoachPage,
  ListRow,
  ListSkeleton,
  Section,
  SectionError,
  formatDate,
  useAsyncData,
} from './_shared';

export default function CoachHome() {
  const navigate = useNavigate();
  const { isCoach, loading: coachLoading, enable } = useCoach();
  const [enabling, setEnabling] = useState(false);

  if (coachLoading) {
    return (
      <CoachPage title="מאמן" subtitle="Coaching">
        <ListSkeleton rows={4} />
      </CoachPage>
    );
  }

  if (!isCoach) {
    return (
      <CoachPage title="מצב מאמן" subtitle="Coaching" onBack={() => navigate('/')}>
        <Section>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--fs-ink)',
              lineHeight: 1.6,
              marginBottom: 20,
            }}
          >
            הפעל מצב מאמן כדי לעקוב אחרי המתאמנים שלך, לראות את האימונים והתזונה שלהם, לשייך תוכניות
            ולשלוח המלצות והודעות.
          </p>
          <Button
            variant="primary"
            fullWidth
            isLoading={enabling}
            onClick={async () => {
              setEnabling(true);
              try {
                await enable();
              } finally {
                setEnabling(false);
              }
            }}
          >
            הפעל מצב מאמן
          </Button>
        </Section>
      </CoachPage>
    );
  }

  return <Roster />;
}

type SortMode = 'attention' | 'name' | 'activity';

function Roster() {
  const navigate = useNavigate();
  const {
    data: rows,
    loading,
    error,
    reload,
  } = useAsyncData<ClientOverviewRow[]>(
    () => listClients('active').then((clients) => getClientsOverview(clients)),
    []
  );
  const { data: seats } = useAsyncData(() => getSeatUsage(), { used: 0, limit: 0, full: false });
  const unread = useUnreadMessages();
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('attention');
  const summary = useMemo(() => summarizeRoster(rows), [rows]);
  const allTags = useMemo(
    () => [...new Set(rows.flatMap((r) => r.client.tags ?? []))].sort(),
    [rows]
  );

  const filtered = useMemo(() => {
    let list = rows;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((r) =>
        (r.client.clientProfile?.displayName ?? '').toLowerCase().includes(q)
      );
    }
    if (activeTag) list = list.filter((r) => r.client.tags?.includes(activeTag));
    const sorted = [...list];
    if (sort === 'name') {
      sorted.sort((a, b) =>
        (a.client.clientProfile?.displayName ?? '').localeCompare(
          b.client.clientProfile?.displayName ?? '',
          'he'
        )
      );
    } else if (sort === 'activity') {
      sorted.sort(
        (a, b) =>
          new Date(b.client.consentAt ?? b.client.createdAt ?? 0).getTime() -
          new Date(a.client.consentAt ?? a.client.createdAt ?? 0).getTime()
      );
    }
    return sorted;
  }, [rows, search, activeTag, sort]);

  // Top-3 at_risk/inactive rows — already attention-sorted by getClientsOverview.
  const attentionRows = useMemo(
    () =>
      rows
        .filter((r) => r.analytics.level === 'at_risk' || r.analytics.level === 'inactive')
        .slice(0, 3),
    [rows]
  );

  return (
    <CoachPage
      title="המתאמנים שלי"
      subtitle={`${seats.used}/${seats.limit} מושבים`}
      onBack={() => navigate('/')}
      actions={
        <Button
          variant="primary"
          size="icon"
          aria-label="הזמן מתאמן"
          onClick={() => navigate('/coach/invites')}
          className="shrink-0"
          style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }}
        >
          <UserPlus size={18} aria-hidden="true" />
        </Button>
      }
    >
      {/* Quick links */}
      <Section>
        <div className="grid grid-cols-3 gap-2 mb-2">
          <QuickLink
            icon={<UserPlus size={18} />}
            label="הזמנות"
            onClick={() => navigate('/coach/invites')}
          />
          <QuickLink
            icon={<Users size={18} />}
            label="קבוצות"
            onClick={() => navigate('/coach/groups')}
          />
          <QuickLink
            icon={<MessageSquare size={18} />}
            label="הודעות"
            onClick={() => navigate('/coach/messages')}
            badge={unread}
          />
        </div>
      </Section>

      {/* דורשים טיפול היום — shown only after data loads and roster is non-empty */}
      {!loading && rows.length > 0 && (
        <Section title="דורשים טיפול היום">
          {attentionRows.length === 0 ? (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                color: 'var(--fs-muted)',
                margin: 0,
                padding: '6px 0',
              }}
            >
              כל המתאמנים פעילים ✓
            </p>
          ) : (
            attentionRows.map((row) => (
              <AttentionRow
                key={row.client.id}
                row={row}
                onOpenClient={() => navigate(`/coach/clients/${row.client.clientId}`)}
                onMessage={() => navigate(`/coach/messages/${row.client.clientId}`)}
              />
            ))
          )}
        </Section>
      )}

      {/* Aggregate overview */}
      {!loading && rows.length > 0 && (
        <Section title="סקירה כללית">
          <div className="grid grid-cols-3 gap-2">
            <OverviewStat
              label="דורשים תשומת לב"
              value={summary.needsAttention}
              color="var(--fs-warn)"
            />
            <OverviewStat label="פעילים" value={summary.active} color="var(--fs-accent)" />
            <OverviewStat label="ממתינים להתחלה" value={summary.awaitingFirst} />
          </div>
        </Section>
      )}

      {/* Roster */}
      <Section title="מתאמנים פעילים">
        <div className="mb-2">
          <Input
            type="text"
            dir="rtl"
            placeholder="חיפוש לפי שם…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="חיפוש מתאמן לפי שם"
          />
        </div>
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                aria-pressed={activeTag === tag}
                className="active:scale-[0.98]"
                style={{
                  padding: '3px 10px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  fontWeight: 600,
                  borderRadius: 999,
                  border: '1px solid var(--fs-surface-2)',
                  background: activeTag === tag ? 'var(--fs-primary)' : 'var(--fs-surface)',
                  color: activeTag === tag ? 'var(--fs-accent)' : 'var(--fs-ink)',
                  cursor: 'pointer',
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          <SortButton active={sort === 'attention'} onClick={() => setSort('attention')}>
            תשומת לב
          </SortButton>
          <SortButton active={sort === 'name'} onClick={() => setSort('name')}>
            שם
          </SortButton>
          <SortButton active={sort === 'activity'} onClick={() => setSort('activity')}>
            פעילות אחרונה
          </SortButton>
        </div>
        {loading ? (
          <ListSkeleton rows={4} />
        ) : error ? (
          <SectionError onRetry={reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            illustration="generic"
            title="עדיין אין מתאמנים מחוברים"
            description="הזמן מתאמן דרך כפתור ההזמנה למעלה."
            action={{ label: 'הזמן מתאמן', onClick: () => navigate('/coach/invites') }}
          />
        ) : filtered.length === 0 ? (
          <EmptyState illustration="search" size="small" title="אין מתאמנים תואמים" />
        ) : (
          filtered.map((row) => (
            <RosterRow
              key={row.client.id}
              row={row}
              onOpen={() => navigate(`/coach/clients/${row.client.clientId}`)}
              onMessage={() => navigate(`/coach/messages/${row.client.clientId}`)}
            />
          ))
        )}
      </Section>
    </CoachPage>
  );
}

// ── AttentionRow ──────────────────────────────────────────────────────────────
// Renders as a plain <div> — NOT a <button> — so the two action buttons inside
// are never nested inside an interactive element (nested <button> = invalid HTML).

function AttentionRow({
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

function RosterRow({
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

// ── Shared primitives ─────────────────────────────────────────────────────────

/** 44×44 icon-only button. accent=true swaps color to --fs-accent. */
function RowIconBtn({
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

function SortButton({
  active,
  onClick,
  children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="active:scale-[0.98]"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: active ? 700 : 400,
        color: active ? 'var(--fs-heading)' : 'var(--fs-muted)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {children}
    </button>
  );
}

function OverviewStat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div
      className="px-3 py-3"
      style={{ background: 'var(--fs-surface)', border: '1px solid var(--fs-surface-2)' }}
    >
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 24,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: color ?? 'var(--fs-heading)',
          lineHeight: 1,
        }}
      >
        <span dir="ltr">{value}</span>
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

function StatusChip({ label, color }: { label: string; color: string }) {
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

function QuickLink({
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

// ============================================================================
// COACH HOME — enable coach mode, then roster of active clients
// ============================================================================

import { MessageSquare, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { useCoach } from '../../contexts/CoachContext';
import {
  type ClientOverviewRow,
  clientStatusMeta,
  getClientsOverview,
  getSeatUsage,
  listClients,
  summarizeRoster,
} from '../../services/coach';
import { CoachPage, EmptyHint, ListRow, Section, formatDate, useAsyncData } from './_shared';

export default function CoachHome() {
  const navigate = useNavigate();
  const { isCoach, loading: coachLoading, enable } = useCoach();
  const [enabling, setEnabling] = useState(false);

  if (coachLoading) {
    return (
      <CoachPage title="מאמן" subtitle="Coaching">
        <LoadingSpinner />
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
  // ONE batched load: roster + per-client analytics from a single activity
  // query (no N+1). Rows arrive pre-sorted attention-first.
  const { data: rows, loading } = useAsyncData<ClientOverviewRow[]>(
    () => listClients('active').then((clients) => getClientsOverview(clients)),
    []
  );
  const { data: seats } = useAsyncData(() => getSeatUsage(), { used: 0, limit: 0, full: false });

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
    if (activeTag) {
      list = list.filter((r) => r.client.tags?.includes(activeTag));
    }
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
    // 'attention' keeps the service's attention-first ordering.
    return sorted;
  }, [rows, search, activeTag, sort]);

  return (
    <CoachPage
      title="המתאמנים שלי"
      subtitle={`${seats.used}/${seats.limit} מושבים`}
      onBack={() => navigate('/')}
      actions={
        <button
          type="button"
          aria-label="הזמן מתאמן"
          onClick={() => navigate('/coach/invites')}
          className="shrink-0 flex items-center justify-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--fs-accent)]"
          style={{
            width: 44,
            height: 44,
            background: 'var(--fs-primary)',
            color: 'var(--fs-accent)',
          }}
        >
          <UserPlus size={18} aria-hidden="true" />
        </button>
      }
    >
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
          />
        </div>
      </Section>

      {/* Aggregate overview across ALL clients */}
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

      <Section title="מתאמנים פעילים">
        {/* Search */}
        <input
          type="text"
          dir="rtl"
          placeholder="חיפוש לפי שם…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            marginBottom: 8,
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--fs-ink)',
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: 4,
            outline: 'none',
          }}
        />

        {/* Tag filter chips */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
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

        {/* Sort toggle */}
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

        {/* Client list */}
        {loading ? (
          <LoadingSpinner />
        ) : rows.length === 0 ? (
          <EmptyHint>עדיין אין מתאמנים מחוברים. הזמן מתאמן דרך כפתור ההזמנה למעלה.</EmptyHint>
        ) : filtered.length === 0 ? (
          <EmptyHint>אין מתאמנים תואמים</EmptyHint>
        ) : (
          filtered.map((row) => (
            <RosterRow
              key={row.client.id}
              row={row}
              onOpen={() => navigate(`/coach/clients/${row.client.clientId}`)}
            />
          ))
        )}
      </Section>
    </CoachPage>
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
        {value}
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

function RosterRow({ row, onOpen }: { row: ClientOverviewRow; onOpen: () => void }) {
  const { client, analytics } = row;
  const meta = analytics.lastActivity
    ? `פעילות אחרונה ${formatDate(analytics.lastActivity)} · ${analytics.sessionsLast7} אימונים השבוע`
    : `מחובר מאז ${formatDate(client.consentAt ?? client.createdAt)}`;

  return (
    <ListRow
      label={client.clientProfile?.displayName ?? 'מתאמן'}
      meta={meta}
      onClick={onOpen}
      trailing={<StatusChip {...clientStatusMeta(analytics.level)} />}
    />
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
}: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 py-3"
      style={{
        background: 'var(--fs-surface)',
        border: '1px solid var(--fs-surface-2)',
        color: 'var(--fs-heading)',
      }}
    >
      {icon}
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

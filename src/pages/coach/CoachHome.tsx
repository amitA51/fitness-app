// ============================================================================
// COACH HOME — enable coach mode, then roster of active clients
// ============================================================================

import { MessageSquare, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useCoach } from '../../contexts/CoachContext';
import {
  clientStatusMeta,
  getClientAnalytics,
  getSeatUsage,
  listClients,
} from '../../services/coach';
import type { CoachClient } from '../../types/coach';
import { CoachPage, EmptyHint, ListRow, Section, formatDate, useAsyncData } from './_shared';

export default function CoachHome() {
  const navigate = useNavigate();
  const { isCoach, loading: coachLoading, enable } = useCoach();
  const [enabling, setEnabling] = useState(false);

  if (coachLoading) {
    return (
      <CoachPage title="מאמן" subtitle="Coaching">
        {null}
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

type SortMode = 'name' | 'activity';

function Roster() {
  const navigate = useNavigate();
  const { data: clients, loading } = useAsyncData(() => listClients('active'), []);
  const { data: seats } = useAsyncData(() => getSeatUsage(), { used: 0, limit: 0, full: false });

  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('name');

  const allTags = useMemo(
    () => [...new Set(clients.flatMap((c) => c.tags ?? []))].sort(),
    [clients]
  );

  const filtered = useMemo(() => {
    let list = clients;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => (c.clientProfile?.displayName ?? '').toLowerCase().includes(q));
    }
    if (activeTag) {
      list = list.filter((c) => c.tags?.includes(activeTag));
    }
    const sorted = [...list];
    if (sort === 'name') {
      sorted.sort((a, b) =>
        (a.clientProfile?.displayName ?? '').localeCompare(b.clientProfile?.displayName ?? '', 'he')
      );
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.consentAt ?? b.createdAt ?? 0).getTime() -
          new Date(a.consentAt ?? a.createdAt ?? 0).getTime()
      );
    }
    return sorted;
  }, [clients, search, activeTag, sort]);

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
          className="shrink-0 flex items-center justify-center"
          style={{
            width: 36,
            height: 36,
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
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            onClick={() => setSort('name')}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: sort === 'name' ? 700 : 400,
              color: sort === 'name' ? 'var(--fs-heading)' : 'var(--fs-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            שם
          </button>
          <button
            type="button"
            onClick={() => setSort('activity')}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              fontWeight: sort === 'activity' ? 700 : 400,
              color: sort === 'activity' ? 'var(--fs-heading)' : 'var(--fs-muted)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            פעילות אחרונה
          </button>
        </div>

        {/* Client list */}
        {loading ? (
          <EmptyHint>טוען…</EmptyHint>
        ) : clients.length === 0 ? (
          <EmptyHint>עדיין אין מתאמנים מחוברים. הזמן מתאמן דרך כפתור ההזמנה למעלה.</EmptyHint>
        ) : filtered.length === 0 ? (
          <EmptyHint>אין מתאמנים תואמים</EmptyHint>
        ) : (
          filtered.map((c) => (
            <RosterRow
              key={c.id}
              client={c}
              onOpen={() => navigate(`/coach/clients/${c.clientId}`)}
            />
          ))
        )}
      </Section>
    </CoachPage>
  );
}

function RosterRow({ client, onOpen }: { client: CoachClient; onOpen: () => void }) {
  const { data: analytics } = useAsyncData(() => getClientAnalytics(client.clientId), null);
  const meta = analytics
    ? analytics.lastActivity
      ? `פעילות אחרונה ${formatDate(analytics.lastActivity)}`
      : 'אין פעילות עדיין'
    : `מחובר מאז ${formatDate(client.consentAt ?? client.createdAt)}`;

  return (
    <ListRow
      label={client.clientProfile?.displayName ?? 'מתאמן'}
      meta={meta}
      onClick={onOpen}
      trailing={analytics ? <StatusChip {...clientStatusMeta(analytics.level)} /> : undefined}
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

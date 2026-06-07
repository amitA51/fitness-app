// ============================================================================
// COACH CLIENTS — the full searchable roster (the מתאמנים tab).
// Search, tag filter, sort; each row opens the Client 360 view.
// ============================================================================

import { UserPlus } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import {
  type ClientOverviewRow,
  getClientsOverview,
  getSeatUsage,
  listClients,
} from '../../services/coach';
import { CoachPage, ListSkeleton, Section, SectionError, useAsyncData } from './_shared';
import { RosterRow } from './rosterPrimitives';

type SortMode = 'attention' | 'name' | 'activity';

export default function CoachClients() {
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
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('attention');
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

  return (
    <CoachPage
      title="המתאמנים שלי"
      subtitle={`${seats.used}/${seats.limit} מושבים`}
      onBack={() => navigate('/coach')}
      actions={
        <Button
          variant="primary"
          size="icon"
          aria-label="הזמנת מתאמן"
          onClick={() => navigate('/coach/invites')}
          className="shrink-0"
          style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }}
        >
          <UserPlus size={18} aria-hidden="true" />
        </Button>
      }
    >
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
            action={{ label: 'הזמנת מתאמן', onClick: () => navigate('/coach/invites') }}
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

function SortButton({
  active,
  onClick,
  children,
}: { active: boolean; onClick: () => void; children: ReactNode }) {
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

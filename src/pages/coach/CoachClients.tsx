// ============================================================================
// COACH CLIENTS — the full searchable roster (the מתאמנים tab).
// Search, tag filter, sort; each row opens the Client 360 view.
// ============================================================================

import { Check, UserPlus } from 'lucide-react';
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
import { RosterRow, useRosterSignals } from './rosterPrimitives';

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

  // Same triage signals as CoachHome's attention list — ONE batched fetch per
  // source for the whole roster (no N+1); chips stay hidden while in flight.
  const clientIds = useMemo(() => rows.map((r) => r.client.clientId), [rows]);
  const { signals, signalsLoading } = useRosterSignals(clientIds);
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

  const hasFilter = search.trim().length > 0 || activeTag !== null;
  const clearFilter = () => {
    setSearch('');
    setActiveTag(null);
  };

  // Hide the seat subtitle until meaningful (avoid a "0/0 מושבים" flash); digits
  // render LTR inside the RTL header.
  const seatSubtitle =
    seats.limit > 0 ? (
      <>
        <bdi dir="ltr">
          {seats.used}/{seats.limit}
        </bdi>{' '}
        מושבים
      </>
    ) : undefined;

  return (
    <CoachPage
      title="המתאמנים שלי"
      subtitle={seatSubtitle}
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
            {allTags.map((tag) => {
              const selected = activeTag === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setActiveTag(selected ? null : tag)}
                  aria-pressed={selected}
                  className="active:scale-[0.98] inline-flex items-center gap-1 min-h-[44px]"
                  style={{
                    padding: '8px 12px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 999,
                    // Non-color cue: selected chip gets a 2px inset ring + check glyph.
                    border: selected
                      ? '2px solid var(--fs-accent)'
                      : '1px solid var(--fs-surface-2)',
                    background: selected ? 'var(--fs-primary)' : 'var(--fs-surface)',
                    color: selected ? 'var(--fs-accent)' : 'var(--fs-ink)',
                    cursor: 'pointer',
                  }}
                >
                  {selected && <Check size={12} strokeWidth={3} aria-hidden="true" />}
                  {tag}
                </button>
              );
            })}
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
        {!loading && !error && rows.length > 0 && hasFilter && (
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span
              aria-live="polite"
              style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fs-muted)' }}
            >
              <bdi dir="ltr">
                {filtered.length}/{rows.length}
              </bdi>{' '}
              תואמים
            </span>
            <Button variant="ghost" size="sm" onClick={clearFilter}>
              נקה סינון
            </Button>
          </div>
        )}
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
          <EmptyState
            illustration="search"
            size="small"
            title="אין מתאמנים תואמים"
            action={{ label: 'נקה סינון', onClick: clearFilter }}
          />
        ) : (
          filtered.map((row) => (
            <RosterRow
              key={row.client.id}
              row={row}
              onOpen={() => navigate(`/coach/clients/${row.client.clientId}`)}
              onMessage={() => navigate(`/coach/messages/${row.client.clientId}`)}
              unread={signalsLoading ? 0 : (signals.unreadByClient[row.client.clientId] ?? 0)}
              hasRecentCheckIn={!signalsLoading && signals.recentCheckIns.has(row.client.clientId)}
              today={signalsLoading ? undefined : signals.scheduledToday[row.client.clientId]}
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
      aria-pressed={active}
      className="active:scale-[0.98] inline-flex items-center min-h-[44px]"
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: active ? 700 : 400,
        // Non-color cue for the active sort (perceivable without color).
        textDecoration: active ? 'underline' : 'none',
        textUnderlineOffset: 3,
        color: active ? 'var(--fs-heading)' : 'var(--fs-muted)',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '10px 4px',
      }}
    >
      {children}
    </button>
  );
}

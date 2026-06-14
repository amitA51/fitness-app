// ============================================================================
// COACH CLIENTS — the full searchable roster (the מתאמנים tab).
// Search, tag filter, sort; each row opens the Client 360 view.
// ============================================================================

import { Check, CheckSquare, UserPlus, X } from 'lucide-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import { showToast } from '../../components/ui/GlobalToast';
import { Input } from '../../components/ui/Input';
import {
  BULK_NUDGE_MAX,
  type ClientOverviewRow,
  attentionRank,
  getClientsOverview,
  getSeatUsage,
  listClients,
  sendBulkMessage,
} from '../../services/coach';
import { HE_NOUNS, pluralizeHe } from '../../utils/pluralizeHe';
import { Checkbox, CoachPage, ListSkeleton, Section, SectionError, useAsyncData } from './_shared';
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

  // Multi-select bulk-nudge: opt-in select mode reveals a Checkbox per row and a
  // sticky action bar that sends ONE shared reminder to the selected clients.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelected = (clientId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else if (next.size < BULK_NUDGE_MAX) {
        next.add(clientId);
      } else {
        showToast(`אפשר לבחור עד ${BULK_NUDGE_MAX} מתאמנים`, 'error');
      }
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

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
    } else {
      // "attention" sort: clients waiting on a reply (unread > 0) float to the
      // very top — answering a message is the highest-frequency triage action.
      // Tiebreak: unread desc, then the staleness-based attentionRank. While the
      // unread signal is still loading we fall back to attentionRank alone so the
      // list never reorders under the user mid-fetch.
      const unread = (r: ClientOverviewRow) =>
        signalsLoading ? 0 : (signals.unreadByClient[r.client.clientId] ?? 0);
      sorted.sort((a, b) => {
        const ua = unread(a);
        const ub = unread(b);
        if (ua > 0 || ub > 0) {
          if (ub !== ua) return ub - ua;
        }
        return attentionRank(b.analytics) - attentionRank(a.analytics);
      });
    }
    return sorted;
  }, [rows, search, activeTag, sort, signals.unreadByClient, signalsLoading]);

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
        <div className="flex items-center gap-2 shrink-0">
          {rows.length > 0 &&
            (selectMode ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label="ביטול בחירה מרובה"
                onClick={exitSelectMode}
              >
                <X size={18} aria-hidden="true" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label="בחירה מרובה לשליחת תזכורת"
                onClick={() => setSelectMode(true)}
              >
                <CheckSquare size={18} aria-hidden="true" />
              </Button>
            ))}
          <Button
            variant="primary"
            size="icon"
            aria-label="הזמנת מתאמן"
            onClick={() => navigate('/coach/invites')}
            style={{ background: 'var(--fs-primary)', color: 'var(--fs-accent)' }}
          >
            <UserPlus size={18} aria-hidden="true" />
          </Button>
        </div>
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
          filtered.map((row) =>
            selectMode ? (
              <Checkbox
                key={row.client.id}
                checked={selected.has(row.client.clientId)}
                onChange={() => toggleSelected(row.client.clientId)}
                label={row.client.clientProfile?.displayName ?? 'מתאמן'}
              />
            ) : (
              <RosterRow
                key={row.client.id}
                row={row}
                onOpen={() => navigate(`/coach/clients/${row.client.clientId}`)}
                onMessage={() => navigate(`/coach/messages/${row.client.clientId}`)}
                unread={signalsLoading ? 0 : (signals.unreadByClient[row.client.clientId] ?? 0)}
                hasRecentCheckIn={
                  !signalsLoading && signals.recentCheckIns.has(row.client.clientId)
                }
                today={signalsLoading ? undefined : signals.scheduledToday[row.client.clientId]}
              />
            )
          )
        )}
      </Section>
      {selectMode && (
        <BulkNudgeBar
          count={selected.size}
          onSend={async (message) => {
            const ids = [...selected];
            const res = await sendBulkMessage(ids, message);
            if (res.failed.length === 0) {
              // Agree the count: "...למתאמן אחד" for one, "...ל-N מתאמנים" for more.
              const sentLabel =
                res.sent.length === 1
                  ? 'למתאמן אחד'
                  : `ל-${pluralizeHe(res.sent.length, HE_NOUNS.client)}`;
              showToast(`התזכורת נשלחה ${sentLabel}`, 'success');
              exitSelectMode();
            } else if (res.sent.length === 0) {
              showToast('שליחת התזכורת נכשלה. נסו שוב.', 'error');
            } else {
              showToast(`נשלח ל-${res.sent.length}, נכשל עבור ${res.failed.length}`, 'error');
              // Keep failed clients selected so the coach can retry just them.
              setSelected(new Set(res.failed.map((f) => f.clientId)));
            }
          }}
        />
      )}
    </CoachPage>
  );
}

// ── Bulk-nudge bar ─────────────────────────────────────────────────────────────
// Sticky composer shown in select mode: a small message field + a send button
// that fans the SAME reminder out to the selected clients. Disabled until at
// least one client is selected and the message is non-empty. Sending state
// prevents a double-send.

function BulkNudgeBar({
  count,
  onSend,
}: {
  count: number;
  onSend: (message: string) => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const canSend = count > 0 && message.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    try {
      await onSend(message);
      setMessage('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 px-5 pt-3"
      style={{
        background: 'var(--fs-bg)',
        borderTop: '1px solid var(--fs-surface-2)',
        paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
        zIndex: 20,
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--fs-muted)',
          margin: '0 0 6px',
        }}
      >
        {/* Agree count + verb: "נבחר מתאמן אחד" for one, "נבחרו N מתאמנים" otherwise. */}
        {count === 1 ? (
          'נבחר מתאמן אחד'
        ) : (
          <>
            נבחרו <bdi dir="ltr">{count}</bdi> מתאמנים
          </>
        )}
      </p>
      <div className="flex gap-2 items-end">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={1}
          placeholder="הקלידו תזכורת משותפת…"
          aria-label="תזכורת לנבחרים"
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
            maxHeight: 120,
          }}
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleSend}
          isLoading={sending}
          disabled={!canSend}
          className="shrink-0 whitespace-nowrap motion-safe:active:scale-[0.98]"
          style={{ minHeight: 44 }}
        >
          שלחו תזכורת לנבחרים
        </Button>
      </div>
    </div>
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

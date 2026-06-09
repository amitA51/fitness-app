// ============================================================================
// COACH MESSAGES — tabbed hub: 1:1 threads + group chats
// Fresh Steel / Obsidian design system
// ============================================================================

import { X } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { listGroupThreads } from '../../services/coach/groupMessageService';
import { type ClientThreadSummary, listClientThreads } from '../../services/coach/messageService';
import type { GroupThreadSummary } from '../../types/coach';
import {
  CoachPage,
  ListRow,
  ListSkeleton,
  SectionError,
  formatDate,
  useAsyncData,
} from './_shared';

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function UnreadPill({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span
      dir="ltr"
      aria-label={`${count} הודעות שלא נקראו`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 20,
        height: 20,
        padding: '0 5px',
        background: 'var(--fs-primary)',
        color: 'var(--fs-accent)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
        borderRadius: 999,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {count}
    </span>
  );
}

function PreviewMeta({ body, at }: { body: string | null; at: string | null }) {
  const preview = body ? body.slice(0, 60) : null;
  const date = formatDate(at);
  return (
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        color: 'var(--fs-muted)',
        display: 'flex',
        gap: 6,
        alignItems: 'baseline',
        marginTop: 2,
      }}
    >
      {preview ? (
        <span
          dir="auto"
          style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
        >
          {preview}
        </span>
      ) : (
        <span style={{ flex: 1 }}>אין הודעות עדיין</span>
      )}
      <span style={{ flexShrink: 0 }}>{date}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared name-search — DRY between the personal and groups panels.
// ---------------------------------------------------------------------------

/** Case-insensitive substring match of `name` against a trimmed query. */
function matchesQuery(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.trim().toLowerCase());
}

function ThreadSearch({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  ariaLabel: string;
}) {
  return (
    <div style={{ position: 'relative', marginBottom: 12 }}>
      <Input
        type="text"
        dir="rtl"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          type="button"
          aria-label="ניקוי החיפוש"
          onClick={() => onChange('')}
          style={{
            position: 'absolute',
            insetInlineEnd: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            background: 'none',
            border: 'none',
            color: 'var(--fs-muted)',
            cursor: 'pointer',
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

type Tab = 'personal' | 'groups';

const TAB_LABELS: Record<Tab, string> = { personal: 'אישי', groups: 'קבוצות' };
const TABS: Tab[] = ['personal', 'groups'];

const tabId = (t: Tab) => `coach-msgs-tab-${t}`;
const panelId = (t: Tab) => `coach-msgs-panel-${t}`;

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  // Roving tabindex + ArrowLeft/Right per the WAI tabs pattern. In this RTL
  // layout ArrowLeft moves to the NEXT tab and ArrowRight to the previous.
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const delta = e.key === 'ArrowLeft' ? 1 : -1;
    const next = TABS[(index + delta + TABS.length) % TABS.length];
    if (next) onChange(next);
  };

  return (
    <div
      role="tablist"
      aria-label="סוג שיחות"
      style={{
        display: 'flex',
        gap: 0,
        marginBottom: 16,
        borderBottom: '2px solid var(--fs-surface-2)',
      }}
    >
      {TABS.map((tab, index) => {
        const isActive = tab === active;
        return (
          <button
            key={tab}
            id={tabId(tab)}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={panelId(tab)}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab)}
            onKeyDown={(e) => onKeyDown(e, index)}
            style={{
              flex: 1,
              minHeight: 44,
              background: 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--fs-accent)' : '2px solid transparent',
              marginBottom: -2,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              fontWeight: isActive ? 700 : 400,
              color: isActive ? 'var(--fs-heading)' : 'var(--fs-muted)',
              cursor: 'pointer',
              padding: '0 8px',
              letterSpacing: '0.04em',
              transition: 'color 120ms ease, border-color 120ms ease, font-weight 120ms ease',
            }}
          >
            {TAB_LABELS[tab]}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Personal (1:1) tab panel
// ---------------------------------------------------------------------------

function PersonalPanel() {
  const navigate = useNavigate();
  const {
    data: threads,
    loading,
    error,
    reload,
  } = useAsyncData<ClientThreadSummary[]>(listClientThreads, []);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return threads;
    return threads.filter((t) => matchesQuery(t.displayName, search));
  }, [threads, search]);

  if (loading) return <ListSkeleton rows={4} />;
  if (error) return <SectionError onRetry={reload} />;

  const hasQuery = search.trim().length > 0;

  return (
    <>
      {threads.length > 0 && (
        <ThreadSearch
          value={search}
          onChange={setSearch}
          placeholder="חיפוש לפי שם…"
          ariaLabel="חיפוש שיחה לפי שם מתאמן"
        />
      )}
      {/* Announce the filtered result count to assistive tech while searching. */}
      {hasQuery && (
        <div role="status" aria-live="polite" className="sr-only">
          {`נמצאו ${filtered.length} שיחות`}
        </div>
      )}
      {threads.length === 0 ? (
        <EmptyState
          illustration="feed"
          title="אין מתאמנים פעילים לשיחה"
          description="הזמן מתאמן כדי להתחיל התכתבות."
        />
      ) : filtered.length === 0 ? (
        <EmptyState illustration="search" size="small" title="אין שיחות תואמות לחיפוש" />
      ) : (
        filtered.map((t) => (
          <ListRow
            key={t.clientId}
            label={t.displayName}
            metaNode={<PreviewMeta body={t.lastBody} at={t.lastAt} />}
            onClick={() => navigate(`/coach/messages/${t.clientId}`)}
            trailing={<UnreadPill count={t.unread} />}
          />
        ))
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Groups tab panel
// ---------------------------------------------------------------------------

function GroupsPanel() {
  const navigate = useNavigate();

  const loader = useMemo(() => () => listGroupThreads('coach'), []);
  const { data: groups, loading, error, reload } = useAsyncData<GroupThreadSummary[]>(loader, []);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return groups;
    return groups.filter((g) => matchesQuery(g.name, search));
  }, [groups, search]);

  if (loading) return <ListSkeleton rows={4} />;
  if (error) return <SectionError onRetry={reload} />;
  if (groups.length === 0) {
    return (
      <EmptyState
        illustration="feed"
        title="אין קבוצות עדיין"
        description="יצירת קבוצה במסך הקבוצות."
        action={{ label: 'לקבוצות', onClick: () => navigate('/coach/groups') }}
      />
    );
  }

  const hasQuery = search.trim().length > 0;

  return (
    <>
      <ThreadSearch
        value={search}
        onChange={setSearch}
        placeholder="חיפוש לפי שם קבוצה…"
        ariaLabel="חיפוש קבוצה לפי שם"
      />
      {/* Announce the filtered result count to assistive tech while searching. */}
      {hasQuery && (
        <div role="status" aria-live="polite" className="sr-only">
          {`נמצאו ${filtered.length} שיחות`}
        </div>
      )}
      {filtered.length === 0 ? (
        <EmptyState illustration="search" size="small" title="אין קבוצות תואמות לחיפוש" />
      ) : (
        filtered.map((g) => (
          <ListRow
            key={g.groupId}
            label={g.name}
            metaNode={<PreviewMeta body={g.lastBody} at={g.lastAt} />}
            onClick={() => navigate(`/coach/groups/${g.groupId}/chat`)}
            trailing={<UnreadPill count={g.unread} />}
          />
        ))
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export default function CoachMessages() {
  const [tab, setTab] = useState<Tab>('personal');

  return (
    <CoachPage title="הודעות" subtitle="Messages">
      <TabBar active={tab} onChange={setTab} />
      <div id={panelId(tab)} role="tabpanel" aria-labelledby={tabId(tab)} tabIndex={0}>
        {tab === 'personal' ? <PersonalPanel /> : <GroupsPanel />}
      </div>
    </CoachPage>
  );
}

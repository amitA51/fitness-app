// ============================================================================
// WorkoutHistory — the ONE unified workout-history surface for SparkOS.
// ============================================================================
// Replaces three drifting implementations (dashboard RecentWorkouts, progress
// WorkoutHistoryList, the full-screen WorkoutHistoryScreen) with a single,
// prop-driven component that renders one consistent visual language and only
// varies density/features by `mode`:
//
//   mode="compact"  → dashboard widget: N most-recent (default 5), expandable
//                     rows, "show all → /progress" affordance.
//   mode="full"     → progress surface: search box, editorial summary stat
//                     cards, month-grouped, virtualized for long lists,
//                     expandable rows.
//
// The session row design is IDENTICAL across modes; only the surrounding chrome
// (search, stats, grouping, virtualization) differs. Built on the canonical
// `Card` primitive, token colors only, RTL-correct via logical properties.

import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronDown, ChevronUp, Clock, Dumbbell, Search } from 'lucide-react';
import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkoutExercise, WorkoutSession } from '../../../types';
import { formatDate, formatDuration, formatVolume } from '../../../utils/workoutFormatters';
import { setVolume } from '../../../utils/workoutMath';
import { Card } from '../../ui/Card';
import { SkeletonBox } from '../../ui/SkeletonLoader';

// ============================================================================
// PUBLIC PROPS
// ============================================================================

export type WorkoutHistoryMode = 'compact' | 'full';

export interface WorkoutHistoryProps {
  /** Source sessions. Filtered to completed + sorted newest-first internally. */
  sessions: WorkoutSession[];
  /** `compact` for the dashboard widget, `full` for the progress surface. */
  mode: WorkoutHistoryMode;
  /** Max rows in compact mode before the "show all" affordance. Default 5. */
  limit?: number;
  /**
   * Optional handler for "full details" of a session. When omitted, the row
   * navigates to `/detail/:id`.
   */
  onSelectSession?: (session: WorkoutSession) => void;
  /** Render loading skeletons instead of content. */
  isLoading?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_COMPACT_LIMIT = 5;
const VIRTUALIZE_THRESHOLD = 20;
const ESTIMATED_ROW_HEIGHT = 96;
const ESTIMATED_EXPANDED_HEIGHT = 260;
const ESTIMATED_HEADER_HEIGHT = 64;
const MAX_EXPANDED_EXERCISES = 6;

// ============================================================================
// DERIVED DATA HELPERS
// ============================================================================

interface HistoryStats {
  totalWorkouts: number;
  averageVolume: number;
  averageDuration: number; // minutes
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  totalVolume: number;
}

/** Completed sessions, newest first. Single source of ordering for both modes. */
const selectCompleted = (sessions: WorkoutSession[]): WorkoutSession[] =>
  sessions
    .filter((s) => s.status === 'completed')
    .slice()
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

/** Summary stats for the full-mode header. Mirrors useWorkoutHistory's engine. */
const computeStats = (completed: WorkoutSession[]): HistoryStats => {
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const monthAgo = now - 30 * 86400000;

  let totalVolume = 0;
  let totalDurationMin = 0;
  let workoutsThisWeek = 0;
  let workoutsThisMonth = 0;

  for (const session of completed) {
    totalVolume += session.totalVolume || 0;

    if (session.duration > 0) {
      totalDurationMin += session.duration / 60;
    } else if (session.startTime && session.endTime) {
      totalDurationMin +=
        (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 60000;
    }

    const started = new Date(session.startTime).getTime();
    if (started >= weekAgo) workoutsThisWeek += 1;
    if (started >= monthAgo) workoutsThisMonth += 1;
  }

  const count = completed.length;
  return {
    totalWorkouts: count,
    averageVolume: count > 0 ? Math.round(totalVolume / count) : 0,
    averageDuration: count > 0 ? Math.round(totalDurationMin / count) : 0,
    workoutsThisWeek,
    workoutsThisMonth,
    totalVolume: Math.round(totalVolume),
  };
};

const sessionTitle = (session: WorkoutSession): string =>
  session.exercises[0]?.exerciseName ||
  session.exercises[0]?.name ||
  (session.templateId ? 'אימון מתבנית' : 'אימון חופשי');

const completedSetCount = (session: WorkoutSession): number =>
  session.exercises.reduce((sum, ex) => sum + ex.sets.filter((s) => s.isCompleted).length, 0);

const matchesQuery = (session: WorkoutSession, query: string): boolean =>
  session.exercises.some(
    (ex) =>
      (ex.exerciseName ?? ex.name ?? '').toLowerCase().includes(query) ||
      (ex.muscleGroup ?? ex.targetMuscle ?? '').toLowerCase().includes(query)
  );

// A flattened list item so month-grouped content can be virtualized in one pass.
type ListItem =
  | { kind: 'header'; key: string; label: string; count: number }
  | { kind: 'session'; key: string; session: WorkoutSession };

const buildMonthItems = (sessions: WorkoutSession[]): ListItem[] => {
  const groups = new Map<string, WorkoutSession[]>();
  for (const session of sessions) {
    const d = new Date(session.startTime);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const bucket = groups.get(key);
    if (bucket) bucket.push(session);
    else groups.set(key, [session]);
  }

  const items: ListItem[] = [];
  for (const [key, groupSessions] of groups) {
    const first = groupSessions[0];
    items.push({
      kind: 'header',
      key: `h-${key}`,
      label: first
        ? new Date(first.startTime).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })
        : '',
      count: groupSessions.length,
    });
    for (const session of groupSessions) {
      items.push({ kind: 'session', key: session.id, session });
    }
  }
  return items;
};

// ============================================================================
// SHARED SUB-COMPONENTS
// ============================================================================

/** One exercise line inside an expanded session row. */
const ExerciseLine = memo(function ExerciseLine({
  exercise,
  withDivider,
}: {
  exercise: WorkoutExercise;
  withDivider: boolean;
}) {
  const workingSets = (exercise.sets || []).filter((s) => !s.isWarmup && s.isCompleted);
  const name = exercise.exerciseName || exercise.name || 'תרגיל';

  if (workingSets.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          padding: '6px 0',
          gap: 8,
          borderBottom: withDivider ? '1px dashed var(--fs-surface-2)' : 'none',
        }}
      >
        <span
          className="line-clamp-1"
          style={{
            fontFamily: 'var(--font-hebrew)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--fs-ink)',
          }}
        >
          {name}
        </span>
      </div>
    );
  }

  const bestSet = workingSets.reduce(
    (best, set) => (setVolume(set) > setVolume(best) ? set : best),
    workingSets[0]!
  );
  const totalVol = workingSets.reduce((sum, set) => sum + setVolume(set), 0);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '6px 0',
        gap: 8,
        borderBottom: withDivider ? '1px dashed var(--fs-surface-2)' : 'none',
      }}
    >
      <span
        className="line-clamp-1"
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: 'var(--font-hebrew)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--fs-ink)',
        }}
      >
        {name}
      </span>
      <span
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          flexShrink: 0,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.04em',
          color: 'var(--fs-muted)',
        }}
      >
        {bestSet.weight > 0 && (
          <>
            <span style={{ color: 'var(--fs-heading)', fontWeight: 700 }}>{bestSet.weight}</span>
            <span>ק"ג</span>
            <span style={{ color: 'var(--fs-surface-2)' }}>×</span>
          </>
        )}
        <span>
          {workingSets.length}×{bestSet.reps}
        </span>
        <span style={{ color: 'var(--fs-surface-2)' }}>·</span>
        <span>{formatVolume(totalVol)} ק"ג</span>
      </span>
    </div>
  );
});

/** The canonical, identical-across-modes session row. */
const SessionRow = memo(function SessionRow({
  session,
  isExpanded,
  onToggle,
  onDetails,
}: {
  session: WorkoutSession;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onDetails: (session: WorkoutSession) => void;
}) {
  const exercises = session.exercises || [];
  const hasExercises = exercises.length > 0;
  const today = formatDate(session.date || session.startTime) === 'היום';
  const durationLabel = session.duration > 0 ? formatDuration(session.duration) : '--';
  const sets = completedSetCount(session);
  const visibleExercises = exercises.slice(0, MAX_EXPANDED_EXERCISES);
  const detailsId = `workout-row-${session.id}`;

  return (
    <Card variant="elevated" asymmetric noPadding className="magnetic-card fs-accent-rail">
      {/* Expandable header — the primary row interaction */}
      <button
        type="button"
        onClick={() => onToggle(session.id)}
        aria-expanded={isExpanded}
        aria-controls={detailsId}
        className="focus-ring"
        style={{
          width: '100%',
          textAlign: 'start',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '14px 16px',
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: 'inherit',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: today ? 'var(--fs-accent)' : 'var(--fs-muted)',
              marginBottom: 3,
            }}
          >
            {formatDate(session.date || session.startTime)}
          </div>
          <div
            className="line-clamp-1"
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 17,
              lineHeight: 1.15,
              color: 'var(--fs-heading)',
              letterSpacing: '0.01em',
            }}
          >
            {sessionTitle(session)}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fs-ink)',
              letterSpacing: '0.03em',
              whiteSpace: 'nowrap',
            }}
          >
            {exercises.length} תרגילים
            <span style={{ color: 'var(--fs-surface-2)', margin: '0 4px' }}>·</span>
            <span style={{ color: 'var(--fs-accent)' }} className="kinetic-number" dir="ltr">
              {formatVolume(session.totalVolume || 0)}
            </span>{' '}
            ק"ג
          </span>
          {hasExercises &&
            (isExpanded ? (
              <ChevronUp size={16} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
            ) : (
              <ChevronDown size={16} style={{ color: 'var(--fs-muted)' }} aria-hidden="true" />
            ))}
        </div>
      </button>

      {/* Expanded body */}
      {isExpanded && (
        <div
          id={detailsId}
          style={{
            borderTop: '1px solid var(--fs-surface-2)',
            padding: '10px 16px 14px',
          }}
        >
          {/* Secondary stats strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              marginBottom: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fs-muted)',
              letterSpacing: '0.04em',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Clock size={12} aria-hidden="true" />
              {durationLabel}
            </span>
            <span>{sets} סטים</span>
          </div>

          {hasExercises &&
            visibleExercises.map((ex, i) => (
              <ExerciseLine
                key={ex.id || `${session.id}-ex-${i}`}
                exercise={ex}
                withDivider={i < visibleExercises.length - 1}
              />
            ))}

          {exercises.length > MAX_EXPANDED_EXERCISES && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fs-muted)',
                textAlign: 'center',
                padding: '6px 0',
              }}
            >
              +{exercises.length - MAX_EXPANDED_EXERCISES} תרגילים נוספים
            </div>
          )}

          <button
            type="button"
            onClick={() => onDetails(session)}
            className="focus-ring"
            style={{
              display: 'block',
              width: '100%',
              marginTop: 10,
              padding: '10px',
              minHeight: 44,
              background: 'var(--fs-bg)',
              border: '1px solid var(--fs-surface-2)',
              borderRadius: 'var(--radius-md, 8px)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--fs-accent-2)',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            לפרטים מלאים →
          </button>
        </div>
      )}
    </Card>
  );
});

/** Editorial summary stat card (full-mode header). */
const StatCard = memo(function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card variant="sunken" noPadding style={{ padding: '14px 16px' }}>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--fs-muted)',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        className="kinetic-number"
        dir="ltr"
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 26,
          lineHeight: 1,
          color: 'var(--fs-heading)',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
    </Card>
  );
});

const MonthHeader = memo(function MonthHeader({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        paddingBottom: 10,
        borderBottom: '2px solid var(--fs-surface-2)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 26,
          color: 'var(--fs-heading)',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {count}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 13,
          color: 'var(--fs-ink)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {label}
      </span>
    </div>
  );
});

function HistorySkeleton({ rows }: { rows: number }) {
  return (
    <output
      className="flex flex-col gap-2"
      aria-live="polite"
      aria-label="טוען היסטוריית אימונים"
      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBox
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-count skeleton placeholders, never reordered
          key={i}
          height={82}
          borderRadius="var(--radius-asymmetric)"
        />
      ))}
    </output>
  );
}

function EmptyState({ compact }: { compact: boolean }) {
  const navigate = useNavigate();

  if (compact) {
    return (
      <Card variant="elevated" asymmetric style={{ padding: '40px 20px', textAlign: 'center' }}>
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          אין אימונים עדיין
        </div>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 26,
            lineHeight: 0.95,
            color: 'var(--fs-heading)',
            textTransform: 'uppercase',
            letterSpacing: '-0.01em',
            marginBottom: 16,
          }}
        >
          התחל את האימון הראשון
        </p>
        <button type="button" onClick={() => navigate('/workout')} className="btn-primary w-full">
          התחל עכשיו
        </button>
      </Card>
    );
  }

  return (
    <Card variant="elevated" asymmetric style={{ padding: '40px 20px', textAlign: 'center' }}>
      <Dumbbell
        size={28}
        style={{ color: 'var(--fs-muted)', marginBottom: 10 }}
        aria-hidden="true"
      />
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 18,
          color: 'var(--fs-ink)',
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        אין נתונים עדיין
      </div>
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--fs-muted)',
          letterSpacing: '0.04em',
        }}
      >
        התחל להתאמן כדי לרשום את האימון הראשון שלך
      </div>
    </Card>
  );
}

// ============================================================================
// VIRTUALIZED FULL-MODE LIST (flattened headers + sessions)
// ============================================================================

const VirtualizedItems = memo(function VirtualizedItems({
  items,
  expandedId,
  onToggle,
  onDetails,
}: {
  items: ListItem[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onDetails: (session: WorkoutSession) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Resolve the nearest scrollable ancestor (the app's scrolling <main>).
  const getScrollElement = useCallback((): HTMLElement | null => {
    let el: HTMLElement | null = parentRef.current?.parentElement ?? null;
    while (el) {
      const style = window.getComputedStyle(el);
      if (/(auto|scroll)/.test(style.overflowY)) return el;
      el = el.parentElement;
    }
    return null;
  }, []);

  // The list sits below charts in a shared scroll container, so the virtualizer
  // must know how far down it starts. Measure and keep fresh.
  useLayoutEffect(() => {
    const measure = () => {
      const parent = parentRef.current;
      const scrollEl = getScrollElement();
      if (!parent || !scrollEl) return;
      const offset =
        parent.getBoundingClientRect().top -
        scrollEl.getBoundingClientRect().top +
        scrollEl.scrollTop;
      setScrollMargin(offset);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [getScrollElement]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement,
    estimateSize: (i) => {
      const item = items[i];
      if (item?.kind === 'header') return ESTIMATED_HEADER_HEIGHT;
      if (item?.kind === 'session' && item.session.id === expandedId)
        return ESTIMATED_EXPANDED_HEIGHT;
      return ESTIMATED_ROW_HEIGHT;
    },
    overscan: 6,
    gap: 10,
    scrollMargin,
  });

  return (
    <div ref={parentRef}>
      <div
        style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative', width: '100%' }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) return null;
          return (
            <div
              key={item.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                insetInlineStart: 0,
                top: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              {item.kind === 'header' ? (
                <MonthHeader label={item.label} count={item.count} />
              ) : (
                <SessionRow
                  session={item.session}
                  isExpanded={expandedId === item.session.id}
                  onToggle={onToggle}
                  onDetails={onDetails}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const WorkoutHistory = memo(function WorkoutHistory({
  sessions,
  mode,
  limit = DEFAULT_COMPACT_LIMIT,
  onSelectSession,
  isLoading = false,
}: WorkoutHistoryProps) {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const completed = useMemo(() => selectCompleted(sessions), [sessions]);

  const onToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const onDetails = useCallback(
    (session: WorkoutSession) => {
      if (onSelectSession) onSelectSession(session);
      else navigate(`/detail/${session.id}`);
    },
    [onSelectSession, navigate]
  );

  if (isLoading && completed.length === 0) {
    return <HistorySkeleton rows={mode === 'compact' ? 3 : 5} />;
  }

  if (completed.length === 0) {
    return <EmptyState compact={mode === 'compact'} />;
  }

  // ── Compact mode ──────────────────────────────────────────────────────────
  if (mode === 'compact') {
    const visible = showAll ? completed : completed.slice(0, limit);
    const hasMore = completed.length > limit;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            isExpanded={expandedId === session.id}
            onToggle={onToggle}
            onDetails={onDetails}
          />
        ))}

        {hasMore && !showAll && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="focus-ring"
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 0',
                minHeight: 44,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--fs-muted)',
              }}
            >
              + {completed.length - limit} אימונים נוספים
            </button>
            <button
              type="button"
              onClick={() => navigate('/progress')}
              className="focus-ring"
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 0',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--fs-accent-2)',
              }}
            >
              כל ההיסטוריה →
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Full mode ─────────────────────────────────────────────────────────────
  const stats = computeStats(completed);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = normalizedQuery
    ? completed.filter((s) => matchesQuery(s, normalizedQuery))
    : completed;
  const monthItems = buildMonthItems(filtered);
  const shouldVirtualize = filtered.length >= VIRTUALIZE_THRESHOLD;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <StatCard label="סה״כ אימונים" value={stats.totalWorkouts} />
        <StatCard label="נפח ממוצע" value={formatVolume(stats.averageVolume)} />
        <StatCard label="זמן ממוצע" value={`${stats.averageDuration}′`} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <StatCard label="השבוע" value={stats.workoutsThisWeek} />
        <StatCard label="החודש" value={stats.workoutsThisMonth} />
      </div>

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search
          size={16}
          aria-hidden="true"
          style={{
            position: 'absolute',
            insetInlineStart: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--fs-muted)',
            pointerEvents: 'none',
          }}
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="חיפוש לפי תרגיל או קבוצת שריר..."
          aria-label="חיפוש אימונים"
          style={{
            width: '100%',
            height: 48,
            paddingInlineStart: 40,
            paddingInlineEnd: 16,
            background: 'var(--fs-surface)',
            border: '1px solid var(--fs-surface-2)',
            borderRadius: 'var(--radius-xl, 16px)',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            color: 'var(--fs-ink)',
            outline: 'none',
          }}
        />
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <Card variant="elevated" asymmetric style={{ padding: '32px 20px', textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fs-muted)',
              letterSpacing: '0.04em',
            }}
          >
            לא נמצאו אימונים תואמים
          </div>
        </Card>
      ) : shouldVirtualize ? (
        <VirtualizedItems
          items={monthItems}
          expandedId={expandedId}
          onToggle={onToggle}
          onDetails={onDetails}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {monthItems.map((item) =>
            item.kind === 'header' ? (
              <div key={item.key} style={{ marginTop: 6 }}>
                <MonthHeader label={item.label} count={item.count} />
              </div>
            ) : (
              <SessionRow
                key={item.key}
                session={item.session}
                isExpanded={expandedId === item.session.id}
                onToggle={onToggle}
                onDetails={onDetails}
              />
            )
          )}
        </div>
      )}
    </div>
  );
});

export default WorkoutHistory;

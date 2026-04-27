import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronLeft, Trash2 } from 'lucide-react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkoutListSkeleton } from '../components/ui/SkeletonLoader';
import { useData } from '../contexts/DataContext';
import { useWorkoutHistoryHub } from '../hooks/fitness/useWorkoutHistoryHub';
import { deleteWorkoutSession } from '../services/workoutDb';
import type { WorkoutSession } from '../types';
import { handleError } from '../utils/errorReporting';

// ── Helpers ──────────────────────────────────────────────────────────────────
const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
];

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return `יום ${HEBREW_DAYS[date.getDay()]}, ${date.getDate()} ${HEBREW_MONTHS[date.getMonth()]}`;
};

const formatDateISO = (dateStr: string): string => {
  const date = new Date(dateStr);
  const y = String(date.getFullYear()).slice(2);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${d}.${m}.${y}`;
};

const isThisWeek = (dateStr: string): boolean => {
  const date = new Date(dateStr).getTime();
  const sevenDaysAgo = Date.now() - 7 * 86400000;
  return date > sevenDaysAgo;
};

const formatDuration = (seconds: number): string => {
  if (seconds < 3600) return `${Math.round(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

const countCompletedSets = (session: WorkoutSession): number =>
  session.exercises.reduce((total, ex) => total + ex.sets.filter((s) => s.isCompleted).length, 0);

// ── SessionCard ───────────────────────────────────────────────────────────────
interface SessionCardProps {
  session: WorkoutSession;
  onDelete: (id: string) => void;
  index: number;
}

const SessionCard = memo(function SessionCard({ session, onDelete, index }: SessionCardProps) {
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const completedSets = countCompletedSets(session);
  const exerciseNames = session.exercises.map((e) => e.exerciseName);
  const fresh = isThisWeek(session.date);

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (confirmDelete) {
        onDelete(session.id);
      } else {
        setConfirmDelete(true);
      }
    },
    [confirmDelete, onDelete, session.id]
  );

  const handleCardClick = useCallback(() => {
    if (confirmDelete) {
      setConfirmDelete(false);
      return;
    }
    navigate(`/history/${session.id}`);
  }, [confirmDelete, navigate, session.id]);

  const vol =
    session.totalVolume >= 1000
      ? `${(session.totalVolume / 1000).toFixed(1)}K`
      : session.totalVolume.toLocaleString();

  const title =
    session.exercises[0]?.exerciseName ||
    (session.status === 'completed' ? 'אימון הושלם' : 'אימון בהליך');

  return (
    <button onClick={handleCardClick} className="w-full card-interactive text-right">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span
            className="eyebrow"
            style={{
              color: fresh ? 'var(--mustard)' : 'var(--stone)',
              fontFamily: 'var(--font-mono)',
            }}
          >
            №{String(index + 1).padStart(3, '0')} · {formatDateISO(session.date)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="badge"
            style={{
              background: session.status === 'completed' ? 'var(--navy)' : 'var(--bone-deep)',
              color: session.status === 'completed' ? 'var(--mustard)' : 'var(--navy)',
            }}
          >
            {session.status === 'completed' ? 'DONE' : 'WIP'}
          </span>
          <button
            onClick={handleDeleteClick}
            className="w-9 h-9 min-w-[48px] min-h-[48px] flex items-center justify-center transition-colors"
            style={{
              padding: '10px',
              background: confirmDelete ? 'var(--navy)' : 'transparent',
              color: confirmDelete ? 'var(--mustard)' : 'var(--stone)',
            }}
            aria-label={confirmDelete ? 'לחץ שוב לאישור' : 'מחק אימון'}
          >
            <Trash2 size={14} />
          </button>
          <ChevronLeft size={15} style={{ color: 'var(--stone)' }} />
        </div>
      </div>

      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: '22px',
          lineHeight: 1,
          color: 'var(--ink)',
          textTransform: 'uppercase',
          letterSpacing: '-0.01em',
          marginBottom: '4px',
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-hebrew)',
          fontSize: '12px',
          color: 'var(--stone)',
          marginBottom: '12px',
        }}
      >
        {formatDate(session.date)}
      </p>

      <div
        className="flex items-center gap-4"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '12px',
          color: 'var(--navy)',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}
      >
        {session.duration > 0 && <span>{formatDuration(session.duration)}</span>}
        <span style={{ color: 'var(--stone)' }}>·</span>
        <span>{completedSets} SETS</span>
        {session.totalVolume > 0 && (
          <>
            <span style={{ color: 'var(--stone)' }}>·</span>
            <span>{vol}KG</span>
          </>
        )}
      </div>

      {exerciseNames.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-3">
          {exerciseNames.slice(0, 3).map((name, idx) => (
            <span key={idx} className="chip">
              {name}
            </span>
          ))}
          {exerciseNames.length > 3 && (
            <span className="chip" style={{ background: 'var(--bone-deep)' }}>
              +{exerciseNames.length - 3}
            </span>
          )}
        </div>
      )}

      {confirmDelete && (
        <p
          className="mt-3"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--navy)',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          לחץ שוב למחיקה
        </p>
      )}
    </button>
  );
});

// ── VirtualizedSessionList ───────────────────────────────────────────────────
// data-virtualized="true" — window virtualization via @tanstack/react-virtual
const VirtualizedSessionList = memo(function VirtualizedSessionList({
  sessions,
  onDelete,
}: {
  sessions: WorkoutSession[];
  onDelete: (id: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => {
      const el = parentRef.current?.parentElement?.parentElement;
      return el ?? null;
    },
    estimateSize: () => 192,
    overscan: 5,
  });

  return (
    <div ref={parentRef}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
          width: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const session = sessions[virtualRow.index];
          if (!session) return null;
          return (
            <div
              key={session.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <SessionCard session={session} onDelete={onDelete} index={virtualRow.index} />
            </div>
          );
        })}
      </div>
    </div>
  );
});

// ── History Page ───────────────────────────────────────────────────────────────
export default function History() {
  const navigate = useNavigate();
  const { sessions: dataContextSessions } = useData();
  const {
    sessions: unsortedSessions,
    loading,
    error,
    refresh,
  } = useWorkoutHistoryHub(100, dataContextSessions);

  const sessions = useMemo(
    () =>
      [...unsortedSessions].sort(
        (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
      ),
    [unsortedSessions]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteWorkoutSession(id);
        await refresh();
      } catch (err) {
        const { userMessage } = handleError(
          err,
          'History.handleDelete',
          'לא הצלחנו למחוק את האימון'
        );
        console.warn(userMessage);
      }
    },
    [refresh]
  );

  const totalVolume = useMemo(
    () => sessions.reduce((sum, s) => sum + (s.totalVolume || 0), 0),
    [sessions]
  );
  const lastMonthVolume = useMemo(() => {
    const cutoff = Date.now() - 30 * 86400000;
    return sessions
      .filter((s) => new Date(s.startTime).getTime() > cutoff)
      .reduce((sum, s) => sum + (s.totalVolume || 0), 0);
  }, [sessions]);

  const totalVolDisplay =
    totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}K` : totalVolume.toLocaleString();
  const lastMonthDisplay =
    lastMonthVolume >= 1000
      ? `${(lastMonthVolume / 1000).toFixed(1)}K`
      : lastMonthVolume.toLocaleString();

  return (
    <div
      className="pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))]"
      style={{ background: 'var(--bone)' }}
      dir="rtl"
    >
      {/* Masthead */}
      <header
        className="masthead sticky top-0 z-20"
        style={{ paddingTop: 'max(20px, env(safe-area-inset-top, 20px))' }}
      >
        <div className="kicker">§04 · HISTORIA · {sessions.length} SESSIONS</div>
        <h1
          style={{
            fontFamily: 'var(--font-hebrew)',
            fontSize: 'clamp(44px, 12vw, 72px)',
            lineHeight: 0.9,
            marginTop: '8px',
          }}
        >
          היסטוריה
        </h1>
      </header>

      <main>
        {error && (
          <div
            className="px-5 py-4 mx-5 mt-5"
            style={{
              background: 'var(--navy)',
              color: 'var(--mustard)',
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            {error.message}
          </div>
        )}

        {/* Block Hero — total sessions */}
        {!loading && sessions.length > 0 && (
          <div className="block-hero">
            <span className="ribbon">§ TOTAL</span>
            <div className="label">סך הכול אימונים</div>
            <div className="number">{sessions.length}</div>
            <div className="sub">SESSIONS LOGGED</div>
          </div>
        )}

        {/* Data Strip — volume */}
        {!loading && sessions.length > 0 && (
          <div className="data-strip mx-5 mt-5">
            <div>
              <div className="val">
                {totalVolDisplay}
                <em>KG</em>
              </div>
              <div className="lbl">TOTAL VOLUME</div>
            </div>
            <div>
              <div className="val">
                {lastMonthDisplay}
                <em>KG</em>
              </div>
              <div className="lbl">LAST 30 DAYS</div>
            </div>
          </div>
        )}

        {/* Chapter break */}
        {!loading && sessions.length > 0 && (
          <div className="chapter-break mt-5">
            <span className="left">§01 · ALL SESSIONS</span>
            <span className="right">אימונים</span>
          </div>
        )}

        <div className="px-5 pt-5 space-y-3">
          {loading && <WorkoutListSkeleton count={3} />}

          {!loading && sessions.length === 0 && !error && (
            <div className="flex flex-col items-center py-20 gap-5 text-center px-6">
              <p
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '22px',
                  fontWeight: 800,
                  color: 'var(--ink)',
                }}
              >
                אין אימונים עדיין
              </p>
              <p style={{ color: 'var(--stone)', fontFamily: 'var(--font-body)', fontSize: 15 }}>
                האימונים שתסיים יופיעו כאן
              </p>
              <button onClick={() => navigate('/workout')} className="btn-primary">
                התחל אימון
              </button>
            </div>
          )}

          {!loading && sessions.length > 0 && (
            <VirtualizedSessionList sessions={sessions} onDelete={handleDelete} />
          )}
        </div>
      </main>
    </div>
  );
}

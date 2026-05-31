import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { ChevronDown, ChevronUp, Clock, Dumbbell } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkoutSession } from '../../../types';
import { formatDuration, formatVolume } from '../../../utils/dateUtils';
import { setVolume } from '../../../utils/workoutMath';

const VIRTUALIZE_THRESHOLD = 20;
const ESTIMATED_ITEM_HEIGHT = 64;

export const WorkoutHistoryList = memo(function WorkoutHistoryList({
  sessions,
}: { sessions: WorkoutSession[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  if (sessions.length === 0) {
    return (
      <div
        style={{
          background: 'var(--fs-surface)',
          borderRadius: '22px 16px 22px 16px',
          padding: '20px',
          textAlign: 'center',
          border: '1px solid var(--fs-surface-2)',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <Dumbbell size={24} style={{ color: 'var(--fs-muted)', marginBottom: 8 }} />
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 14,
            color: 'var(--fs-muted)',
          }}
        >
          עדיין אין אימונים
        </p>
      </div>
    );
  }

  if (sessions.length >= VIRTUALIZE_THRESHOLD) {
    return (
      <VirtualizedHistoryList
        sessions={sessions}
        expandedId={expandedId}
        toggleExpand={toggleExpand}
        navigate={navigate}
      />
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {sessions.map((session) => (
        <SessionCard
          key={session.id}
          session={session}
          isExpanded={expandedId === session.id}
          toggleExpand={toggleExpand}
          navigate={navigate}
        />
      ))}
    </div>
  );
});

const VirtualizedHistoryList = memo(function VirtualizedHistoryList({
  sessions,
  expandedId,
  toggleExpand,
  navigate,
}: {
  sessions: WorkoutSession[];
  expandedId: string | null;
  toggleExpand: (id: string) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sessions.length,
    getScrollElement: () => {
      let el: HTMLElement | null = parentRef.current?.parentElement ?? null;
      while (el) {
        const style = window.getComputedStyle(el);
        if (/(auto|scroll)/.test(style.overflowY)) return el;
        el = el.parentElement;
      }
      return null;
    },
    estimateSize: (i) => (sessions[i]?.id === expandedId ? 220 : ESTIMATED_ITEM_HEIGHT),
    overscan: 5,
    gap: 10,
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
              <SessionCard
                session={session}
                isExpanded={expandedId === session.id}
                toggleExpand={toggleExpand}
                navigate={navigate}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});

const SessionCard = memo(function SessionCard({
  session,
  isExpanded,
  toggleExpand,
  navigate,
}: {
  session: WorkoutSession;
  isExpanded: boolean;
  toggleExpand: (id: string) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const completedSets = session.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.isCompleted).length,
    0
  );
  const topExercises = session.exercises.slice(0, 4);
  const dateStr = new Date(session.date || session.startTime).toLocaleDateString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div
      style={{
        background: 'var(--fs-surface)',
        borderRadius: '22px 16px 22px 16px',
        border: '1px solid var(--fs-surface-2)',
        boxShadow: 'var(--shadow-card)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <button
        type="button"
        onClick={() => toggleExpand(session.id)}
        aria-expanded={isExpanded}
        style={{
          padding: '14px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          background: 'transparent',
          border: 'none',
          textAlign: 'start',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 16,
              color: 'var(--fs-ink)',
              letterSpacing: '0.02em',
              lineHeight: 1.2,
            }}
          >
            {session.exercises[0]?.exerciseName || 'אימון'}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fs-muted)',
              letterSpacing: '0.05em',
              marginTop: 2,
            }}
          >
            {dateStr}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fs-muted)',
            }}
          >
            <Clock size={10} style={{ verticalAlign: 'middle', marginLeft: 2 }} />
            {formatDuration(session.duration)}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fs-muted)',
            }}
          >
            {completedSets} סטים
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--fs-accent)',
            }}
          >
            {formatVolume(session.totalVolume)} ק"ג
          </span>
          {isExpanded ? (
            <ChevronUp size={14} style={{ color: 'var(--fs-muted)' }} />
          ) : (
            <ChevronDown size={14} style={{ color: 'var(--fs-muted)' }} />
          )}
        </div>
      </button>

      {/* Expanded exercises — keep expand animation on inner content */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            borderTop: '1px solid var(--fs-surface-2)',
            padding: '10px 16px 14px 20px',
          }}
        >
          {topExercises.map((ex, i) => {
            const bestSet = ex.sets
              .filter((s) => s.isCompleted)
              .reduce(
                (best, s) => {
                  const vol = setVolume(s);
                  return vol > best.volume
                    ? { weight: s.weight || 0, reps: s.reps || 0, volume: vol }
                    : best;
                },
                { weight: 0, reps: 0, volume: 0 }
              );
            return (
              <div
                key={ex.id || i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom:
                    i < topExercises.length - 1 ? '1px solid var(--fs-surface-2)' : 'none',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--fs-ink)',
                  }}
                >
                  {ex.exerciseName || ex.name}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--fs-muted)',
                  }}
                >
                  {bestSet.weight > 0
                    ? `${bestSet.weight}ק"ג × ${bestSet.reps}`
                    : `${ex.sets.filter((s) => s.isCompleted).length} סטים`}
                </span>
              </div>
            );
          })}

          {session.exercises.length > 4 && (
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--fs-muted)',
                textAlign: 'center',
                padding: '6px 0',
              }}
            >
              +{session.exercises.length - 4} תרגילים נוספים
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/detail/${session.id}`);
            }}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 8,
              padding: '8px',
              background: 'var(--fs-bg)',
              border: '1px solid var(--fs-surface-2)',
              borderRadius: 8,
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.05em',
              color: 'var(--fs-accent-2)',
              cursor: 'pointer',
              textAlign: 'center',
            }}
          >
            לפרטים מלאים →
          </button>
        </motion.div>
      )}
    </div>
  );
});

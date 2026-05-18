// ============================================================================
// RecentWorkouts — Full history with exercise details on dashboard
// Editorial "Fresh Steel" design: Dark · Accent · Signal
// ============================================================================

import { ChevronDown, ChevronUp } from 'lucide-react';
import { memo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { WorkoutSession } from '../../types';
import { fmtDate, isToday } from '../../utils/dateUtils';

interface RecentWorkoutsProps {
  sessions: WorkoutSession[];
  loading?: boolean;
}

const PAGE_SIZE = 5;

function SkeletonRow() {
  return (
    <div
      className="premium-shimmer"
      style={{
        height: 82,
        border: '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
        boxShadow: 'var(--shadow-card)',
      }}
      aria-hidden="true"
    />
  );
}

// Mini exercise row inside a workout card
function ExerciseDetail({ exercise }: { exercise: WorkoutSession['exercises'][number] }) {
  const workingSets = (exercise.sets || []).filter((set) => !set.isWarmup && set.isCompleted);

  if (workingSets.length === 0) return null;

  const bestSet = workingSets.reduce((best, set) => {
    const vol = set.weight * set.reps;
    const bestVol = best.weight * best.reps;
    return vol > bestVol ? set : best;
  }, workingSets[0]!);

  const totalVol = workingSets.reduce((s, set) => s + set.weight * set.reps, 0);
  const name = exercise.exerciseName || exercise.name || 'תרגיל';

  const volLabel =
    totalVol >= 1000 ? `${(totalVol / 1000).toFixed(1)}k` : String(Math.round(totalVol));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        padding: '4px 0',
        gap: 8,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          className="line-clamp-1"
          style={{
            fontFamily: 'var(--font-hebrew)',
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--fs-ink)',
          }}
        >
          {name}
        </span>
      </div>
      <div
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
        <span style={{ color: 'var(--fs-primary)', fontWeight: 700 }}>
          {bestSet.weight > 0 ? `${bestSet.weight}` : ''}
        </span>
        {bestSet.weight > 0 && <span>ק"ג</span>}
        <span style={{ color: 'var(--fs-surface-2)' }}>×</span>
        <span>
          {workingSets.length}×{bestSet.reps}
        </span>
        <span style={{ color: 'var(--fs-surface-2)' }}>·</span>
        <span>{volLabel} ק"ג</span>
      </div>
    </div>
  );
}

// Single workout card (expandable)
function WorkoutCard({
  session,
  onSelect,
}: {
  session: WorkoutSession;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const vol =
    session.totalVolume >= 1000
      ? `${(session.totalVolume / 1000).toFixed(1)}K`
      : String(session.totalVolume || 0);
  const dateStr = session.date || session.startTime;
  const today = isToday(dateStr);
  const dur = session.duration ? Math.round(session.duration / 60) : 0;
  const exercises = session.exercises || [];
  const hasExercises = exercises.length > 0;

  return (
    <div
      className="magnetic-card glass-surface fs-accent-rail"
      style={{
        overflow: 'hidden',
        border: '1px solid var(--fs-surface-2)',
        borderRadius: '22px 16px 22px 16px',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      {/* Main clickable row */}
      <button
        type="button"
        onClick={() => onSelect(session.id)}
        style={{
          width: '100%',
          textAlign: 'right',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '14px 16px 10px',
          display: 'block',
          color: 'inherit',
        }}
        className="focus-ring"
      >
        {/* Date */}
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: today ? 'var(--fs-accent)' : 'var(--fs-muted)',
            marginBottom: 4,
          }}
        >
          {fmtDate(dateStr)}
        </div>

        {/* Title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 18,
              lineHeight: 1.1,
              color: 'var(--fs-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              flex: 1,
              minWidth: 0,
            }}
            className="line-clamp-1"
          >
            {session.templateId ? 'אימון מתבנית' : 'אימון חופשי'}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--fs-ink)',
              letterSpacing: '0.04em',
              flexShrink: 0,
            }}
          >
            {exercises.length} תרגילים · <span className="kinetic-number">{vol}</span> ק״ג ·{' '}
            <span className="kinetic-number">{dur}</span>′
          </div>
        </div>
      </button>

      {/* Expand toggle */}
      {hasExercises && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '12px 16px',
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            color: 'var(--fs-muted)',
          }}
          aria-label={expanded ? 'הסתר תרגילים' : 'הצג תרגילים'}
          aria-expanded={expanded}
          aria-controls={`workout-exercises-${session.id}`}
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
            }}
          >
            {expanded ? 'סגור' : 'פרטים'}
          </span>
        </button>
      )}

      {/* Expanded exercise list */}
      {expanded && hasExercises && (
        <div
          id={`workout-exercises-${session.id}`}
          style={{
            padding: '0 16px 14px',
            borderTop: '1px solid var(--fs-surface-2)',
            marginTop: 4,
          }}
        >
          {exercises.map((ex, i) => (
            <div
              key={ex.id || i}
              style={{
                borderBottom: i < exercises.length - 1 ? '1px dashed var(--fs-surface-2)' : 'none',
              }}
            >
              <ExerciseDetail exercise={ex} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const RecentWorkouts = memo(function RecentWorkouts({
  sessions,
  loading = false,
}: RecentWorkoutsProps) {
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);

  const completed = sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

  const visible = showAll ? completed : completed.slice(0, PAGE_SIZE);
  const hasMore = completed.length > PAGE_SIZE;

  if (loading && completed.length === 0) {
    return (
      <output className="flex flex-col gap-2" aria-live="polite" aria-label="טוען אימונים אחרונים">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </output>
    );
  }

  if (completed.length === 0) {
    return (
      <div
        style={{
          padding: '40px 20px',
          textAlign: 'center',
          background: 'var(--fs-surface)',
          border: '1px solid var(--fs-surface-2)',
          borderRadius: '22px 16px 22px 16px',
          boxShadow: 'var(--shadow-card)',
        }}
      >
        <div className="eyebrow" style={{ marginBottom: 12 }}>
          § no sessions yet
        </div>
        <p
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 28,
            lineHeight: 0.95,
            color: 'var(--fs-primary)',
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
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visible.map((s) => (
        <WorkoutCard key={s.id} session={s} onSelect={(id) => navigate(`/history/${id}`)} />
      ))}

      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px 0',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--fs-muted)',
          }}
          className="focus-ring"
        >
          + {completed.length - PAGE_SIZE} אימונים נוספים
        </button>
      )}
    </div>
  );
});

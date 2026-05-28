import { motion } from 'framer-motion';
import React, { useState, useMemo, memo } from 'react';
import type { WorkoutSession } from '../../types';
import { setVolume } from '../../utils/workoutMath';
import { useWorkoutHistory } from './hooks/useWorkoutHistory';

// ============================================================
// TYPES
// ============================================================

interface WorkoutHistoryScreenProps {
  onClose: () => void;
  onSelectSession?: (session: WorkoutSession) => void;
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

const formatDuration = (startTime: string, endTime?: string): string => {
  if (!endTime) return '--';
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  const minutes = Math.round((end - start) / 60000);
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')} שעות`;
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return 'היום';
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'אתמול';
  }

  return date.toLocaleDateString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

const calculateSessionVolume = (session: WorkoutSession): number => {
  let volume = 0;
  session.exercises.forEach((exercise) => {
    exercise.sets.forEach((set) => {
      if (set.completedAt && set.weight && set.reps) {
        volume += setVolume(set);
      }
    });
  });
  return volume;
};

const getMainMuscleGroup = (session: WorkoutSession): string => {
  const muscleCount: Record<string, number> = {};
  session.exercises.forEach((ex) => {
    const group = ex.muscleGroup || 'אחר';
    muscleCount[group] = (muscleCount[group] || 0) + 1;
  });

  let maxGroup = 'אחר';
  let maxCount = 0;
  Object.entries(muscleCount).forEach(([group, count]) => {
    if (count > maxCount) {
      maxCount = count;
      maxGroup = group;
    }
  });
  return maxGroup;
};

// ============================================================
// SUB-COMPONENTS
// ============================================================

// Memoized StatCard for performance
const StatCard = memo<{
  label: string;
  value: string | number;
}>(({ label, value }) => (
  <div
    style={{
      flex: 1,
      padding: '16px',
      background: 'var(--fs-surface-2)',
      border: '2px solid var(--fs-primary)',
    }}
  >
    <div
      style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--fs-muted)',
        marginBottom: 8,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 32,
        color: 'var(--fs-heading)',
        letterSpacing: '-0.02em',
        lineHeight: 1,
      }}
    >
      {value}
    </div>
  </div>
));

StatCard.displayName = 'StatCard';

// Memoized SessionCard for performance in long lists
const SessionCard = memo<{
  session: WorkoutSession;
  onClick: () => void;
}>(({ session, onClick }) => {
  const volume = useMemo(() => calculateSessionVolume(session), [session]);
  const mainMuscle = useMemo(() => getMainMuscleGroup(session), [session]);
  const completedSets = session.exercises.reduce(
    (sum, ex) => sum + ex.sets.filter((s) => s.completedAt).length,
    0
  );

  return (
    <motion.div
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      style={{
        padding: '20px',
        background: 'var(--fs-surface)',
        border: '2px solid var(--fs-primary)',
        cursor: 'pointer',
        transition: 'background-color 150ms ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--fs-surface-2)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--fs-surface)';
      }}
    >
      {/* Header Row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 18,
              color: 'var(--fs-ink)',
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              marginBottom: 4,
            }}
          >
            {formatDate(session.startTime)}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fs-muted)',
              letterSpacing: '0.05em',
            }}
          >
            {new Date(session.startTime).toLocaleTimeString('he-IL', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
        {/* Muscle group badge */}
        <div
          style={{
            padding: '6px 12px',
            background: 'var(--fs-accent)',
            color: 'var(--fs-heading)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
          }}
        >
          {mainMuscle}
        </div>
      </div>

      {/* Stats Grid - Editorial Data Strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          border: '2px solid var(--fs-primary)',
        }}
      >
        <div
          style={{
            padding: '12px',
            textAlign: 'center',
            borderRight: '2px solid var(--fs-primary)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 24,
              color: 'var(--fs-heading)',
              letterSpacing: '-0.01em',
            }}
          >
            {session.exercises.length}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
              marginTop: 4,
            }}
          >
            תרגילים
          </div>
        </div>
        <div
          style={{
            padding: '12px',
            textAlign: 'center',
            borderRight: '2px solid var(--fs-primary)',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 24,
              color: 'var(--fs-ink)',
              letterSpacing: '-0.01em',
            }}
          >
            {completedSets}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
              marginTop: 4,
            }}
          >
            סטים
          </div>
        </div>
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 24,
              color: 'var(--fs-accent)',
              letterSpacing: '-0.01em',
            }}
          >
            {volume.toLocaleString()}
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              letterSpacing: '0.15em',
              color: 'var(--fs-muted)',
              textTransform: 'uppercase',
              marginTop: 4,
            }}
          >
            ק"ג
          </div>
        </div>
      </div>

      {/* Footer Row */}
      <div
        className="flex items-center justify-between mt-4"
        style={{ paddingTop: 12, borderTop: '1px solid var(--fs-surface-2)' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--fs-muted)',
            letterSpacing: '0.05em',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 4V7L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
          </svg>
          {formatDuration(session.startTime, session.endTime ?? undefined)}
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          style={{ color: 'var(--fs-heading)' }}
        >
          <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="square" />
        </svg>
      </div>
    </motion.div>
  );
});

SessionCard.displayName = 'SessionCard';

// ============================================================
// MAIN COMPONENT
// ============================================================

const WorkoutHistoryScreen: React.FC<WorkoutHistoryScreenProps> = ({
  onClose,
  onSelectSession,
}) => {
  const { sessions, stats, loading, error, refresh } = useWorkoutHistory(100);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const query = searchQuery.toLowerCase();
    return sessions.filter((session) =>
      session.exercises.some(
        (ex) =>
          (ex.name ?? '').toLowerCase().includes(query) ||
          ex.muscleGroup?.toLowerCase().includes(query)
      )
    );
  }, [sessions, searchQuery]);

  // Group sessions by month
  const groupedSessions = useMemo(() => {
    const groups: Record<string, WorkoutSession[]> = {};
    filteredSessions.forEach((session) => {
      const date = new Date(session.startTime);
      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      if (!groups[monthKey]) {
        groups[monthKey] = [];
      }
      groups[monthKey].push(session);
    });
    return Object.entries(groups).map(([key, groupSessions]) => ({
      key,
      label: groupSessions[0]
        ? new Date(groupSessions[0].startTime).toLocaleDateString('he-IL', {
            month: 'long',
            year: 'numeric',
          })
        : '',
      sessions: groupSessions,
    }));
  }, [filteredSessions]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="ambient-mesh ambient-mesh-soft"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9000,
        background: 'var(--fs-bg)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <header
        style={{
          color: 'var(--fs-ink)',
          padding: '16px 20px',
          paddingTop: 'max(16px, env(safe-area-inset-top, 16px))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--fs-bg)',
          borderBottom: '2px solid var(--fs-accent)',
        }}
      >
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onClose}
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '2px solid var(--fs-accent)',
            cursor: 'pointer',
            color: 'var(--fs-accent)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M11 4L6 9L11 14"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="square"
            />
          </svg>
        </motion.button>

        <div style={{ textAlign: 'center' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.22em',
              color: 'var(--fs-accent)',
              textTransform: 'uppercase',
            }}
          >
            §01 · היסטוריה
          </span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 20,
              textTransform: 'uppercase',
              letterSpacing: '0.02em',
              color: 'var(--fs-ink)',
              marginTop: 2,
            }}
          >
            היסטוריית אימונים
          </h1>
        </div>

        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={refresh}
          disabled={loading}
          style={{
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: '2px solid rgba(var(--text-on-navy-rgb),0.2)',
            cursor: 'pointer',
            color: 'rgba(var(--text-on-navy-rgb),0.6)',
          }}
        >
          <motion.div
            animate={loading ? { rotate: 360 } : {}}
            transition={{
              duration: 1,
              repeat: loading ? Number.POSITIVE_INFINITY : 0,
              ease: 'linear',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M15 9A6 6 0 1 1 9 3"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="square"
              />
            </svg>
          </motion.div>
        </motion.button>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar" style={{ padding: '20px' }}>
        {/* Stats Row - Editorial Data Strip */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            border: '2px solid var(--fs-primary)',
            marginBottom: 20,
          }}
        >
          <StatCard label="סה״כ אימונים" value={stats.totalWorkouts} />
          <StatCard label="נפח ממוצע" value={`${stats.averageVolume.toLocaleString()}`} />
          <StatCard label="זמן ממוצע" value={`${stats.averageDuration}'`} />
        </div>

        {/* Quick Stats - Mustard Block */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr auto 1fr',
            alignItems: 'center',
            background: 'var(--fs-accent)',
            padding: '16px 20px',
            marginBottom: 20,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 36,
                color: 'var(--fs-heading)',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {stats.workoutsThisWeek}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.18em',
                color: 'var(--fs-heading)',
                textTransform: 'uppercase',
                marginTop: 6,
                opacity: 0.7,
              }}
            >
              השבוע
            </div>
          </div>
          <div style={{ width: 2, height: 40, background: 'var(--fs-primary)', opacity: 0.3 }} />
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 36,
                color: 'var(--fs-heading)',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {stats.workoutsThisMonth}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.18em',
                color: 'var(--fs-heading)',
                textTransform: 'uppercase',
                marginTop: 6,
                opacity: 0.7,
              }}
            >
              החודש
            </div>
          </div>
          <div style={{ width: 2, height: 40, background: 'var(--fs-primary)', opacity: 0.3 }} />
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 36,
                color: 'var(--fs-heading)',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              {(stats.totalVolume / 1000).toFixed(0)}K
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9,
                letterSpacing: '0.18em',
                color: 'var(--fs-heading)',
                textTransform: 'uppercase',
                marginTop: 6,
                opacity: 0.7,
              }}
            >
              נפח כולל
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative" style={{ marginBottom: 20 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש לפי תרגיל או קבוצת שריר..."
            style={{
              width: '100%',
              height: 48,
              padding: '12px 16px',
              background: 'var(--fs-surface)',
              border: '2px solid var(--fs-primary)',
              fontFamily: 'var(--font-body)',
              fontSize: 15,
              color: 'var(--fs-ink)',
              outline: 'none',
            }}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              padding: 16,
              background: 'rgba(196, 43, 43, 0.1)',
              border: '2px solid #C42B2B',
              color: '#C42B2B',
              fontFamily: 'var(--font-body)',
              fontSize: 14,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && sessions.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Number.POSITIVE_INFINITY, ease: 'linear' }}
              style={{
                width: 32,
                height: 32,
                border: '3px solid var(--fs-primary)',
                borderTopColor: 'transparent',
              }}
            />
          </div>
        )}

        {/* Empty State */}
        {!loading && sessions.length === 0 && (
          <div className="text-center py-12">
            <div
              style={{
                width: 80,
                height: 80,
                margin: '0 auto 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--fs-surface-2)',
                border: '2px solid var(--fs-primary)',
              }}
            >
              <svg
                width="32"
                height="32"
                viewBox="0 0 32 32"
                fill="none"
                style={{ color: 'var(--fs-muted)' }}
              >
                <path
                  d="M16 4L20 12L28 13L22 19L24 28L16 24L8 28L10 19L4 13L12 12L16 4Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="miter"
                />
              </svg>
            </div>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                color: 'var(--fs-ink)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              אין נתונים עדיין
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--fs-muted)',
                letterSpacing: '0.05em',
              }}
            >
              התחל להתאמן כדי ליצור את הפרק הראשון
            </div>
          </div>
        )}

        {/* Sessions List */}
        {groupedSessions.map((group) => (
          <div key={group.key} className="space-y-3">
            {/* Month Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                marginBottom: 16,
                marginTop: 24,
                paddingBottom: 12,
                borderBottom: '3px solid var(--fs-primary)',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 28,
                  color: 'var(--fs-heading)',
                  letterSpacing: '-0.02em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {group.sessions.length}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: 14,
                  color: 'var(--fs-ink)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                {group.label}
              </span>
            </div>
            <div className="space-y-3">
              {group.sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onClick={() => onSelectSession?.(session)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Safe Area */}
      <div style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
    </motion.div>
  );
};

export default React.memo(WorkoutHistoryScreen);
